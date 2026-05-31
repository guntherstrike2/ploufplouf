# Architecture cible — Peagle

> Objectif : **un coeur de jeu pur, data-driven et piloté par événements**,
> entouré de couches fines (rendu, son, React) branchées par interfaces.
> Tout est pensé pour empiler un rogue-lite sans toucher au coeur.

## 1. Principe : 4 couches, dépendances à sens unique

```
┌─────────────────────────────────────────────────────────────┐
│ 4. React / UI      (index.tsx, écrans, HUD, picker)          │
│    - possède le cycle de vie, les écrans, les inputs souris   │
│    - NE contient AUCUNE règle de jeu                          │
└───────────────▲───────────────────────────▲──────────────────┘
                │ lit l'état (snapshot)       │ envoie des inputs
┌───────────────┴──────────┐   ┌─────────────┴──────────────────┐
│ 3a. Renderer (canvas)    │   │ 3b. Audio (réactions events)    │
│    - dessine un snapshot │   │    - joue un son par event      │
│    - lit, ne mute jamais │   │    - lit events, ne mute jamais │
└───────────────▲──────────┘   └─────────────▲──────────────────┘
                │ snapshot d'état              │ flux d'events
┌───────────────┴──────────────────────────────┴────────────────┐
│ 2. Game Core (TypeScript pur — zéro React, zéro canvas)        │
│    step(state, input, dt) -> { state, events }                 │
│    physics · collisions · règles · scoring · phases            │
└───────────────▲────────────────────────────────────────────────┘
                │ utilise
┌───────────────┴────────────────────────────────────────────────┐
│ 1. Data / Content (data-driven, pas de logique)                 │
│    constantes · niveaux · types de pegs · upgrades · thèmes     │
└─────────────────────────────────────────────────────────────────┘
```

**Règle d'or des dépendances** : une couche ne dépend QUE des couches en
dessous. Le **Game Core ne connaît rien** au-dessus (ni React, ni canvas, ni
audio). Conséquence : il est **testable et simulable** sans navigateur.

## 2. Arborescence des fichiers

Nouveau dossier propre (table rase). On garde le slug `peagle` à la bascule
finale ; pendant le dev on peut travailler dans `peagle/` neuf une fois
l'ancien archivé, ou un dossier temporaire — voir roadmap.

