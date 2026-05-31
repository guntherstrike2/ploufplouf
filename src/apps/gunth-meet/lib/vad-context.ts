// Shared AudioContext for all VAD instances — avoids hitting the browser's
// per-page AudioContext limit (~6) when many peers are in the same room.

let sharedCtx: AudioContext | null = null;

export function getVADContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

const VAD_THRESHOLD = 0.01;
const VAD_SILENCE_DELAY_MS = 500;

// RMS-based VAD using the shared AudioContext.
// Returns a cleanup function. onSpeakingChange fires on state transitions only.
export function createVAD(
  audioTrack: MediaStreamTrack,
  onSpeakingChange: (speaking: boolean) => void,
): () => void {
  try {
    const ctx = getVADContext();
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);
    let speaking = false;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s: number, x: number) => s + x * x, 0) / buf.length);
      if (rms > VAD_THRESHOLD && !speaking) {
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
        speaking = true;
        onSpeakingChange(true);
      } else if (rms <= VAD_THRESHOLD && speaking && !silenceTimer) {
        silenceTimer = setTimeout(() => {
          speaking = false;
          onSpeakingChange(false);
          silenceTimer = null;
        }, VAD_SILENCE_DELAY_MS);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (silenceTimer) clearTimeout(silenceTimer);
      source.disconnect();
    };
  } catch {
    return () => {};
  }
}
