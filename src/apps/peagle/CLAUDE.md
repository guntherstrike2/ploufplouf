# Peagle 98 — Instructions spécifiques

Respecte les invariants de la boucle de jeu à 60 FPS et mets à jour le changelog à chaque changement visible.

## Changelog obligatoire

**Chaque changement visible (feature, fix, tweak) doit être documenté dans `components/PatchNotes.tsx`.**

- Ajoute une entrée en tête de liste avec la prochaine version (incrément de patch `0.x.y+1`, ou mineur si feature significative)
- Format : `{ version: "0.x.y", date: "YYYY-MM-DD", changes: ["..."] }`
- Une ligne par changement, ton neutre, en français
- Ne pas regrouper plusieurs sessions en une seule entrée

## Architecture — règle fondamentale

Le jeu tourne à **60 FPS via `requestAnimationFrame`**. La boucle physique (`engine/`) ne doit **jamais** toucher à React state — uniquement muter le ref `GameState`.

```
engine/          ← pure TS, zéro React, zéro audio direct
renderer/        ← lecture seule du GameState, dessine sur canvas
hooks/           ← pont rAF ↔ React + entrées pointer + events audio
components/      ← UI React (menus, HUD, overlays)
```

## Engine

### State (`engine/state/`)

- `init.ts` — construit l'état initial d'un niveau ; c'est ici qu'on applique les upgrades (`effectiveBallRadius`, `effectiveAimLength`, etc.)
- `tick.ts` — orchestrateur par frame, appelle ball/bucket/pegs/particles/effects
- `ball.ts` — physique, collisions, scoring ; logique spéciale des types de pegs ici
- `turn.ts` — fin de tour (win/lose/level suivant)
- `balance.ts` — **seul endroit pour tweaker le game feel** (combos, scores, trauma, slow-mo)
- `constants.ts` — paramètres physiques (gravity, bounces) ; ne pas éparpiller ces valeurs

### Procédural (`engine/levels.ts`, `difficulty.ts`, `tableau.ts`, `rng.ts`)

- Toute génération doit passer par `mulberry32` (PRNG seeded) pour rester **déterministe**
- Nouveau motif → fonction builder dans `levels.ts` utilisant les helpers de `tableau.ts`
- Courbe de difficulté → `difficulty.ts` uniquement, jamais inline dans `levels.ts`

### Events (`engine/events.ts`)

Ne déclenche jamais de son depuis `engine/`. Émets un `PeagleEvent` — `useGameLoop.ts` l'intercepte et le passe à `usePeagleSounds`.

## Renderer (`renderer/`)

- `drawFrame()` dans `index.ts` orchestre tout — n'appelle jamais un sous-renderer depuis ailleurs
- Toutes les fonctions prennent `(ctx, state, theme)` — **aucun side effect**
- Couleurs via `game-theme.ts` / `theme.ts`, jamais hardcodées dans un renderer
- Polices : Press Start 2P (pixel) et VT323 (scores/UI) — pas de polices système

## Extension points

**Nouvel upgrade** — déclare dans `engine/roguelite.ts`, applique via une valeur `effective*` dans `engine/state/init.ts` (ou branche dans `ball.ts`), affiche dans `components/UpgradePicker.tsx`.

**Nouveau type de peg** — déclare dans `engine/peg-kinds.ts`, collision dans `engine/state/ball.ts`, rendu dans `renderer/pegs.ts`, couleurs dans `engine/game-theme.ts`.

**Nouveau motif de niveau** — fonction builder dans `engine/levels.ts` via les helpers `tableau.ts`, enregistre dans `buildLevel()`. Valide : min orange pegs respecté, pas de cluster inatteignable.

## Audio

- Sons de jeu → `hooks/usePeagleSounds.ts`
- Musique adaptative (calm/fever/game-over) → `hooks/useMusic.ts` ; les tracks changent selon `gamePhase`
- **Ne jamais appeler l'audio depuis `engine/`** — toujours via events → `useGameLoop`

## API & DB

- Scores : `POST /api/peagle/scores` (auth requise, rate-limit 20/min, max 999 999 points)
- Leaderboard : `GET /api/peagle/scores` (top 10, best score par user)
- Annonces : `GET/POST/DELETE /api/peagle/announcements` (POST/DELETE = admin only)
- Schema DB dans `src/lib/db/schema.ts` (`peagleScores`, `peagleAnnouncements`)

## Styling

- Tokens Peagle dans `styles.ts` — utiliser ces variables, pas les tokens globaux GunthOS pour les couleurs internes au jeu
- Layout responsive dans `peagle.css` : vertical (mobile) vs horizontal (16:9)
- **Pas de classes Tailwind à l'intérieur du canvas** — tout passe par l'API Canvas 2D

## DevPanel

`components/DevPanel.tsx` est réservé aux admins (`user.role === "admin"`). Pour tester les cas limites (clutch, board clear, level skip), utilise le DevPanel — ne modifie jamais le code à titre temporaire pour déboguer.
