"use client";

import { useRef, useState, useCallback } from "react";
import type { RemotePeer, SseEvent, SignalType } from "../types";
import { createVAD } from "../lib/vad-context";

interface InternalPeer {
  userId: string;
  displayName: string;
  pc: RTCPeerConnection;
  stream: MediaStream | null;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isCamOff: boolean;
  isHost: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  polite: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
  vadCleanup: (() => void) | null;
  videoIsScreenShare: boolean;
}

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/meet/ice-config");
    if (!res.ok) throw new Error();
    const { iceServers } = await res.json();
    return iceServers;
  } catch {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

// Prefer Opus for audio, VP9 > VP8 > H264 for video
function applyCodecPreferences(pc: RTCPeerConnection): void {
  if (typeof RTCRtpSender.getCapabilities !== "function") return;
  for (const transceiver of pc.getTransceivers()) {
    const kind = transceiver.sender.track?.kind ?? transceiver.receiver.track?.kind;
    if (!kind) continue;
    try {
      const caps = RTCRtpSender.getCapabilities(kind);
      if (!caps) continue;
      if (kind === "audio") {
        const opus = caps.codecs.filter((c) => c.mimeType.toLowerCase() === "audio/opus");
        const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== "audio/opus");
        transceiver.setCodecPreferences([...opus, ...rest]);
      } else if (kind === "video") {
        const order = ["video/vp9", "video/vp8", "video/h264"];
        const sorted = [
          ...order.flatMap((mime) => caps.codecs.filter((c) => c.mimeType.toLowerCase() === mime)),
          ...caps.codecs.filter((c) => !order.includes(c.mimeType.toLowerCase())),
        ];
        if (sorted.length > 0) transceiver.setCodecPreferences(sorted);
      }
    } catch {
      // setCodecPreferences may not be supported in all browsers
    }
  }
}

// Apply bitrate caps after connection is established
async function applyBitrateLimits(pc: RTCPeerConnection, videoIsScreenShare: boolean): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      const enc = params.encodings[0]!;
      if (sender.track.kind === "audio") {
        enc.maxBitrate = 64_000;
      } else if (sender.track.kind === "video") {
        enc.maxBitrate = videoIsScreenShare ? 2_500_000 : 1_200_000;
      }
      await sender.setParameters(params);
    } catch {
      // setParameters requires an active connection — may fail silently
    }
  }
}


export interface UseWebRtcReturn {
  peers: Map<string, RemotePeer>;
  peersRef: React.MutableRefObject<Map<string, InternalPeer>>;
  createPeerConnection: (
    remoteId: string,
    displayName: string,
    polite: boolean,
    localStreamRef: React.MutableRefObject<MediaStream | null>,
    isHost: boolean,
  ) => Promise<void>;
  handleSignal: (from: string, type: string, payload: unknown) => Promise<void>;
  removePeer: (userId: string) => void;
  clearPeers: () => void;
  replaceVideoTrack: (track: MediaStreamTrack | null, isScreenShare?: boolean) => Promise<void>;
  replaceAudioTrack: (track: MediaStreamTrack) => Promise<void>;
  sendSignal: (to: string, type: SignalType, payload: unknown) => Promise<void>;
  handleSseEvent: (event: SseEvent, currentUserId: string, localStreamRef: React.MutableRefObject<MediaStream | null>) => Promise<void>;
}

