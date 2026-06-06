import { TRAUMA_DECAY, MAX_SHAKE, H, BUCKET_RIM_Y } from "../constants";
import type { GameState } from "../types";
import type { GameEvent } from "../events";
import { updateBucket } from "./bucket";
import { updatePegAnimations } from "./pegs";
import { updateParticles } from "./particles";
import { updateBirds } from "./birds";
import { processBallPhysics } from "./ball";
import { endOfTurn } from "./turn";
import { isClutchActive } from "../clutch";

export interface TickResult {
  events: GameEvent[];
  syncUI: boolean;
  orangeLeft: number;
}

export function tick(s: GameState): TickResult {
  const events: GameEvent[] = [];

  s.animClock += 0.03;

  // Lanceur : ressort vers la cible de drag, avec léger dépassement → juicy.
  // Toujours mis à jour (même en hit-freeze) pour rester réactif au doigt.
  const lx = s.launcherTargetX - s.launcherX;
  s.launcherVx = (s.launcherVx + lx * 0.45) * 0.6;
  s.launcherX += s.launcherVx;
  if (Math.abs(lx) < 0.05 && Math.abs(s.launcherVx) < 0.05) {
    s.launcherX = s.launcherTargetX;
    s.launcherVx = 0;
  }
  s.launcherGrab += ((s.launcherDragging ? 1 : 0) - s.launcherGrab) * 0.2;

  // Oiseaux easter egg : ambiance décorative — volent toujours, même pendant le
  // hit-freeze ou le ralenti, pour ne jamais se figer en plein ciel.
  updateBirds(s, 1);

  // Phase d'intro : on laisse tourner l'animClock et l'ambiance, mais aucune
  // physique ni saisie n'est possible. Transition automatique vers "aim".
  if (s.phase === "intro") {
    updateBucket(s, 1); // le panier se déplace pendant l'intro
    if (s.animClock >= s.introEndT) {
      s.phase = "aim";
      s.aimStartClock = s.animClock;
      return { events, syncUI: true, orangeLeft: s.orangeLeft };
    }
    return { events, syncUI: false, orangeLeft: s.orangeLeft };
  }

  // Hit freeze : fige la physique, anime seulement les scales de pegs
  if (s.hitFreezeFrames > 0) {
    s.hitFreezeFrames--;
    updatePegAnimations(s);
    return { events, syncUI: false, orangeLeft: s.orangeLeft };
  }

  // Burst de ralenti au moment où la dernière proie casse (déclenché ailleurs),
  // puis revient vers la normale tout seul.
  const burstSlow = s.slowMoFrames > 0;
  if (s.slowMoFrames > 0) s.slowMoFrames--;

  // Cible de vitesse du temps.
  let targetScale = burstSlow ? 0.22 : 1;

  // Finale : la descente reste quasi normale au milieu, puis le temps se fige
  // SURTOUT à l'approche du panier → le rattrapage / jackpot tombe pile au plus
  // lent. On prend le plus lent entre le burst de cassure et la proximité.
  if (s.orangeLeft === 0 && s.ball?.active) {
    const bucketTop = BUCKET_RIM_Y;
    const start = H * 0.5;
    const approach = Math.max(0, Math.min(1, (s.ball.y - start) / (bucketTop - start)));
    const eased = approach * approach * approach; // ne mord vraiment que tout près du panier
    const proximityScale = 1 - eased * 0.94;       // 1 loin → 0.06 au ras du panier
    targetScale = Math.min(targetScale, proximityScale);
  }

  // Ease in/out du ralenti : entrée franche mais pas brutale, retour bien doux.
  // → la bascule de vitesse devient soyeuse au lieu de claquer d'un coup.
  const ramp = targetScale < s.timeWarp ? 0.4 : 0.1;
  s.timeWarp += (targetScale - s.timeWarp) * ramp;
  if (Math.abs(s.timeWarp - targetScale) < 0.004) s.timeWarp = targetScale;
  const timeScale = s.timeWarp;

  updateBucket(s, timeScale);

  // Pulsation "fièvre" quand il reste peu d'œufs à tirer. Comme le coucher de
  // soleil (duskProgress), l'œuf en vol compte comme pas-encore-dépensé → lancer
  // le dernier œuf ne déclenche pas la nuit ; seule sa perte réelle le fait.
  const orangeLeft = s.orangeLeft;
  const inClutch = isClutchActive(s);
  if (inClutch) s.clutchPulse = (s.clutchPulse + 0.08) % (Math.PI * 2);
  else s.clutchPulse = 0;

  // duskProgress monte 0→1 proportionnellement aux œufs perdus, indépendamment du fever.
  // L'œuf en vol ne compte PAS comme dépensé : tant qu'il vole (ou jusqu'à ce qu'il
  // soit définitivement perdu), on le rajoute au compte. S'il retombe dans le panier,
  // il est rendu → la nuit ne tombe pas. Elle ne bascule donc qu'à la perte réelle.
  const ballsInFlight = s.ball?.active ? 1 : 0;
  const ballsRemaining = s.balls + ballsInFlight;
  const duskTarget = s.startBalls > 0
    ? Math.max(0, Math.min(1, (s.startBalls - ballsRemaining) / s.startBalls))
    : 0;
  s.duskProgress += (duskTarget - s.duskProgress) * 0.05;
  if (Math.abs(duskTarget - s.duskProgress) < 0.001) s.duskProgress = duskTarget;

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
    // Utilise s.orangeLeft (mis à jour par la physique) plutôt que la variable
    // capturée avant processBallPhysics — évite un décalage d'1 quand la balle
    // touche un peg et sort du terrain dans le même tick.
    return { events, syncUI: true, orangeLeft: s.orangeLeft };
  }

  return { events, syncUI: false, orangeLeft };
}