```
src/apps/peagle/
  manifest.ts                 # AppManifest (slug, taille, audioChannels)
  index.tsx                   # Point d'entrée React : machine d'écrans + wiring

  core/                       # ── COUCHE 2 : coeur pur, zéro import React ──
    types.ts                  # GameState, Peg, Ball, GameEvent, Input, Config
    create.ts                 # createGame(config, level) -> GameState
    step.ts                   # step(state, input, dt) -> { state, events }  (orchestrateur)
    physics/
      vec.ts                  # maths vecteurs (add, scale, dot, len…)
      collide.ts              # collision cercle/cercle + cercle/mur (réponse rebond)
      ball.ts                 # intégration d'UNE balle sur un sous-pas
    systems/                  # règles découpées, chacune petite et testable
      aim.ts                  # calcul ligne de visée (simulation trajectoire)
      shoot.ts                # transition aim -> firing
      pegs.ts                 # résolution des hits de pegs (score, état touché)
      bucket.ts               # mouvement du seau + rattrapage
      turn.ts                 # fin de tour : nettoyage, victoire/défaite
      combo.ts                # gestion du multiplicateur de combo
    events.ts                 # type GameEvent (union discriminée) + helpers

  content/                    # ── COUCHE 1 : données, zéro logique ──
    config.ts                 # constantes physiques + équilibrage (gravité, vitesses…)
    levels.ts                 # définition data-driven des niveaux (layouts de pegs)
    layout.ts                 # petit DSL pur de placement (line, grid, arc) -> Peg[]
    pegTypes.ts               # registre des types de pegs (blue, orange) data-driven
    themes.ts                 # registre des thèmes (couleurs) — 1 thème en v1

  rogue/                      # ── EXTENSION rogue-lite (squelette v1) ──
    upgrades.ts               # registre data-driven des upgrades (1-2 exemples)
    run.ts                    # RunState (progression d'une run) + transitions
    offer.ts                  # génération d'une offre de 3 upgrades

  render/                     # ── COUCHE 3a : canvas, lit un snapshot ──
    draw.ts                   # drawFrame(ctx, snapshot, theme) : orchestre
    scene.ts                  # transform caméra (échelle, shake) + ordre de dessin
    drawPegs.ts / drawBall.ts / drawAim.ts / drawBucket.ts / drawFx.ts
    birds.ts                  # rendu lanceur oiseau à partir des données pixel-art

  audio/
    sfx.ts                    # mappe GameEvent -> son (via useSoundContext)

  assets/                     # ── pixel-art récupéré, en DONNÉES ──
    birds.ts                  # grilles + palettes des oiseaux (depuis skin.ts)
    icons.ts                  # sous-ensemble d'icônes data-driven (depuis PegIcon)

  ui/                         # ── COUCHE 4 : composants React ──
    GameCanvas.tsx            # <canvas> + ResizeObserver + boucle rAF
    Hud.tsx                   # score / balles / niveau / combo
    MainMenu.tsx              # menu
    UpgradePicker.tsx         # choix d'upgrade entre niveaux
    useGameLoop.ts            # hook : possède la rAF, appelle step(), pousse snapshot

  styles.ts                   # styles partagés (bevel Win98, etc.)
```

## 3. Modèle de données (coeur)