export function useWebRtc(roomId: string): UseWebRtcReturn {
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const peersRef = useRef<Map<string, InternalPeer>>(new Map());
  const pendingPeersRef = useRef<Set<string>>(new Set());
  const iceServersRef = useRef<RTCIceServer[] | null>(null);

  const updatePeersState = useCallback(() => {
    setPeers(new Map(
      [...peersRef.current.entries()].map(([id, p]) => [id, {
        userId: p.userId,
        displayName: p.displayName,
        stream: p.stream,
        isSpeaking: p.isSpeaking,
        isScreenSharing: p.isScreenSharing,
        isMuted: p.isMuted,
        isCamOff: p.isCamOff,
        isHost: p.isHost,
      }])
    ));
  }, []);

  const sendSignal = useCallback(async (to: string, type: SignalType, payload: unknown) => {
    await fetch(`/api/meet/rooms/${roomId}/signal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, type, payload }),
    });
  }, [roomId]);

  const createPeerConnection = useCallback(async (
    remoteId: string,
    displayName: string,
    polite: boolean,
    localStreamRef: React.MutableRefObject<MediaStream | null>,
    isHost: boolean,
  ) => {
    if (peersRef.current.has(remoteId) || pendingPeersRef.current.has(remoteId)) return;
    pendingPeersRef.current.add(remoteId);

    if (!iceServersRef.current) {
      iceServersRef.current = await fetchIceServers();
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      // Bundle all media streams into one transport — reduces handshake overhead
      bundlePolicy: "max-bundle",
      // Multiplex RTP and RTCP on the same port
      rtcpMuxPolicy: "require",
      // Pre-gather ICE candidates for faster connection setup
      iceCandidatePoolSize: 2,
    });

    const peer: InternalPeer = {
      userId: remoteId,
      displayName,
      pc,
      stream: null,
      isSpeaking: false,
      isScreenSharing: false,
      isMuted: false,
      isCamOff: false,
      isHost,
      makingOffer: false,
      ignoreOffer: false,
      polite,
      pendingCandidates: [],
      hasRemoteDescription: false,
      vadCleanup: null,
      videoIsScreenShare: false,
    };

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    // Apply codec preferences right after adding tracks (before first offer)
    applyCodecPreferences(pc);

    pc.ontrack = (e) => {
      peer.stream = e.streams[0] ?? peer.stream;

      if (e.track.kind === "audio") {
        peer.vadCleanup?.();
        peer.vadCleanup = createVAD(e.track, (isSpeaking) => {
          peer.isSpeaking = isSpeaking;
          updatePeersState();
        });
      }

      updatePeersState();
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(remoteId, "ice-candidate", e.candidate.toJSON());
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(remoteId, "offer", pc.localDescription);
      } catch (err) {
        console.error("negotiationneeded error", err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        // Apply bitrate caps once the connection is live
        void applyBitrateLimits(pc, peer.videoIsScreenShare);
      } else if (pc.connectionState === "failed") {
        // Attempt ICE restart before giving up
        pc.restartIce();
      }
      updatePeersState();
    };

    peersRef.current.set(remoteId, peer);
    pendingPeersRef.current.delete(remoteId);
    updatePeersState();
  }, [sendSignal, updatePeersState]);

  const handleSignal = useCallback(async (from: string, type: string, payload: unknown) => {
    const peer = peersRef.current.get(from);
    if (!peer) return;
    const { pc } = peer;

    if (type === "offer" || type === "answer") {
      const desc = payload as RTCSessionDescriptionInit;
      const offerCollision = type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;

      await pc.setRemoteDescription(desc);
      peer.hasRemoteDescription = true;

      if (type === "offer") {
        // Apply codec preferences as answerer too, before creating the answer
        applyCodecPreferences(pc);
        await pc.setLocalDescription();
        sendSignal(from, "answer", pc.localDescription);
      }

      for (const candidate of peer.pendingCandidates) {
        try { await pc.addIceCandidate(candidate); } catch { /* stale */ }
      }
      peer.pendingCandidates = [];
    } else if (type === "ice-candidate") {
      if (!peer.hasRemoteDescription) {
        peer.pendingCandidates.push(payload as RTCIceCandidateInit);
      } else {
        try {
          await pc.addIceCandidate(payload as RTCIceCandidateInit);
        } catch (err) {
          if (!peer.ignoreOffer) console.error("ICE error", err);
        }
      }
    } else if (type === "screen-share-state") {
      peer.isScreenSharing = (payload as { sharing: boolean }).sharing;
      updatePeersState();
    } else if (type === "participant-update") {
      const update = payload as { isMuted?: boolean; isCamOff?: boolean; isScreenSharing?: boolean };
      if (update.isMuted !== undefined) peer.isMuted = update.isMuted;
      if (update.isCamOff !== undefined) peer.isCamOff = update.isCamOff;
      if (update.isScreenSharing !== undefined) peer.isScreenSharing = update.isScreenSharing;
      updatePeersState();
    }
  }, [sendSignal, updatePeersState]);

  const removePeer = useCallback((userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.vadCleanup?.();
      peer.pc.close();
      peersRef.current.delete(userId);
      updatePeersState();
    }
  }, [updatePeersState]);

  const clearPeers = useCallback(() => {
    for (const peer of peersRef.current.values()) {
      peer.vadCleanup?.();
      peer.pc.close();
    }
    peersRef.current.clear();
    pendingPeersRef.current.clear();
    updatePeersState();
  }, [updatePeersState]);

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null, isScreenShare = false) => {
    for (const peer of peersRef.current.values()) {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && track) {
        await sender.replaceTrack(track);
        // Update bitrate cap to match screen share vs camera
        peer.videoIsScreenShare = isScreenShare;
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0]!.maxBitrate = isScreenShare ? 2_500_000 : 1_200_000;
          await sender.setParameters(params);
        } catch {
          // ok — connection may not be ready yet
        }
      } else if (!sender && track) {
        peer.pc.addTrack(track);
      }
    }
  }, []);

  const replaceAudioTrack = useCallback(async (track: MediaStreamTrack) => {
    for (const peer of peersRef.current.values()) {
      const sender = peer.pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(track);
    }
  }, []);

  const handleSseEvent = useCallback(async (
    event: SseEvent,
    currentUserId: string,
    localStreamRef: React.MutableRefObject<MediaStream | null>,
  ) => {
    if (event.kind === "room-state") {
      for (const p of event.participants) {
        if (p.userId === currentUserId) continue;
        await createPeerConnection(p.userId, p.displayName, true, localStreamRef, p.isHost);
      }
    } else if (event.kind === "peer-joined") {
      const p = event.participant;
      if (p.userId !== currentUserId) {
        await createPeerConnection(p.userId, p.displayName, false, localStreamRef, p.isHost);
      }
    } else if (event.kind === "peer-left") {
      removePeer(event.userId);
    } else if (event.kind === "signal") {
      await handleSignal(event.from, event.type, event.payload);
    } else if (event.kind === "participant-update") {
      const peer = peersRef.current.get(event.participant.userId);
      if (peer) {
        peer.isMuted = event.participant.isMuted;
        peer.isCamOff = event.participant.isCamOff;
        peer.isScreenSharing = event.participant.isScreenSharing;
        peer.isHost = event.participant.isHost;
        updatePeersState();
      }
    }
  }, [createPeerConnection, handleSignal, removePeer, updatePeersState]);

  return {
    peers,
    peersRef,
    createPeerConnection,
    handleSignal,
    removePeer,
    clearPeers,
    replaceVideoTrack,
    replaceAudioTrack,
    sendSignal,
    handleSseEvent,
  };
}
