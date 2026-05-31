# Peagle 98 — Guide d'extension roguelite

Ce squelette est volontairement minimal : un Peggle vanilla avec une boucle
roguelite (clear le niveau → choisis 1 upgrade → niveau suivant). Tout est
prévu pour que tu **rajoutes tes propres idées** sans toucher à l'architecture.

> 💡 La version riche d'origine (classes, reliques, boss, bombes, thèmes…) est
> conservée dans le tag git **`peagle-full`** — `git show peagle-full:...` pour
> piocher de l'inspiration ou récupérer du code.

---

## 1. Architecture en 30 secondes

```
engine/        ← logique PURE (aucun React, aucun audio). Testable, déterministe.
  state/       ← la machine d'état du jeu, découpée par responsabilité
    init.ts    ← construit un GameState neuf (applique les upgrades)
    tick.ts    ← 1 frame : oriente vers ball/bucket/particles/turn
    ball.ts    ← physique + collisions + scoring de l'œuf (le cœur du gameplay)
    turn.ts    ← fin de tour : gagné / perdu / niveau suivant
    bucket.ts  ← mouvement du panier
    pegs.ts    ← animations de pegs
    particles.ts, effects.ts ← juice
  physics.ts   ← maths de collision pures + ligne de visée
  levels.ts    ← génération procédurale (motifs + Poisson + validation)  ⭐ #3
  difficulty.ts← courbe de difficulté du run (tout est fn(level))
  rng.ts       ← PRNG seedé déterministe (mulberry32) + helpers
  peg-kinds.ts ← table data-driven des types de pegs/objets  ⭐ POINT D'EXTENSION #4
  tableau.ts   ← boîte à outils pour dessiner des layouts (grilles, arcs, pixel-art)
  roguelite.ts ← upgrades + run state  ⭐ POINT D'EXTENSION #1
  types.ts     ← types de données (Peg, GameState, …)
  game-theme.ts← couleurs du canvas
  balance.ts   ← toutes les valeurs d'équilibrage
  constants.ts ← dimensions, gravité, vitesses
  events.ts    ← événements émis par le moteur (sons, level-won, …)
renderer/      ← dessin PUR sur le canvas (lit le GameState, ne le modifie pas)
components/    ← UI React (HUD, menu, picker d'upgrade, dialogues, dev panel)
hooks/
  useGameLoop.ts ← le pont : boucle rAF, input souris/tactile, sync UI
  useMusic.ts
index.tsx      ← orchestration des écrans (menu / game / leaderboard)
```

**Principe d'or :** le `GameState` vit dans un `useRef`, **pas** dans un
`useState` (sinon 60 re-renders/s tueraient les perfs). Le moteur muté chaque
frame émet des `events` ; le hook les traduit en sons / changements d'écran.
Garde cette séparation : mets la **logique** dans `engine/`, le **dessin** dans
`renderer/`, et l'**UI** dans `components/`.

---

## 2. ⭐ Ajouter une upgrade (le plus courant)

Fichier : [`engine/roguelite.ts`](engine/roguelite.ts).

### Étape 1 — déclare l'id et l'entrée

```ts
export type UpgradeId =
  | "extra_ball" | "heavy_ball" | "bigger_ball" | "sharp_aim"
  | "double_points";  // ← nouveau

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  // … existants …
  double_points: { id: "double_points", name: "Double mise", desc: "Tous les points sont ×2." },
};
```

C'est **tout** ce qu'il faut pour qu'elle apparaisse dans le picker entre niveaux
(`generateUpgradeOffer` la propose automatiquement).

### Étape 2 — applique son effet

Selon le type d'effet, choisis le bon endroit :

| Type d'effet | Où l'appliquer |
|---|---|
| Valeur de départ (œufs, rayon, rebond, visée…) | [`engine/state/init.ts`](engine/state/init.ts) via un champ `effective*` |
| Effet pendant le tir (scoring, collision, rebonds) | [`engine/state/ball.ts`](engine/state/ball.ts) |
| Effet en fin de niveau (bonus, soin…) | [`engine/state/turn.ts`](engine/state/turn.ts) |

Exemple pour `double_points` (effet de scoring → `ball.ts`), le run expose
`s.runUpgrades` :

```ts
// dans ball.ts, calcul du score :
const upgradeMult = s.runUpgrades.includes("double_points") ? 2 : 1;
const earned = Math.round(basePoints * totalMult * upgradeMult);
```

