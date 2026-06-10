// ─── Peagle 98 — Palette (source unique de vérité) ───────────────────────────
//
// Une seule définition des couleurs pour TOUT Peagle : l'UI React (menus,
// overlays, HUD via les variables CSS --pg-*) ET le canvas de jeu (assets.ts,
// renderer/*). Le canvas ne peut pas lire les variables CSS (il dessine avec des
// strings "#hex") → la palette vit donc en TypeScript, et le CSS en dérive via
// `cssVars()` injecté au runtime (cf. palette-style.ts).
//
// Deux niveaux :
//   • RAMP  = couleurs brutes, échelles clair→sombre par teinte.
//   • ROLE  = rôles sémantiques (surface, accent, texte…) pointant vers la RAMP.
//
// Pour reworker l'identité visuelle : changer RAMP/ROLE ici, rien ailleurs.
// Charte « Bosquet » : pixel art forêt, verts désaturés profonds + or chaud.

// ─── Rampes brutes ───────────────────────────────────────────────────────────
// Échelle façon design-token : 50 = le plus clair, 900 = le plus sombre.

export const RAMP = {
  // Vert forêt — teinte dominante. Charte « Forêt chaleureuse » : teinte décalée
  // vers le jaune-vert (~95-100°) pour baigner dans la même lumière dorée que le
  // soleil du jeu. Sat ~55-65%, luminosité quasi inchangée vs l'ancienne rampe.
  green: {
    50:  "#dcf5b6", // texte clair sur fond sombre (un poil plus chaud)
    100: "#c6e2a0",
    200: "#b4ec6a", // accent clair (hover CTA)
    300: "#9ee04e", // feuille / accent secondaire
    400: "#8fd83e", // ACCENT principal (CTA) — vert présent dans le décor
    500: "#66a234", // arête claire des biseaux (bevel-hi)
    600: "#56922a",
    700: "#447e16",
    750: "#34561f", // filet de séparation / bordure
    800: "#213e10", // surface secondaire (boutons)
    850: "#142208", // surface (panneau)
    900: "#0c1705", // fond
    950: "#070f03", // fond profond (quasi-noir)
    ink: "#060d02", // contour net
    bevelLo: "#0c1d07", // arête sombre des biseaux
  },
  // Or chaud — victoire, records, ornements lux.
  gold: {
    100: "#ffe870",
    300: "#ffd24a", // or principal
    600: "#b08010",
    700: "#604010", // accent bas des en-têtes lux
  },
  // Orange — cibles, danger doux.
  orange: {
    300: "#ffb066", // glow
    400: "#ff8a3c", // base
    600: "#cc4f12", // deep
  },
  // Violet — rareté épique.
  purple: {
    200: "#e0b4ff", // texte/icône sur surface violette
    300: "#d088ff", // nom épique (texte clair)
    400: "#cc66ff", // base
    600: "#7a3fb0", // bordure
    900: "#2a1437", // surface sombre
  },
  // Bleu — rareté « rare » (convention de jeu, hors palette forêt).
  blue: {
    300: "#7ab0ff", // nom rare (texte clair)
    400: "#4488ff", // base / bordure rare
  },
  // Neutres / divers
  cream: "#f2e6c2", // encre / titres
  red:   "#ff5544", // game over
  textMuted: "#88a86c",
} as const;

// ─── Rôles sémantiques ───────────────────────────────────────────────────────
// Ce que consomment l'UI et le canvas. Un composant dit « je suis `accent` »,
// pas « je suis #7ed13a ». Re-thémer = repointer ces rôles.