`core/types.ts` — tout est **sérialisable** (que des données, pas de
fonctions/refs dans l'état) pour permettre snapshot, debug, et plus tard
save/replay.

```ts
// Phase = machine à états explicite du tour
export type Phase = "aim" | "firing" | "won" | "lost";

export interface Vec { x: number; y: number; }

export interface Peg {
  id: number;
  pos: Vec;
  r: number;
  type: PegTypeId;        // "blue" | "orange" (extensible via content/pegTypes)
  hit: boolean;           // touché ce tour-ci (retiré en fin de tour)
  pop: number;            // 0..1 avancement animation de disparition
}

export interface Ball {
  id: number;
  pos: Vec;
  vel: Vec;
  r: number;
  trail: Vec[];           // court historique pour le rendu (taille bornée)
}

export interface GameState {
  phase: Phase;
  level: number;

  pegs: Peg[];
  balls: Ball[];          // balles en vol (≥1 en firing : multiball plus tard)
  ballsLeft: number;      // réserve d'œufs

  aimAngle: number;       // orientation du lanceur (radians)
  launcher: Vec;          // position du lanceur (haut)

  bucket: { x: number; dir: number; w: number; };

  score: number;
  combo: number;          // nb de pegs touchés ce tour
  orangeLeft: number;     // cache pour éviter un filter/frame

  // hooks de game feel, alimentés par events, lus par le renderer
  fx: { shake: number; flash: number; };

  // valeurs effectives (après application des upgrades de la run)
  config: ResolvedConfig; // ballR, gravity, launchSpeed, aimSteps…

  particles: Particle[];
  floatingTexts: FloatingText[];
}
```

### Entrées (Input)

```ts
export type Input =
  | { kind: "aim"; angle: number }      // souris bouge
  | { kind: "shoot" }                   // clic
  | { kind: "none" };
```

Le React n'appelle JAMAIS `state.shoot()`. Il **pousse un `Input`** que `step`
consomme. Ça garde le coeur en contrôle total des transitions de phase.

### Événements (sortie)

```ts
export type GameEvent =
  | { type: "pegHit"; pegId: number; pegType: PegTypeId; combo: number; pos: Vec }
  | { type: "wallBounce"; pos: Vec }
  | { type: "comboUp"; combo: number }
  | { type: "bucketCatch"; pos: Vec }
  | { type: "ballLost" }
  | { type: "turnEnd" }
  | { type: "levelWon"; level: number; score: number }
  | { type: "gameOver"; score: number };
```

Les events sont le **contrat** entre coeur et couches rendu/son/UI. Ajouter un
effet = ajouter un consommateur d'event, **sans toucher la physique**.

## 4. La boucle : `step()`

`core/step.ts` est un **orchestrateur mince** qui appelle les systèmes dans un
ordre fixe et agrège les events. Aucune règle métier n'y vit directement.

```ts
export function step(state: GameState, input: Input, dt: number): StepResult {
  const events: GameEvent[] = [];

  applyInput(state, input, events);          // aim / shoot
  bucket.update(state, dt);                   // seau bouge tout le temps

  if (state.phase === "firing") {
    // sous-pas adaptatifs selon la vitesse pour éviter le tunneling
    const sub = substeps(state.balls);
    for (let i = 0; i < sub; i++) {
      for (const ball of state.balls) {
        ball.integrate(state, ball, dt / sub, events); // gravité+collisions
      }
    }
    pegs.resolvePops(state, dt);              // anim de pop
    if (noBallsInFlight(state)) turn.end(state, events); // -> aim/won/lost
  }

  fx.decay(state, dt);                        // shake/flash retombent
  particles.update(state, dt);
  return { state, events };
}
```

**Timestep** : la rAF fournit `dt` (clampé). Les **collisions** utilisent des
**sous-pas adaptatifs** (proportionnels à la vitesse de la balle) — la cause du
tunneling actuel — mais isolés dans `physics/ball.ts`, donc faciles à régler.

## 5. Physique (custom légère, isolée)

- `physics/vec.ts` : opérations vecteurs pures.
- `physics/collide.ts` : **une** fonction de collision cercle/cercle (œuf↔peg)
  avec réponse de rebond + résolution d'overlap, et collision cercle↔mur. C'est
  tout pour la v1.
- `physics/ball.ts` : intègre une balle sur un sous-pas (gravité, friction,
  murs, puis test contre tous les pegs proches). Émet `pegHit`/`wallBounce`.
- Les **types de pegs** ne changent pas la physique : un peg est un cercle. Son
  *comportement* (points, est-ce un objectif) vient de `content/pegTypes.ts`.
  Plus tard, bombes/warps = nouveaux types branchés via le registre, pas des
  `if` dans la physique.

> On garde les bonnes idées de l'existant (sous-pas adaptatifs, trail en buffer
> borné, précalcul) mais **dans des modules séparés et nommés**.

## 6. Data-driven (couche content)

Tout ce qui est « contenu » est une **donnée**, pas du code :

```ts
// content/pegTypes.ts
export const PEG_TYPES = {
  blue:   { isGoal: false, points: 10,  color: "#6cf" },
  orange: { isGoal: true,  points: 100, color: "#f93" },
} satisfies Record<string, PegTypeDef>;
```

```ts
// content/levels.ts — un niveau = des données + un layout pur
export const LEVELS: LevelDef[] = [
  { id: 1, build: (L) => [...L.grid({ rows: 5, cols: 9 }, markOrange(0.3))] },
  // ...
];
```

`content/layout.ts` fournit un **DSL pur** (`line`, `grid`, `arc`, `circle`)
qui retourne des `Peg[]` — repris/simplifié de l'ancien `tableau.ts`, mais sans
effets de bord. Ajouter un niveau = ajouter une entrée de données.

## 7. Points d'extension rogue-lite (le « squelette »)

Le coeur est **agnostique** du rogue-lite. Le rogue-lite agit en **2 endroits
bien définis**, jamais en modifiant la physique :

### a) Résolution de config (avant la partie)

