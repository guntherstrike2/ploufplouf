"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMeet } from "../hooks/use-meet";
import type { UseLocalMediaReturn } from "../hooks/use-local-media";
import { VideoTile } from "./VideoTile";
import { CtrlBtn } from "./CtrlBtn";
import { ChatPanel } from "./ChatPanel";
import { ParticipantList } from "./ParticipantList";
import { DevicePicker } from "./DevicePicker";
import { AmbiancePanel } from "./AmbiancePanel";
import { useSoundContext } from "@/lib/contexts/sound-context";
import { useNotify } from "@/lib/contexts/notification-context";
import type { ReactionEmoji, Reaction } from "../types";

const REACTIONS: ReactionEmoji[] = ["👍", "👏", "✋", "❤️", "😂"];

export function CallScreen({
  roomId,
  userId,
  displayName,
  isHost,
  media,
  onLeave,
}: {
  roomId: string;
  userId: string;
  displayName: string;
  isHost: boolean;
  media: UseLocalMediaReturn;
  onLeave: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [ambianceOpen, setAmbianceOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [outputVolume, setOutputVolume] = useState(1);

  const { playPop, playBip, playWindowClose, playNotifyInfo, init } = useSoundContext();
  const notify = useNotify();
  const prevPeersRef = useRef<Map<string, { displayName: string; isMuted: boolean }>>(new Map());

  const {
    peers,
    localStream,
    screenStream,
    isMuted,
    isCamOff,
    isScreenSharing,
    isLocalSpeaking,
    audioDevices,
    videoDevices,
    selectedAudioId,
    selectedVideoId,
    noiseSuppression,
    echoCancellation,
    chatMessages,
    unreadCount,
    connected,
    reactions,
    isHost: currentIsHost,
    toggleMute,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    switchAudioDevice,
    switchVideoDevice,
    setNoiseSuppression,
    setEchoCancellation,
    sendChat,
    markChatRead,
    markChatUnread,
    sendReaction,
    broadcastAmbiance,
    onAmbianceSync,
    mutePeer,
  } = useMeet(roomId, userId, displayName, isHost, media);

  // Sons OS + notifs sur les événements de la salle
  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const prev = prevPeersRef.current;
    const curr = peers;

    for (const [id, peer] of curr) {
      if (!prev.has(id)) {
        // Nouveau participant
        playPop();
        notify({ type: "info", title: `📞 ${peer.displayName} a rejoint`, duration: 3000 });
      } else {
        const prevPeer = prev.get(id)!;
        if (!prevPeer.isMuted && peer.isMuted) {
          playBip();
        }
      }
    }
    for (const [id, peer] of prev) {
      if (!curr.has(id)) {
        playWindowClose();
        notify({ type: "warning", title: `📴 ${peer.displayName} a raccroché`, duration: 3000 });
      }
    }

    prevPeersRef.current = new Map([...curr].map(([id, p]) => [id, { displayName: p.displayName, isMuted: p.isMuted }]));
  }, [peers, playPop, playBip, playWindowClose, notify]);

  // Notif chat quand panneau fermé
  useEffect(() => {
    if (!chatOpen && unreadCount > 0) {
      playNotifyInfo();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const handleChatOpen = useCallback(() => {
    setChatOpen(true);
    markChatRead();
  }, [markChatRead]);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
    markChatUnread();
  }, [markChatUnread]);

  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    navigator.clipboard.writeText(url.toString());
  }, [roomId]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(roomId);
  }, [roomId]);

  // Build tile list — pinned goes first and spans full width
  const allTiles = [
    {
      key: "local",
      stream: isScreenSharing ? screenStream : localStream,
      label: `${displayName} (vous)`,
      muted: true,
      isScreenSharing,
      noVideo: isCamOff && !isScreenSharing,
      isMuted,
      isCamOff,
      isHost: currentIsHost,
      userId: "local",
    },
    ...[...peers.values()].map((p) => ({
      key: p.userId,
      stream: p.stream,
      label: p.displayName,
      muted: false,
      isScreenSharing: p.isScreenSharing,
      noVideo: false,
      isMuted: p.isMuted,
      isCamOff: p.isCamOff,
      isHost: p.isHost,
      userId: p.userId,
      volume: outputVolume,
    })),
  ];

  const pinnedTile = pinnedId ? allTiles.find((t) => t.key === pinnedId) : null;
  const otherTiles = pinnedId ? allTiles.filter((t) => t.key !== pinnedId) : allTiles;
  const cols = Math.ceil(Math.sqrt(otherTiles.length));

  const reactionsForTile = useCallback((tileUserId: string): Reaction[] => {
    return reactions.filter((r) => r.userId === tileUserId);
  }, [reactions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--t-bg)", position: "relative" }}>
      {/* Header */}
      <div
        style={{
          padding: "2px 8px",
          background: "var(--t-titlebar-from)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--t-border-dark)",
          gap: 8,
        }}
      >
        <span style={{ fontSize: "var(--t-text-xs)", color: "#fff", fontFamily: "var(--t-font-display)" }}>
          📹 <strong>{roomId}</strong> — {peers.size + 1} participant{peers.size !== 0 ? "s" : ""}
          {currentIsHost && " 👑"}
          {!connected && " · ⚠️ reconnexion…"}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={handleCopyCode}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)" }}
            title="Copier le code"
          >
            📋 Code
          </button>
          <button
            onClick={handleCopyLink}
            style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)" }}
            title="Copier le lien d'invitation"
          >
            🔗 Lien
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Video area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Pinned tile (full width) */}
          {pinnedTile && (
            <div style={{ padding: "4px 4px 0", flexShrink: 0 }}>
              <VideoTile
                key={pinnedTile.key + "-pinned"}
                stream={pinnedTile.stream}
                label={pinnedTile.label}
                muted={pinnedTile.muted}
                isScreenSharing={pinnedTile.isScreenSharing}
                noVideo={pinnedTile.noVideo}
                isMuted={pinnedTile.isMuted}
                isCamOff={pinnedTile.isCamOff}
                isHost={pinnedTile.isHost}
                isPinned
                onPin={() => setPinnedId(null)}
                reactions={reactionsForTile(pinnedTile.userId)}
                canMute={currentIsHost && pinnedTile.key !== "local"}
                onHostMute={currentIsHost && pinnedTile.key !== "local" ? () => { void mutePeer(pinnedTile.userId); } : undefined}
                volume={pinnedTile.key === "local" ? undefined : outputVolume}
              />
            </div>
          )}

          {/* Grid of remaining tiles */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: `repeat(${cols || 1}, 1fr)`,
              gap: 4,
              padding: 4,
              overflow: "auto",
              alignContent: "start",
            }}
          >
            {otherTiles.map((tile) => (
              <VideoTile
                key={tile.key}
                stream={tile.stream}
                label={tile.label}
                muted={tile.muted}
                isScreenSharing={tile.isScreenSharing}
                noVideo={tile.noVideo}
                isMuted={tile.isMuted}
                isCamOff={tile.isCamOff}
                isHost={tile.isHost}
                onPin={() => setPinnedId(tile.key)}
                reactions={reactionsForTile(tile.userId)}
                canMute={currentIsHost && tile.key !== "local"}
                onHostMute={currentIsHost && tile.key !== "local" ? () => { void mutePeer(tile.userId); } : undefined}
                volume={tile.key === "local" ? undefined : outputVolume}
              />
            ))}
          </div>
        </div>

        {/* Side panels */}
        {participantsOpen && (
          <ParticipantList
            localName={displayName}
            localIsMuted={isMuted}
            localIsCamOff={isCamOff}
            isLocalHost={currentIsHost}
            peers={peers}
            onHostMute={mutePeer}
            onClose={() => setParticipantsOpen(false)}
          />
        )}
        {chatOpen && (
          <ChatPanel
            messages={chatMessages}
            onSend={sendChat}
            onClose={handleChatClose}
          />
        )}
        {ambianceOpen && (
          <AmbiancePanel
            roomId={roomId}
            onBroadcast={broadcastAmbiance}
            onAmbianceSync={onAmbianceSync}
            onClose={() => setAmbianceOpen(false)}
          />
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "4px 8px",
          borderTop: "2px solid var(--t-border-dark)",
          background: "var(--t-bg)",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          position: "relative",
        }}
      >
        <CtrlBtn onClick={toggleMute} active={isMuted} title={isMuted ? "Activer micro" : "Couper micro"}>
          {isMuted ? "🔇" : "🎤"}
        </CtrlBtn>
        <CtrlBtn onClick={toggleCam} active={isCamOff} title={isCamOff ? "Activer caméra" : "Couper caméra"}>
          {isCamOff ? "📷" : "📹"}
        </CtrlBtn>
        <CtrlBtn
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          active={isScreenSharing}
          title={isScreenSharing ? "Arrêter partage" : "Partager l'écran"}
        >
          🖥
        </CtrlBtn>

        {/* Device picker toggle */}
        <CtrlBtn onClick={() => setDevicePickerOpen((p) => !p)} active={devicePickerOpen} title="Périphériques">
          ⚙️
        </CtrlBtn>

        {/* Reactions picker */}
        <div style={{ position: "relative" }}>
          <CtrlBtn onClick={() => setReactionsOpen((p) => !p)} active={reactionsOpen} title="Réactions">
            😊
          </CtrlBtn>
          {reactionsOpen && (
            <div
              style={{
                position: "absolute",
                bottom: 36,
                left: 0,
                background: "var(--t-bg)",
                border: "2px solid",
                borderColor: "var(--t-border-light) var(--t-border-dark) var(--t-border-dark) var(--t-border-light)",
                padding: 6,
                display: "flex",
                gap: 6,
                zIndex: 50,
              }}
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { sendReaction(emoji); setReactionsOpen(false); }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 20,
                    padding: 2,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <CtrlBtn
          onClick={() => setParticipantsOpen((p) => !p)}
          active={participantsOpen}
          title="Participants"
        >
          👥
        </CtrlBtn>

        <CtrlBtn
          onClick={chatOpen ? handleChatClose : handleChatOpen}
          active={chatOpen}
          badge={chatOpen ? 0 : unreadCount}
          title="Chat"
        >
          💬
        </CtrlBtn>

        <CtrlBtn onClick={() => setAmbianceOpen((p) => !p)} active={ambianceOpen} title="Ambiance musicale">
          🎵
        </CtrlBtn>

        <div style={{ flex: 1 }} />
        <CtrlBtn onClick={() => { playWindowClose(); onLeave(); }} danger title="Raccrocher">
          📵 Raccrocher
        </CtrlBtn>

        {/* Device picker popup */}
        {devicePickerOpen && (
          <DevicePicker
            audioDevices={audioDevices}
            videoDevices={videoDevices}
            selectedAudioId={selectedAudioId}
            selectedVideoId={selectedVideoId}
            onAudioChange={switchAudioDevice}
            onVideoChange={switchVideoDevice}
            outputVolume={outputVolume}
            onOutputVolumeChange={setOutputVolume}
            noiseSuppressionOn={noiseSuppression}
            onNoiseSuppressionChange={setNoiseSuppression}
            echoCancellationOn={echoCancellation}
            onEchoCancellationChange={setEchoCancellation}
            onClose={() => setDevicePickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