export const ROLE = {
  bgDeep:   RAMP.green[950],
  bg:       RAMP.green[900],
  surface:  RAMP.green[850],
  surface2: RAMP.green[800],
  ink:      RAMP.green.ink,
  bevelHi:  RAMP.green[500],
  bevelLo:  RAMP.green.bevelLo,
  border:   RAMP.green[750],

  accent:    RAMP.green[400],
  accentHi:  RAMP.green[200],
  accentDeep:RAMP.green[700],
  leaf:      RAMP.green[300],
  leafDim:   RAMP.green[600],

  text:      RAMP.green[50],
  textMuted: RAMP.textMuted,
  cream:     RAMP.cream,

  gold:      RAMP.gold[300],
  goldDark:  RAMP.gold[700],
  orange:     RAMP.orange[400],
  orangeGlow: RAMP.orange[300],
  orangeDeep: RAMP.orange[600],
  red:        RAMP.red,

  purple:        RAMP.purple[400],
  purpleHi:      RAMP.purple[200],
  purpleSurface: RAMP.purple[900],
  purpleBorder:  RAMP.purple[600],

  // Raretés (cartes d'upgrade, badges) — convention commune CSS + inline.
  rarityCommon:   RAMP.green[300],   // vert feuille
  rarityRare:     RAMP.blue[400],
  rarityRareText: RAMP.blue[300],
  rarityEpic:     RAMP.purple[400],
  rarityEpicText: RAMP.purple[300],

  // En-tête de panneau (bande forêt sombre) — dérivée de la rampe réchauffée.
  headFrom: RAMP.green[800],   // haut de la bande de titre
  headMid:  "#16300d",         // milieu
  headTo:   "#0d1d08",         // bas (filet sombre)

  // Fonds dégradés verticaux « sous-bois » partagés par les panneaux/zones de
  // jeu. Dérivés de la rampe → restent harmonieux si on retouche la palette.
  // surface (haut) → bg → bgDeep (bas).
  backdropTop: RAMP.green[850],
  backdropMid: "#0e1c08",
  backdropBot: RAMP.green[950],
  backdropDeep: "#050b03", // un cran sous bgDeep pour les fonds 4-stops
} as const;

// ─── Textes d'impact (canvas) : score, badges, hype de combo ─────────────────
// Toutes les couleurs des textes flottants dérivent ici de la palette « Bosquet »
// pour rester dans la lumière dorée du jeu (avant : couleurs arcade hardcodées —
// cyan #00ffcc, rose #ff4d6b — qui juraient avec la forêt vert-or).
//
// HYPE = escalade par palier de combo : on monte « du feuillage vers l'or », puis
// orange chaud, et seul le palier LÉGENDE bascule en violet épique (rareté).

export const TEXT_FX = {
  // Score « +N » discret près du peg.
  score:    ROLE.text,        // vert clair
  scoreMul: RAMP.gold[300],   // le ×N de combo, doré (cf. drawScoreText)

  // Or (jackpot, bonus de fin, séries). On remplace #ffd700 / #ffec80 / #00ffcc.
  gold:     RAMP.gold[300],
  goldHi:   RAMP.gold[100],
  // Bonus « positifs » (œuf sauvé, +1 œuf, bonus œufs) — anciennement cyan néon,
  // désormais vert feuille lumineux : reste « gain » sans casser la forêt.
  boon:     RAMP.green[200],
  // Événements « clutch » (dernière proie) — bleu rare conventionnel, conservé
  // mais aligné sur la rampe blue de la palette plutôt qu'un bleu ad hoc.
  clutch:   RAMP.blue[300],
  // Tableau vidé — éclat blanc cassé chaud (cream) au lieu du blanc pur.
  clear:    RAMP.cream,

  // Escalade hype (tier 0..5) en couleurs CROISSANTES : vert foncé → vert clair →
  // orange (de plus en plus chaud). Le sommet « FOU » (tier 5) clignote entre vert
  // et orange — ce clignotement est calculé dans le renderer (drawHypeTexts), la
  // couleur posée ici n'est qu'un repli statique.
  hype: [
    RAMP.green[600],  // tier 0 — vert foncé (début de chaîne)
    RAMP.green[300],  // tier 1 — vert clair
    RAMP.orange[300], // tier 2 — orange
    RAMP.orange[400], // tier 3 — orange vif
    RAMP.orange[600], // tier 4 — orange chaud profond
    RAMP.green[300],  // tier 5 — FOU : clignote vert↔orange (cf. renderer)
  ] as readonly string[],

  // Couleurs du clignotement « FOU » (tier 5) : on alterne entre ces deux teintes.
  hypeCrazyA: RAMP.green[300],   // vert clignotant
  hypeCrazyB: RAMP.orange[400],  // orange clignotant

  // Dégradé doré appliqué au CORPS des mots hype (clair → or → chaud profond).
  // Look « métal précieux » au lieu d'un aplat. Utilisé par le renderer.
  hypeGradTop: RAMP.gold[100],
  hypeGradMid: RAMP.gold[300],
  hypeGradBot: RAMP.orange[600],
} as const;

