import { TRAUMA_DECAY, MAX_SHAKE, ZOOM_SCALE } from "../constants";
import type { GameState } from "../types";
import type { GameEvent } from "../events";
import { updateBucket } from "./bucket";
import { updatePegAnimations } from "./pegs";
import { updateParticles } from "./particles";
import { processBallPhysics } from "./ball";
import { endOfTurn } from "./turn";

export interface TickResult {
  events: GameEvent[];
  syncUI: boolean;
  orangeLeft: number;
}

export function tick(s: GameState): TickResult {
  const events: GameEvent[] = [];

  s.animClock += 0.03;

  // Hit freeze : fige la physique, anime seulement les scales de pegs
  if (s.hitFreezeFrames > 0) {
    s.hitFreezeFrames--;
    updatePegAnimations(s);
    return { events, syncUI: false, orangeLeft: s.orangeLeft };
  }

  const inSlowMo = s.slowMoFrames > 0;
  const timeScale = inSlowMo ? 0.25 : 1;
  if (s.slowMoFrames > 0) s.slowMoFrames--;

  const targetZoom = s.slowMoFrames > 0 && s.ball?.active ? ZOOM_SCALE : 1.0;
  s.zoomLevel += (targetZoom - s.zoomLevel) * 0.1;
  if (Math.abs(s.zoomLevel - 1) < 0.004) s.zoomLevel = 1;

  updateBucket(s, timeScale);

  // Pulsation "fièvre" quand il reste peu d'oranges
  const orangeLeft = s.orangeLeft;
  const inFever = orangeLeft <= s.effectiveFeverThreshold && orangeLeft > 0;
  if (inFever) s.feverPulse = (s.feverPulse + 0.08) % (Math.PI * 2);
  else s.feverPulse = 0;

  // Screen shake
  if (s.trauma > 0) s.trauma = Math.max(0, s.trauma - TRAUMA_DECAY);
  const shakeMag = MAX_SHAKE * s.trauma * s.trauma;
  s.shakeX = s.trauma > 0.01 ? shakeMag * Math.sin(s.animClock * 43.7 + 1.1) : 0;
  s.shakeY = s.trauma > 0.01 ? shakeMag * Math.cos(s.animClock * 27.3 + 0.5) : 0;

  if (s.flashWhite > 0) s.flashWhite -= 0.07;

  updatePegAnimations(s);

  // Physique de l'œuf
  if (s.ball?.active) processBallPhysics(s.ball, s, timeScale, events);

  // Animations de pop
  for (const p of s.pegs) {
    if (p.popping) {
      p.popAlpha -= 0.07;
      if (p.popAlpha <= 0) { p.popAlpha = 0; p.popping = false; }
    }
  }

  updateParticles(s, timeScale);

  if (s.ball && !s.ball.active) s.ball = null;

  // Fin de tour
  if (s.phase === "firing" && !s.ball) {
    endOfTurn(s, events);
    return { events, syncUI: true, orangeLeft };
  }

  return { events, syncUI: false, orangeLeft };
}
