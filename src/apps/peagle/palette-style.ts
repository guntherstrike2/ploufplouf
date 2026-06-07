// ─── Peagle 98 — Injection des variables CSS de la palette ────────────────────
//
// Pose une fois, au runtime, le bloc `.peagle-root { --pg-…: … }` généré depuis
// engine/palette.ts (source unique). Importé en side-effect par les composants
// Peagle (à côté de `import "../peagle.css"`), donc présent quel que soit le
// point d'entrée (OS ou route /peagle directe), et idempotent.
//
// Pourquoi pas dans peagle.css ? Le canvas de jeu lit la palette en TS et ne
// peut pas lire les variables CSS. Garder la définition en TS et faire dériver
// le CSS d'ici = une seule vérité, aucune redérive entre UI et canvas.

import { pgCssText } from "./engine/palette";

const STYLE_ID = "peagle-palette-vars";

if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = pgCssText();
  document.head.appendChild(style);
}