// ─── Dégradés réutilisables ──────────────────────────────────────────────────
// Construits depuis ROLE → harmonie garantie. Exposés en variables CSS.

export const GRADIENT = {
  // En-tête de fenêtre/panneau (bande de titre).
  header: `linear-gradient(to bottom, ${ROLE.headFrom} 0%, ${ROLE.headMid} 55%, ${ROLE.headTo} 100%)`,
  // Fond « sous-bois » 3 stops (zones de jeu).
  backdrop3: `linear-gradient(to bottom, ${ROLE.backdropTop} 0%, ${ROLE.backdropMid} 50%, ${ROLE.backdropBot} 100%)`,
  // Fond « sous-bois » 4 stops (panneaux latéraux, zone canvas).
  backdrop4: `linear-gradient(to bottom, ${ROLE.backdropTop} 0%, ${ROLE.backdropMid} 30%, ${ROLE.backdropBot} 70%, ${ROLE.backdropDeep} 100%)`,
  // Boutons : ombrage 2-3 bandes hard-stop (look sprite, pas de flou).
  btnPrimary: `linear-gradient(to bottom, ${ROLE.accentHi} 0 45%, ${ROLE.accent} 45% 72%, ${ROLE.accentDeep} 72% 100%)`,
  btnDanger:  `linear-gradient(to bottom, ${ROLE.orangeGlow} 0 45%, ${ROLE.orange} 45% 72%, ${ROLE.orangeDeep} 72% 100%)`,
} as const;

// ─── Décor de scène (panneaux latéraux DOM — SidePanel) ──────────────────────
// Petit décor forêt animé en DOM, distinct du canvas mais qui doit s'harmoniser
// avec lui. Jour = rampe verte chaude + soleil or ; fièvre = indigo/violet
// (cohérent avec la palette fever du canvas). Tout dérive de RAMP/ROLE.

export const DECOR = {
  day: {
    // Ciel dégradé haut → sol (5 stops).
    sky: `linear-gradient(to bottom, ${RAMP.green[800]} 0%, #1c3412 25%, #112208 55%, ${RAMP.green[900]} 80%, ${RAMP.green[950]} 100%)`,
    // Feuillages d'arbres (tiers clair → sombre) — repris de la charte décor.
    foliage: ["#2a8a26", "#3a9a2e", "#246e1e", "#1e6418", "#327a22"],
    trunk:   "#2a1c0c",
    ground:  "#3a7a1e",  // sol (= subGround décor)
    grass:   RAMP.green[400], // brins d'herbe = accent
    mist:    "rgba(46,90,20,0.35)",
    // Soleil chaud (cohérent avec le soleil du canvas).
    sun:     "rgba(255,225,90,0.88)",
    sunGlow: "rgba(255,200,50,0.45)",
    sunRay:  "rgba(255,215,60,0.65)",
    firefly:     "#b4ec6a",      // = accentHi
    fireflyGlow: "rgba(120,220,60,0.5)",
  },
  fever: {
    sky: `linear-gradient(to bottom, #08061e 0%, #120840 25%, #0a0824 55%, #07061c 80%, ${RAMP.green[950]} 100%)`,
    foliage: ["#0c0c2e", "#0e1450", "#0a0e38", "#10165e", "#0c1042"],
    trunk:   "#080828",
    ground:  "#080820",
    grass:   "#1a1a4a",
    mist:    "rgba(60,40,140,0.30)",
    // « Lune » fever (corps céleste violet pâle).
    sun:     "rgba(210,190,255,0.88)",
    sunGlow: "rgba(180,150,255,0.45)",
    sunRay:  "rgba(150,120,200,0.5)",
    firefly:     RAMP.purple[400],
    fireflyGlow: "rgba(180,80,255,0.5)",
  },
} as const;

