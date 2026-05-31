# Cahier des charges — Peagle

## 1. Vision

**Peagle** est un jeu d'arcade type *Peggle* intégré à GunthOS : on lance un
projectile (un **œuf**) depuis le haut de l'écran, il rebondit sur des **pegs**,
et l'objectif est de détruire tous les **pegs orange**. Le thème est l'**oiseau**
(jeu de mots *peg* + *eagle* = **Peagle**) : projectile = œuf, lanceur = oiseau,
classes = espèces d'oiseaux.

La v1 vise un **jeu simple, propre et complet** (jouable du menu au game over),
conçu dès le départ pour qu'on **empile dessus un rogue-lite** sans réécrire le
coeur.

### Principe directeur

> Un **coeur de jeu pur** (TypeScript, zéro React, zéro canvas) qui prend un
> état + des entrées et produit un nouvel état + des événements. Tout le reste
> (rendu, son, UI React, rogue-lite) se branche **autour** via des interfaces
> explicites. On doit pouvoir faire tourner une partie « en mémoire » sans
> écran.

## 2. Périmètre v1 (ce qu'on livre)

### Inclus

- **Une boucle de jeu complète** : Menu → Partie → Game Over → retour Menu.
- **Tir** : viser à la souris (ligne de visée avec aperçu de trajectoire),
  cliquer pour lâcher l'œuf.
- **Pegs** :
  - **bleus** (neutres, rapportent des points),
  - **orange** (objectif : tous les détruire pour gagner le niveau).
- **Physique** : gravité, rebonds œuf↔peg et œuf↔murs, l'œuf sort par le bas.
- **Seau mobile** en bas : rattraper l'œuf dedans = **+1 balle** (rejoue).
- **Comptage de balles** : on démarre avec N œufs, on en perd un par tir non
  rattrapé. 0 balle + pegs orange restants = **défaite**.
- **Score** : points par peg, **combo** qui monte tant qu'on enchaîne.
- **Condition de victoire** : tous les pegs orange détruits → niveau gagné.
- **Squelette rogue-lite** (câblé mais minimal) :
  - enchaînement de niveaux (niveau gagné → niveau suivant),
  - **écran de choix d'upgrade** entre deux niveaux (3 cartes),
  - **1 à 2 upgrades d'exemple** seulement (ex. *œuf plus gros*, *+1 balle*),
    juste pour prouver que le système marche de bout en bout.
- **Identité visuelle oiseau** : lanceur oiseau, œuf, au moins **1 thème**
  propre repris/nettoyé de l'existant.

### Exclu de la v1 (viendra après, sur la base)

- Système complet d'upgrades/reliques/classes (on garde juste le câblage).
- Bombes, pegs verts à pouvoir, warps, boss, armures.
- Décor de collision avancé (bumpers, planches, arcs, piques).
- Les 4 thèmes animés complets + showroom.
- Multiball, slow-mo/fever, magnet, phoenix, etc.
- Leaderboard backend, annonces, dev panel complet.

> Ces features existent déjà dans l'ancien code et serviront de **réservoir
> d'idées et d'assets**. On les réintègre **une par une**, proprement, une fois
> le socle stable.

## 3. Règles du jeu (v1)

### Plateau

- Zone de jeu à ratio fixe (logique en coordonnées internes, ex. `480 × 640`),
  mise à l'échelle pour remplir la fenêtre. **Toute la logique travaille en
  coordonnées internes**, jamais en pixels écran.
- Murs gauche/droite/haut rebondissants. Bas = zone de sortie (+ seau).

### Déroulé d'un tir

1. **Phase `aim`** : la souris oriente le lanceur. Une **ligne de visée**
   montre la trajectoire prévue (quelques rebonds simulés).
2. **Clic** → **phase `firing`** : un œuf part, soumis à la gravité, rebondit.
3. À chaque collision avec un peg : le peg passe en état « touché » puis
   **disparaît en fin de tour** (animation de pop), score ajouté.
4. L'œuf finit par **sortir par le bas**. S'il passe dans le **seau** → +1 balle.
5. **Fin de tour** : on retire les pegs touchés, on vérifie victoire/défaite,
   retour en `aim` si la partie continue.

### Score & combo

- Peg bleu : points de base ; peg orange : points ×N.
- **Combo** : chaque peg touché dans le même tir augmente un multiplicateur ;
  réinitialisé en fin de tour.

