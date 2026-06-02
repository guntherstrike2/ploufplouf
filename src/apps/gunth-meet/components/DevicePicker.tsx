"use client";

export function DevicePicker({
  audioDevices,
  videoDevices,
  selectedAudioId,
  selectedVideoId,
  onAudioChange,
  onVideoChange,
  outputVolume,
  onOutputVolumeChange,
  noiseSuppressionOn,
  onNoiseSuppressionChange,
  echoCancellationOn,
  onEchoCancellationChange,
  onClose,
}: {
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioId: string | null;
  selectedVideoId: string | null;
  onAudioChange: (deviceId: string) => void;
  onVideoChange: (deviceId: string) => void;
  outputVolume: number;
  onOutputVolumeChange: (v: number) => void;
  noiseSuppressionOn: boolean;
  onNoiseSuppressionChange: (v: boolean) => void;
  echoCancellationOn: boolean;
  onEchoCancellationChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "2px 4px",
    border: "2px solid",
    borderColor: "var(--t-border-dark) var(--t-border-light) var(--t-border-light) var(--t-border-dark)",
    background: "#fff",
    fontFamily: "var(--t-font-display)",
    fontSize: "var(--t-text-xs)",
    color: "#000",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--t-text-xs)",
    color: "var(--t-text-muted)",
    fontFamily: "var(--t-font-display)",
    marginBottom: 4,
    display: "block",
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontSize: "var(--t-text-xs)",
    fontFamily: "var(--t-font-display)",
    color: active ? "var(--t-accent)" : "var(--t-text-muted)",
    userSelect: "none",
  });

  const checkboxStyle = (active: boolean): React.CSSProperties => ({
    width: 12,
    height: 12,
    border: "2px solid",
    borderColor: "var(--t-border-dark) var(--t-border-light) var(--t-border-light) var(--t-border-dark)",
    background: active ? "var(--t-accent)" : "var(--t-bg)",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 8,
    color: "#fff",
  });

  const volumePercent = Math.round(outputVolume * 100);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 44,
        left: 8,
        background: "var(--t-bg)",
        border: "2px solid",
        borderColor: "var(--t-border-light) var(--t-border-dark) var(--t-border-dark) var(--t-border-light)",
        padding: 12,
        zIndex: 100,
        width: 280,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--t-text-xs)", fontFamily: "var(--t-font-display)", fontWeight: "bold" }}>
          ⚙️ Paramètres audio/vidéo
        </span>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: "var(--t-text-muted)" }}
        >
          ✕
        </button>
      </div>

      {/* Microphone device */}
      {audioDevices.length > 0 && (
        <div>
          <label style={labelStyle}>🎤 Microphone</label>
          <select
            value={selectedAudioId ?? ""}
            onChange={(e) => onAudioChange(e.target.value)}
            style={selectStyle}
          >
            {audioDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Micro ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Camera device */}
      {videoDevices.length > 0 && (
        <div>
          <label style={labelStyle}>📹 Caméra</label>
          <select
            value={selectedVideoId ?? ""}
            onChange={(e) => onVideoChange(e.target.value)}
            style={selectStyle}
          >
            {videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Caméra ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Volume des autres */}
      <div>
        <label style={{ ...labelStyle, marginBottom: 6 }}>
          🔊 Volume des autres — {volumePercent}%{volumePercent === 0 ? " 🙉" : volumePercent > 80 ? " 🔥" : ""}
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12 }}>🔈</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={outputVolume}
            onChange={(e) => onOutputVolumeChange(parseFloat(e.target.value))}
            style={{ flex: 1, cursor: "pointer", accentColor: "var(--t-accent)" }}
          />
          <span style={{ fontSize: 12 }}>📢</span>
        </div>
      </div>

      {/* Options audio qualité */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ ...labelStyle, marginBottom: 0 }}>🎛️ Qualité audio</label>

        <label style={toggleStyle(noiseSuppressionOn)} onClick={() => onNoiseSuppressionChange(!noiseSuppressionOn)}>
          <div style={checkboxStyle(noiseSuppressionOn)}>
            {noiseSuppressionOn && "✓"}
          </div>
          🤫 Suppression de bruit
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.7 }}>
            {noiseSuppressionOn ? "ON" : "OFF"}
          </span>
        </label>

        <label style={toggleStyle(echoCancellationOn)} onClick={() => onEchoCancellationChange(!echoCancellationOn)}>
          <div style={checkboxStyle(echoCancellationOn)}>
            {echoCancellationOn && "✓"}
          </div>
          🪃 Annulation d&apos;écho
          <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.7 }}>
            {echoCancellationOn ? "ON" : "OFF"}
          </span>
        </label>
      </div>

      <div style={{ fontSize: "var(--t-text-xs)", color: "var(--t-text-muted)", fontFamily: "var(--t-font-display)", borderTop: "1px solid var(--t-border-dark)", paddingTop: 8 }}>
        💡 Les options audio sont appliquées immédiatement au rechargement du track micro.
      </div>
    </div>
  );
}
