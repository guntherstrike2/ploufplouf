// ─── Mots « hype » de combo — SOURCE UNIQUE ──────────────────────────────────
//
// Les exclamations de combo apparaissent à DEUX endroits, qui partagent désormais
// cette table (un rework des mots se fait ICI, à un seul endroit) :
//
//   • PLAYFIELD — un texte qui « explose » à côté du peg touché (HypeText, cf.
//     engine/state/ball.ts → pushEagleHype). Variantes longues, accentuées, tirées
//     au hasard dans `playfield[]`. Rendu en Press Start 2P (width-fit).
//
//   • DMD — le mot affiché dans le verre de gauche (cf. renderer/hud.ts → comboScene).
//     Le DMD a une police 5×7 MAJUSCULES SANS ACCENTS et un verre étroit (~6 lettres) :
//     d'où un champ `dmd` séparé, COURT et sans accent, par palier.
//
// Indexation commune : `tier = comboMult - 1`, où `comboMult = floor(combo / interval)`
// (cf. BALANCE.combo.interval). tier 0 = sobre → tier 5 = mégalo ridicule.
//
// Lexique ANGLAIS simple façon arcade / jeu vidéo — mots universels que tout le monde
// reconnaît instantanément (score, combo, high score, game over…), avec une touche
// « aigle » seulement là où c'est évident (EAGLE STRIKE, EAGLE EYE).
// Contraintes playfield : mots COURTS (trop long = rétréci) et SANS ligature Œ.

export interface HypeTier {
  dmd: string;                    // mot court DMD (majuscules, sans accent, ≤ ~6 lettres)
  playfield: readonly string[];   // variantes longues du playfield (tir au hasard)
}

export const HYPE_TIERS: readonly HypeTier[] = [
  { dmd: "COMBO",  playfield: ["NICE SHOT!", "COMBO!", "ON TARGET!", "BONUS!"] },
  { dmd: "GREAT",  playfield: ["GREAT!", "STREAK!", "LEVEL UP!", "HIGH SCORE!"] },
  { dmd: "SCORE",  playfield: ["NEW RECORD!", "JACKPOT!", "PERFECT!", "MEGA BONUS!"] },
  { dmd: "FRENZY", playfield: ["ON FIRE!", "FRENZY!", "UNSTOPPABLE!", "EAGLE STRIKE!"] },
  { dmd: "WOW",    playfield: ["FLAWLESS!", "OVERDRIVE!", "GODLIKE!", "EAGLE EYE!"] },
  { dmd: "LEGEND", playfield: ["LEGENDARY!", "MAX COMBO!", "INSERT COIN!", "GAME OVER... LOL!"] },
] as const;

// Borne un palier dans la plage valide (un combo très haut retombe sur le dernier).
export function hypeTier(comboMult: number): HypeTier {
  const i = Math.max(0, Math.min(HYPE_TIERS.length - 1, comboMult - 1));
  return HYPE_TIERS[i]!;
}
