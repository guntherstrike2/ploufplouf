"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { UseLocalMediaReturn } from "./use-local-media";
import { useWebRtc } from "./use-webrtc";
import { useChat, type UseChatReturn } from "./use-chat";
import type { SseEvent, Reaction, ReactionEmoji } from "../types";

export interface UseMeetReturn {
  // media
  localStream: UseLocalMediaReturn["localStream"];
  screenStream: UseLocalMediaReturn["screenStream"];
  isMuted: boolean;
  isCamOff: boolean;
  isScreenSharing: boolean;
  isLocalSpeaking: boolean;
  audioDevices: UseLocalMediaReturn["audioDevices"];
  videoDevices: UseLocalMediaReturn["videoDevices"];
  selectedAudioId: string | null;
  selectedVideoId: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  toggleMute: () => void;
  toggleCam: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  switchAudioDevice: (deviceId: string) => Promise<void>;
  switchVideoDevice: (deviceId: string) => Promise<void>;
  setNoiseSuppression: (v: boolean) => Promise<void>;
  setEchoCancellation: (v: boolean) => Promise<void>;
  // peers
  peers: ReturnType<typeof useWebRtc>["peers"];
  // chat
  chatMessages: UseChatReturn["chatMessages"];
  unreadCount: number;
  sendChat: (text: string) => Promise<void>;
  markChatRead: () => void;
  markChatUnread: () => void;
  // reactions
  reactions: Reaction[];
  sendReaction: (emoji: ReactionEmoji) => Promise<void>;
  // ambiance
  broadcastAmbiance: (sampleId: string | null) => Promise<void>;
  onAmbianceSync: (cb: (sampleId: string | null, displayName: string) => void) => void;
  // moderation
  isHost: boolean;
  mutePeer: (userId: string) => Promise<void>;
  // connection
  connected: boolean;
}