Exemple pour une upgrade "valeur de départ" (modèle des 4 existantes), dans
`init.ts` :

```ts
const effectiveBallR = BALL_R * (upgrades.includes("bigger_ball") ? 1.3 : 1);
```

> Les 4 upgrades fournies sont des modèles : lis-les, copie le pattern.

---

## 3. ⭐ La génération de niveaux (aléatoire seedé, structuré, validé)

Fichier : [`engine/levels.ts`](engine/levels.ts). La génération n'est plus un
cycle de layouts fixes : c'est un **pipeline procédural déterministe**.

```
seed = f(niveau)            ← rng.ts (mulberry32). Reproductible, debuggable.
  → 1-2 MOTIFS piochés      ← squelette « qui a l'air voulu » (grille hex, anneaux…)
  → remplissage POISSON     ← blue noise miroir : dense mais jamais collé/aggloméré
  → DIFFICULTÉ              ← difficulty.ts : densité / % oranges / bumpers / jitter
  → ASSIGNATION des kinds   ← système data-driven (peg-kinds.ts)
  → VALIDATION (aim line)   ← generate-and-test : re-roll si trop peu atteignable
```

**Ajouter un motif** = écrire un builder `(rng, area) => Peg[]` (utilise
`tHexGrid`, `tGrid`, `tCircle`, `tArc`, `tLine`, `tPixelArt`, `makePeg`,
`dedup` de [`tableau.ts`](engine/tableau.ts)) puis le référencer dans `MOTIFS`.
**Tire ton aléatoire du `rng` fourni, jamais de `Math.random()`** (sinon tu
casses le déterminisme et la validation). Reste centré/symétrique quand tu peux.

```ts
function motifSmiley(rng: Rng, a: Area): Peg[] {
  const face = ["011111110","100000001","101000101","100000001","100111001","011111110"];
  return tPixelArt(face, 26, 24, a.cx - 104, a.y0 + randInt(rng, 0, 20));
}
const MOTIFS = [motifHexField, motifRings, /* … */, motifSmiley]; // ←
```

**Régler la difficulté** (densité, % oranges, nb de bumpers, jitter au fil du
run) → [`engine/difficulty.ts`](engine/difficulty.ts), tout est une fonction de
`level` avec des `clamp` pour éviter les fins de run injouables.

---

## 4. ⭐ Ajouter un type d'objet/peg (data-driven)

Le système est **piloté par une table** : la collision lit `PEG_KINDS[p.kind]`,
pas une chaîne de `if`. Le `bumper` (obstacle permanent qui renvoie l'œuf avec
un kick) en est le 1er exemple — copie son entrée pour les 90 % de cas.

Exemple : un peg **vert** qui donne un œuf bonus quand on le touche.

1. **Déclare le kind + sa définition** — [`engine/peg-kinds.ts`](engine/peg-kinds.ts) :
   ```ts
   export type PegKind = "normal" | "orange" | "bumper" | "green";  // + green
   export const PEG_KINDS = {
     /* … */
     green: { destructible: true, isTarget: false, bounceMult: 1, impulse: 0,
              baseScore: 25, freezeFrames: 4, trauma: 0.08, flash: 0.2,
              particles: 12, hotParticles: false, sound: "pop", cooldownFrames: 0 },
   };
   ```
   C'est **tout** pour le comportement de base (score, rebond, juice, destructible
   ou non, cible ou non). Pour le `kick` d'un obstacle → `impulse`.

2. **Couleur** — [`engine/game-theme.ts`](engine/game-theme.ts) : ajoute des
   champs `green*` (optionnels) à `PegTheme`, comme `bumper*`.

3. **Rendu** — [`renderer/pegs.ts`](renderer/pegs.ts) : une branche
   `else if (p.kind === "green")` + un `drawGreenPeg` (copie `drawNormalPeg`).

4. **Effet vraiment spécial seulement** — [`engine/state/ball.ts`](engine/state/ball.ts) :
   si l'effet dépasse la table (donner un œuf, explosion en chaîne…), une petite
   branche keyée par `kind`, après l'application des effets génériques :
   ```ts
   if (p.kind === "green") { s.balls += 1; /* + texte flottant */ }
   ```