```ts
// rogue/run.ts
export interface RunState {
  level: number;
  upgrades: UpgradeId[];   // accumulées sur la run
  score: number;
}

// applique les upgrades sur la config de base -> ResolvedConfig
export function resolveConfig(base: BaseConfig, run: RunState): ResolvedConfig {
  return run.upgrades.reduce((cfg, id) => UPGRADES[id].apply(cfg), { ...base });
}
```

```ts
// rogue/upgrades.ts — registre data-driven (1-2 exemples en v1)
export const UPGRADES = {
  bigger_egg: {
    name: "Gros œuf",
    desc: "+30% de rayon",
    apply: (c) => ({ ...c, ballR: c.ballR * 1.3 }),
  },
  extra_ball: {
    name: "Œuf bonus",
    desc: "+1 balle au départ",
    apply: (c) => ({ ...c, startBalls: c.startBalls + 1 }),
  },
} satisfies Record<string, UpgradeDef>;
```

Ajouter une upgrade = **une entrée de données** avec une fonction `apply` pure.
Aucune ligne ailleurs. (Les upgrades « réactives » — ex. effet sur un event —
seront un 2e champ optionnel `onEvent?` consommé dans `step`, ajouté plus tard.)

### b) Transition entre niveaux (orchestrée côté React)

```
levelWon (event)
   → React passe à l'écran UpgradePicker
   → offer.generate(run) propose 3 upgrades
   → joueur choisit → run.upgrades.push(id)
   → createGame(resolveConfig(base, run), nextLevel)
   → retour en jeu
```

La **machine d'écrans** (Menu / Game / UpgradePicker / GameOver) vit dans
`index.tsx`. Le coeur ne la connaît pas ; il émet juste `levelWon`/`gameOver`.

> Résultat : tu construis ton rogue-lite en **ajoutant des données** (upgrades,
> niveaux, types de pegs, reliques) et en **réagissant à des events**, sans
> jamais rouvrir la physique.

## 8. Rendu (canvas, lit un snapshot)

- `useGameLoop.ts` possède la `requestAnimationFrame`. Chaque frame :
  1. `const { state, events } = step(stateRef.current, inputRef.current, dt)`
  2. `stateRef.current = state`
  3. router les `events` → `audio/sfx.ts` + déclencher du fx visuel
  4. `draw(ctx, state, theme)`
  5. pousser un **snapshot léger** vers React seulement quand le HUD doit
     changer (score, balles, phase) — pas à chaque frame.
- `render/draw.ts` **lit** `state`, ne le mute jamais. L'ordre de dessin :
  fond → pegs → ligne de visée → balles → particules → seau → lanceur → fx.
- Les **thèmes** (`content/themes.ts`) ne sont que des couleurs ; le renderer
  les lit. 1 thème en v1, le registre permet d'en rajouter sans toucher le code
  de dessin.

## 9. State ownership (fin des désyncs)

Une **seule source de vérité par donnée** :

| Donnée | Propriétaire | Lu par |
|---|---|---|
| État de la partie en cours (`GameState`) | `stateRef` (mutable, hors React) | renderer, snapshot HUD |
| Progression de run (`RunState`) | state React dans `index.tsx` | passé à `createGame` au (re)démarrage |
| Snapshot HUD (score, balles, phase) | state React, poussé par la loop | composants HUD |

`GameState` **ne stocke plus** une copie des upgrades : il reçoit une
`ResolvedConfig` figée à la création. Plus de double source upgrades.

## 10. Ce qu'on gagne

- **Testable** : le coeur tourne en Node (un script peut simuler une partie,
  tirer, vérifier le score). Filet de sécurité sans suite de tests formelle.
- **Extensible** : nouvelles upgrades / types de pegs / niveaux / thèmes =
  ajout de données.
- **Game feel découplé** : effets = consommateurs d'events.
- **Fichiers petits** : plus de monstre de 1300 lignes ; chaque système fait
  une chose.
- **Pas de désync** : ownership clair, config figée à la création.