export function useMeet(
  roomId: string,
  currentUserId: string,
  currentDisplayName: string,
  initialIsHost: boolean,
  media: UseLocalMediaReturn,
): UseMeetReturn {
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const webrtc = useWebRtc(roomId);
  const chat = useChat();

  const stopScreenShareRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(1_000);
  const mountedRef = useRef(true);
  const ambianceSyncCbRef = useRef<((sampleId: string | null, displayName: string) => void) | null>(null);

  // Broadcast our own state changes to all peers
  const broadcastParticipantUpdate = useCallback((update: { isMuted?: boolean; isCamOff?: boolean; isScreenSharing?: boolean }) => {
    for (const peer of webrtc.peersRef.current.values()) {
      webrtc.sendSignal(peer.userId, "participant-update", update);
    }
  }, [webrtc]);

  const toggleMute = useCallback(() => {
    media.toggleMute();
    // Read the actual track state post-toggle instead of the stale React state
    const newMuted = !(media.localStreamRef.current?.getAudioTracks()[0]?.enabled ?? true);
    broadcastParticipantUpdate({ isMuted: newMuted });
  }, [media, broadcastParticipantUpdate]);

  const toggleCam = useCallback(() => {
    media.toggleCam();
    const newCamOff = !(media.localStreamRef.current?.getVideoTracks()[0]?.enabled ?? true);
    broadcastParticipantUpdate({ isCamOff: newCamOff });
  }, [media, broadcastParticipantUpdate]);

  const stopScreenShare = useCallback(async () => {
    await media.stopScreenShare();
    const localVideo = media.localStreamRef.current?.getVideoTracks()[0];
    await webrtc.replaceVideoTrack(localVideo ?? null, false);
    broadcastParticipantUpdate({ isScreenSharing: false });
    for (const peer of webrtc.peersRef.current.values()) {
      webrtc.sendSignal(peer.userId, "screen-share-state", { sharing: false });
    }
  }, [media, webrtc, broadcastParticipantUpdate]);
  stopScreenShareRef.current = stopScreenShare;

  const startScreenShare = useCallback(async () => {
    await media.startScreenShare(async () => {
      await stopScreenShareRef.current();
    });
    const screenTrack = media.screenStreamRef.current?.getVideoTracks()[0];
    if (!screenTrack) return;
    const localVideo = media.localStreamRef.current?.getVideoTracks()[0];
    if (localVideo) localVideo.enabled = false;
    await webrtc.replaceVideoTrack(screenTrack, true);
    broadcastParticipantUpdate({ isScreenSharing: true });
    for (const peer of webrtc.peersRef.current.values()) {
      webrtc.sendSignal(peer.userId, "screen-share-state", { sharing: true });
    }
  }, [media, webrtc, broadcastParticipantUpdate]);

  const switchAudioDevice = useCallback(async (deviceId: string) => {
    await media.switchAudioDevice(deviceId);
    const newTrack = media.localStreamRef.current?.getAudioTracks()[0];
    if (newTrack) await webrtc.replaceAudioTrack(newTrack);
  }, [media, webrtc]);

  const switchVideoDevice = useCallback(async (deviceId: string) => {
    const newTrack = await media.switchVideoDevice(deviceId);
    if (newTrack) await webrtc.replaceVideoTrack(newTrack, false);
  }, [media, webrtc]);

  const sendChat = useCallback(async (text: string) => {
    await chat.sendChat(roomId, currentUserId, currentDisplayName, text);
  }, [chat, roomId, currentUserId, currentDisplayName]);

  const sendReaction = useCallback(async (emoji: ReactionEmoji) => {
    const localReaction: Reaction = {
      userId: currentUserId,
      displayName: currentDisplayName,
      emoji,
      id: `${Date.now()}-${currentUserId}`,
    };
    setReactions((prev) => [...prev, localReaction]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== localReaction.id)), 3000);

    await fetch(`/api/meet/rooms/${roomId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }, [currentUserId, currentDisplayName, roomId]);

  const mutePeer = useCallback(async (userId: string) => {
    if (!isHost) return;
    webrtc.sendSignal(userId, "host-mute-peer", { targetUserId: userId });
  }, [isHost, webrtc]);

  const broadcastAmbiance = useCallback(async (sampleId: string | null) => {
    await fetch(`/api/meet/rooms/${roomId}/ambiance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleId }),
    });
  }, [roomId]);

  const onAmbianceSync = useCallback((cb: (sampleId: string | null, displayName: string) => void) => {
    ambianceSyncCbRef.current = cb;
  }, []);

  // SSE setup with exponential backoff reconnection
  useEffect(() => {
    mountedRef.current = true;
    reconnectDelayRef.current = 1_000;

    function connect() {
      const es = new EventSource(`/api/meet/rooms/${roomId}/signal`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        reconnectDelayRef.current = 1_000;
        chat.loadHistory(roomId);
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!mountedRef.current) return;

        webrtc.clearPeers();

        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 30_000);
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      es.addEventListener("message", (e: MessageEvent) => {
        void (async () => {
          const event = JSON.parse(e.data) as SseEvent;

          if (event.kind === "chat") {
            const m = event.message;
            if (m.userId !== currentUserId) {
              chat.addMessage({ id: m.id, from: m.userId, displayName: m.displayName, text: m.content, ts: m.createdAt });
            }
            return;
          }

          if (event.kind === "reaction") {
            const reaction = event.reaction;
            if (reaction.userId !== currentUserId) {
              setReactions((prev) => [...prev, reaction]);
              setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== reaction.id)), 3000);
            }
            return;
          }

          if (event.kind === "host-mute-peer") {
            if (event.targetUserId === currentUserId) {
              media.toggleMute();
            }
            return;
          }

          if (event.kind === "ambiance-sync") {
            ambianceSyncCbRef.current?.(event.sampleId, event.displayName);
            return;
          }

          if (event.kind === "room-state") {
            const me = event.participants.find((p) => p.userId === currentUserId);
            if (me?.isHost) setIsHost(true);
          }

          if (event.kind === "peer-joined" && event.participant.userId === currentUserId) return;

          if (event.kind === "room-state" || event.kind === "peer-joined") {
            await media.waitForStream();
          }

          await webrtc.handleSseEvent(event, currentUserId, media.localStreamRef);
        })();
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
      webrtc.clearPeers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUserId]);

  return {
    localStream: media.localStream,
    screenStream: media.screenStream,
    isMuted: media.isMuted,
    isCamOff: media.isCamOff,
    isScreenSharing: media.isScreenSharing,
    isLocalSpeaking: media.isLocalSpeaking,
    audioDevices: media.audioDevices,
    videoDevices: media.videoDevices,
    selectedAudioId: media.selectedAudioId,
    selectedVideoId: media.selectedVideoId,
    noiseSuppression: media.noiseSuppression,
    echoCancellation: media.echoCancellation,
    toggleMute,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    switchAudioDevice,
    switchVideoDevice,
    setNoiseSuppression: media.setNoiseSuppression,
    setEchoCancellation: media.setEchoCancellation,
    peers: webrtc.peers,
    chatMessages: chat.chatMessages,
    unreadCount: chat.unreadCount,
    sendChat,
    markChatRead: chat.markRead,
    markChatUnread: chat.markUnread,
    reactions,
    sendReaction,
    broadcastAmbiance,
    onAmbianceSync,
    isHost,
    mutePeer,
    connected,
  };
}
