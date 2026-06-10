// ─── Versement de fin de tour — MODÈLE DE BONUS EXTENSIBLE ───────────────────
//
// À la fin d'un tour (endOfTurn), le score n'augmente plus « en silence » : on
// construit un PAYOUT structuré — la base (points bleus × multiplicateur orange)
// suivie d'une liste de LIGNES DE BONUS. Le HUD lit ce payout pour, au versement,
// afficher BRIÈVEMENT chaque bonus en or à la place du « bleu × orange » dans le
// verre score (cf. renderer/hud.ts → drawPayoutBonus). Le total monte via le ticker.
//
// AJOUTER UN NOUVEAU BONUS À L'AVENIR = pousser une PayoutLine `kind:"bonus"` dans
// endOfTurn (engine/state/turn.ts). Rien d'autre à toucher : le HUD itère sur les
// lignes `bonus`. Donne juste un `label` court SANS ACCENT (police DMD 5×7).
//
// Contraintes d'affichage (verre DMD étroit, ~10 caractères par ligne) :
//   • label : MAJUSCULES, sans accent, court
//   • amount : entier de points ajoutés au total par cette ligne

// Catégorie d'une ligne — distingue le cœur du versement des bonus.
// `base`  = le score « bleu × orange » du tour (le verre score le montre déjà en live).
// `bonus` = bonus forfaitaire (œufs restants, tableau vide, futurs bonus…) → affiché
//           brièvement en or dans le verre score au moment où on l'obtient.
export type PayoutKind = "base" | "bonus";

export interface PayoutLine {
  kind: PayoutKind;
  label: string;     // libellé court DMD (MAJUSCULES, sans accent)
  amount: number;    // points ajoutés au total par cette ligne
}

// Le versement complet d'un tour : la liste des lignes (base + bonus) pour l'affichage
// DMD, et le `total` réellement crédité au score. NB : le total n'est PAS la somme des
// lignes — il vaut (bleu + bonus) × multiplicateur orange (cf. state/turn.ts) ; les
// lignes `bonus` portent leur montant BRUT (avant × orange) pour l'affichage.
export interface ScorePayout {
  lines: PayoutLine[];   // base + bonus, dans l'ordre d'obtention (affichage uniquement)
  total: number;         // ce qui s'ajoute réellement au score ce tour
}