5. **Placement** — la difficulté ([`engine/difficulty.ts`](engine/difficulty.ts))
   décide combien en poser ; l'assignation se fait dans `assignKinds`
   ([`engine/levels.ts`](engine/levels.ts)), sur le modèle des bumpers.

> `destructible:false` = obstacle permanent (bumper) : pas de pop, `cooldownFrames`
> contre le spam, animation via `p.bump`/`p.scale`. `isTarget:true` = compte dans
> la condition de victoire (orange).
>
> Astuce : le tag `peagle-full` contient bombes, armor, warp, boss complets —
> `git show peagle-full:src/apps/peagle/engine/state/ball.ts`.

---

## 5. Mode dev (admins)

Réservé aux admins (`/api/admin/check`). Bouton **⚙ DEV TOOLS** sur le menu et
**⚙ / ⏭** dans le HUD en jeu. Panneau : [`components/DevPanel.tsx`](components/DevPanel.tsx).

Options : œufs infinis (god mode), afficher les hitboxes, niveau de départ,
override du `%` d'oranges, upgrades de départ. La config (`DevConfig`) est
passée à `useGameLoop` via `devConfigRef` et appliquée dans `resetGame` +
la boucle rAF.

**Pour ajouter un réglage dev :** ajoute un champ à `DevConfig` +
`DEFAULT_DEV_CONFIG`, un contrôle dans le JSX du `DevPanel`, puis applique-le
dans [`hooks/useGameLoop.ts`](hooks/useGameLoop.ts) (god mode/hitboxes y sont
déjà comme modèles).

---

## 5 bis. Galerie d'assets (choisir le visuel)

App admin dédiée **Galerie Peagle** (slug `peagle-gallery`), ouvrable depuis le
DevPanel (bouton 🎨). Elle affiche en aperçu toutes les variantes de chaque
catégorie (pegs, arrière-plan, oiseau, panier) ; un clic applique le choix
**en live** dans la partie en cours et le **persiste** (localStorage).

Tout part de [`engine/assets.ts`](engine/assets.ts) — la source unique :

- Les variantes vivent dans `PEG_PALETTES`, `BACKGROUNDS`, `BIRD_SPRITES`,
  `BUCKET_STYLES`.
- La sélection active est mise en cache (singleton de module partagé entre la
  Galerie et le jeu → mise à jour instantanée).
- Le renderer lit la variante active via `getActivePegPalette()` /
  `getActiveBackground()` / `getActiveBird()` / `getActiveBucket()`
  (`resolveTheme()` compose pegs + fond ; l'oiseau et le panier sont lus dans
  `renderer/ui.ts`).

**Ajouter une variante** = ajouter une entrée dans le bon tableau. Exemple,
un nouvel oiseau :

```ts
// engine/assets.ts → BIRD_SPRITES
{ id: "mouette", name: "Mouette", value: {
  grid: ["...y.y...", /* … 9 lignes pixel-art … */],
  palette: { w: "#ffffff", g: "#cccccc", y: "#ffcc00" },
} },
```

La Galerie l'affiche automatiquement (elle se construit depuis les tableaux).
Pour une **nouvelle catégorie d'asset**, ajoute son type + tableau + getter +
entrée dans `ASSET_CATEGORIES`, puis une section dans
[`peagle-gallery/index.tsx`](../peagle-gallery/index.tsx) et la lecture côté
renderer.

> Workflow : tu testes les variantes dans la Galerie, tu gardes celles qui te
> plaisent, et on supprime les autres du registre.

---

## 6. Réglages rapides (sans nouveau code)

- **Équilibrage** (points, screenshake, combo, particules) →
  [`engine/balance.ts`](engine/balance.ts)
- **Constantes** (gravité, vitesse de tir, taille panier, œufs de départ,
  seuil de fièvre) → [`engine/constants.ts`](engine/constants.ts)
- **Sons** émis par le moteur → ajoute un `SoundId` dans
  [`engine/events.ts`](engine/events.ts) puis branche-le dans `handleEvent`
  de [`hooks/useGameLoop.ts`](hooks/useGameLoop.ts).

---

## 7. Checklist après modif

```bash
pnpm typecheck   # signal de correction principal (pas de tests)
pnpm lint
```

Garde le moteur **pur** (pas d'import React/DOM dans `engine/`) : c'est ce qui
rend le jeu facile à étendre et à débugger.
