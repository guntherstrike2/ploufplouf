// ─── Polices canvas alignées sur la DA ───────────────────────────────────────
// Le canvas dessine les scores chiffrés « +N » en VT323 (cf. peagle.css :
// --pg-font-ui) via ctx.font. On résout ici le nom de famille généré par next/font
// (exposé en variable CSS). Tant que la fonte n'est pas prête, on retombe sur
// monospace (le canvas ne déclenche pas le chargement → fallback silencieux sinon).
//
// NB : le texte HYPE (combos/exclamations, ex-Press Start 2P) est passé en police
// BITMAP (renderer/text-bitmap.ts) → il ne dépend plus du CSS du tout.

let _ui: string | null = null;      // VT323 — scores chiffrés compacts

function resolve(varName: string, fallback: string): string {
  if (typeof document === "undefined" || !document.body) return fallback;
  const raw = getComputedStyle(document.body).getPropertyValue(varName).trim();
  if (!raw) return fallback;
  // Précharge les tailles courantes pour que les glyphes soient dispo au prochain draw.
  try {
    const f = document.fonts;
    if (f) { f.load(`16px ${raw}`); f.load(`28px ${raw}`); }
  } catch {}
  return raw;
}

/** Police UI compacte (VT323) — scores chiffrés « +N », lisibles en dense. */
export function pgUiFont(size: number): string {
  if (_ui === null || _ui === "pending") {
    const r = resolve("--font-vt323", "");
    if (!r) { _ui = "pending"; return `${size}px monospace`; }
    _ui = `${r}, monospace`;
  }
  return `${size}px ${_ui}`;
}