// ─── Génération des variables CSS --pg-* ─────────────────────────────────────
// Produit la déclaration `.peagle-root { --pg-…: … }`. Injectée une fois au
// runtime (cf. palette-style.ts) pour que CSS et canvas partagent EXACTEMENT
// les mêmes valeurs — aucune duplication, aucune redérive possible.
//
// Seules les variables COULEUR sont générées ici. Les variables structurelles
// (biseaux, clip-path, drop-shadow, polices) restent dans peagle.css car elles
// composent ces couleurs via var() et ne sont pas du ressort de la palette.

export function pgColorVars(): Record<string, string> {
  return {
    "--pg-bg-deep":  ROLE.bgDeep,
    "--pg-bg":       ROLE.bg,
    "--pg-surface":  ROLE.surface,
    "--pg-surface-2":ROLE.surface2,
    "--pg-ink":      ROLE.ink,
    "--pg-bevel-hi": ROLE.bevelHi,
    "--pg-bevel-lo": ROLE.bevelLo,
    "--pg-border":   ROLE.border,

    "--pg-orange":      ROLE.orange,
    "--pg-orange-glow": ROLE.orangeGlow,
    "--pg-orange-deep": ROLE.orangeDeep,
    "--pg-green":       ROLE.accent,
    "--pg-green-hi":    ROLE.accentHi,
    "--pg-green-deep":  ROLE.accentDeep,
    "--pg-leaf":        ROLE.leaf,
    "--pg-leaf-dim":    ROLE.leafDim,
    "--pg-cream":       ROLE.cream,
    "--pg-gold":        ROLE.gold,
    "--pg-red":         ROLE.red,
    "--pg-purple":         ROLE.purple,
    "--pg-purple-hi":      ROLE.purpleHi,
    "--pg-purple-surface": ROLE.purpleSurface,
    "--pg-purple-border":  ROLE.purpleBorder,
    "--pg-rarity-rare":    ROLE.rarityRare,
    "--pg-gold-dark":      ROLE.goldDark,

    "--pg-head-from": ROLE.headFrom,
    "--pg-head-to":   ROLE.headTo,

    // Dégradés harmonisés (en-têtes + fonds sous-bois).
    "--pg-grad-header":    GRADIENT.header,
    "--pg-grad-backdrop":  GRADIENT.backdrop3,
    "--pg-grad-backdrop4": GRADIENT.backdrop4,

    // Compat : anciens noms (biseaux / cyan) — pointent vers les mêmes rôles.
    "--pg-hi":       ROLE.bevelHi,
    "--pg-sh":       ROLE.bevelLo,
    "--pg-cyan":     ROLE.leaf,
    "--pg-cyan-dim": ROLE.leafDim,

    "--pg-text":       ROLE.text,
    "--pg-text-muted": ROLE.textMuted,
  };
}

/** Bloc CSS prêt à injecter : `.peagle-root { --pg-…: …; }`. */
export function pgCssText(): string {
  const body = Object.entries(pgColorVars())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `.peagle-root {\n${body}\n}`;
}
