// ─── Polices canvas alignées sur la DA ───────────────────────────────────────
// Le reste du jeu (menus, boutons, HUD DOM) s'affiche en Press Start 2P /
// VT323 (cf. peagle.css : --pg-font / --pg-font-ui), mais le canvas dessinait
// tout en "MS Sans Serif" — d'où des textes hors-charte. On résout ici les noms
// de familles générés par next/font (exposés via variables CSS) pour pouvoir les
// passer à ctx.font. Tant que la fonte n'est pas prête, on retombe sur monospace
// (le canvas ne déclenche pas le chargement lui-même → fallback silencieux sinon).

let _display: string | null = null; // Press Start 2P — exclamations / hype
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

/** Police « hero » arcade (Press Start 2P) — exclamations de combo, bannières. */
export function pgDisplayFont(size: number): string {
  if (_display === null || _display === "pending") {
    const r = resolve("--font-press-start", "");
    if (!r) { _display = "pending"; return `${size}px "Courier New", monospace`; }
    _display = `${r}, "Courier New", monospace`;
  }
  return `${size}px ${_display}`;
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