### Victoire / défaite

- **Victoire niveau** : plus aucun peg orange.
- **Défaite** : 0 balle restante alors qu'il reste des pegs orange.

## 4. Game feel (cible)

Le « jus » est ce qui rend Peggle satisfaisant. On le veut **piloté par
événements**, jamais codé en dur dans la physique :

- impact peg → petit *screen shake* + flash + son + particules,
- combo qui monte → feedback sonore montant,
- dernier peg orange → ralenti + zoom + son de victoire,
- rattrapage seau → son + petite célébration.

Tous ces effets sont des **réactions à des événements** émis par le coeur
(`PegHit`, `ComboUp`, `LevelWon`, `BucketCatch`…), consommés par les couches
rendu/son. Le coeur ne connaît ni le canvas ni l'audio.

## 5. Identité visuelle « oiseau »

- **Jeu de mots central** : Peagle = *peg* + *eagle*. À garder partout (nom,
  ton, assets).
- **Projectile** = œuf. **Lanceur** = oiseau (pixel-art).
- **Classes** (plus tard) = espèces : pélican / corbeau / faucon, déjà
  dessinées dans l'ancien `renderer/skin.ts` → à récupérer comme **données de
  pixel-art propres** (grille + palette), pas comme code de dessin éparpillé.
- **Pegs** : style pixel-art bevel (repris de `renderer/pegs.ts`), nettoyé.
- **Thème v1** : reprendre **un** thème (ex. « Forêt ») de `game-theme.ts`,
  simplifié, comme preuve du système data-driven de thèmes.
- Cohérence avec **GunthOS** : cadre fenêtre Win98, variables CSS `--t-*`,
  échelle de police `--t-text-*` (jamais de tailles en dur), sons via
  `useSoundContext()`.

### Assets à récupérer (en les nettoyant)

| Source actuelle | Quoi | Forme cible |
|---|---|---|
| `renderer/skin.ts` | skins oiseaux (pélican/corbeau/faucon, grilles+palettes) | données pixel-art typées dans `assets/birds.ts` |
| `renderer/pegs.ts` | style pegs pixel-art bevel | fonction de rendu peg propre |
| `engine/game-theme.ts` | 1 thème (couleurs pegs/fond) | 1 `Theme` data-driven, le reste plus tard |
| `components/PegIcon.tsx` | icônes (œuf, peg, balle…) | sous-ensemble migré data-driven, pas 1339 l. de switch |
| `components/PeagleLogo.tsx` | logo Peagle | repris tel quel si propre |

## 6. Contraintes techniques (rappel GunthOS)

- App = `src/apps/<slug>/` avec `manifest.ts` + `index.tsx`, enregistrée dans
  `src/apps/index.ts`. Icônes via `<OsIcon>` + thèmes d'icônes.
- **Pas d'accès DB direct côté client** : tout passe par `src/app/api/`.
- Audio via le système GunthOS (`audioChannels` dans le manifest pour la
  musique, `useSoundContext()` pour les SFX).
- Styling : variables CSS `--t-*`, échelle `--t-text-*`, pattern bevel Win98.
- Correctness : `pnpm typecheck` + `pnpm lint` (pas de suite de tests dans le
  repo — mais le coeur de jeu sera écrit pour être **testable en isolation**).

## 7. Critères d'acceptation v1

- [ ] On lance Peagle depuis le bureau, le menu s'affiche.
- [ ] On démarre une partie, on vise à la souris, on tire un œuf.
- [ ] L'œuf rebondit de façon crédible et stable (pas de tunneling visible).
- [ ] Toucher un peg le détruit en fin de tour et donne des points + feedback.
- [ ] Rattraper l'œuf dans le seau rend une balle.
- [ ] Détruire tous les pegs orange gagne le niveau.
- [ ] Tomber à 0 balle avec des orange restants = game over.
- [ ] Après victoire, écran de choix parmi 3 upgrades, l'upgrade choisie
      s'applique au niveau suivant.
- [ ] Le coeur de jeu tourne sans React/canvas (vérifiable par un petit script
      qui simule une partie).
- [ ] `pnpm typecheck` et `pnpm lint` passent.
- [ ] L'esprit « oiseau » est présent (œuf, lanceur oiseau, nom/ton, 1 thème).
