# Roadmap d'implémentation — Peagle

Ordre conçu pour **valider tôt** le coeur jouable, puis empiler le reste.
Chaque phase a un livrable vérifiable. On ne passe à la suivante qu'une fois la
précédente « verte » (`pnpm typecheck` + `pnpm lint`).

## Stratégie de bascule (table rase sans casser le bureau)

L'ancien `src/apps/peagle/` reste **fonctionnel et enregistré** pendant tout le
dev pour ne pas casser GunthOS. On développe le neuf à côté, puis on bascule en
une fois.

1. **Archiver** l'ancien : on déréférence `peagle` de `src/apps/index.ts` au
   moment de la bascule seulement. Pendant le dev, le neuf vit sous un slug
   temporaire `peagle2` (non listé au launcher, `showInLauncher: false`) pour
   tester en parallèle.
2. À la fin (phase 6) : remplacer l'ancien dossier par le neuf, reprendre le
   slug `peagle`, supprimer `peagle2` et l'ancien code, mettre à jour
   `app-meta.ts` et les thèmes d'icônes.

> Ça évite un « big bang » : à tout moment le bureau reste utilisable.

## Phase 0 — Squelette & contrats (aucune physique)

- `core/types.ts`, `core/events.ts` : modèle de données + union d'events.
- `content/config.ts` : constantes (reprises de l'ancien `constants.ts` +
  `balance.ts`, regroupées et commentées).
- `core/create.ts` : `createGame(config, level)` produit un état initial avec
  des pegs (1 niveau simple data-driven).
- `core/step.ts` : orchestrateur qui compile mais ne fait encore presque rien.
- **Livrable** : ça typecheck, un état initial cohérent est constructible.

## Phase 1 — Physique & tir (coeur jouable, rendu debug)

- `physics/vec.ts`, `physics/collide.ts`, `physics/ball.ts`.
- `systems/aim.ts` (ligne de visée), `systems/shoot.ts`, `systems/pegs.ts`,
  `systems/turn.ts`, `systems/combo.ts`, `systems/bucket.ts`.
- `render/` minimal (formes simples) + `ui/GameCanvas.tsx` + `useGameLoop.ts`.
- **Livrable** : on vise, on tire, l'œuf rebondit, touche des pegs, ils
  disparaissent, le seau rend une balle, victoire/défaite fonctionnent. Pegs en
  ronds gris/orange, c'est moche mais **ça joue**.
- **Check** : petit script Node qui simule un tir et vérifie un hit → prouve que
  le coeur tourne hors navigateur.

## Phase 2 — Squelette rogue-lite

- `rogue/run.ts` (RunState + resolveConfig), `rogue/upgrades.ts` (2 exemples :
  `bigger_egg`, `extra_ball`), `rogue/offer.ts`.
- `ui/UpgradePicker.tsx` + machine d'écrans dans `index.tsx`
  (Menu → Game → UpgradePicker → Game → … → GameOver).
- **Livrable** : gagner un niveau → choisir 1 upgrade parmi 3 → l'effet
  s'applique au niveau suivant → boucle complète.

## Phase 3 — Game feel (events → effets)

- `audio/sfx.ts` : mapper events → sons GunthOS (`useSoundContext`).
- `render/drawFx.ts` : particules, flash, screen shake, floating texts.
- Ralenti/zoom léger sur dernier peg, célébration seau.
- **Livrable** : le jeu est *satisfaisant*. Toujours data/event-driven.

## Phase 4 — Identité oiseau & habillage

- `assets/birds.ts` : récupérer les grilles+palettes pixel-art des oiseaux
  depuis l'ancien `renderer/skin.ts`, en **données propres**.
- `render/birds.ts` : un seul renderer pixel-art générique piloté par ces
  données. Lanceur = oiseau, projectile = œuf.
- `content/themes.ts` + `render` : 1 thème propre (ex. Forêt) repris de
  `game-theme.ts`. `assets/icons.ts` : sous-ensemble d'icônes (œuf, peg, balle).
- Manifest, `<OsIcon>`, entrée dans les thèmes d'icônes (`lucide.tsx` +
  `neon.ts`), `app-meta.ts`. Logo Peagle repris.
- **Livrable** : ça a l'âme de Peagle (oiseau + œuf + jeu de mots), propre.

## Phase 5 — Polish & robustesse

- Responsive du canvas (scale propre), HUD Win98 cohérent (`--t-*`,
  `--t-text-*`).
- Régler le feel physique (rebond, gravité, sous-pas) pour zéro tunneling.
- Menu, écran game over, snapshots HUD optimisés.
- **Livrable** : v1 conforme aux **critères d'acceptation** du cahier des
  charges.

## Phase 6 — Bascule & nettoyage

- Reprendre le slug `peagle`, supprimer l'ancien dossier + `peagle2`.
- Mettre à jour `src/apps/index.ts`, `app-meta.ts`, thèmes d'icônes.
- Décider du sort de `peagle-showroom` (réécrire plus tard ou retirer en v1).
- `pnpm typecheck` + `pnpm lint` verts, commit, push.

## Ce qui reviendra APRÈS la v1 (sur la base saine)

Réintégrées une par une, chacune = données + éventuel consommateur d'event,
**jamais** de réouverture de la physique de base :

- types de pegs spéciaux : bombe (chaîne), vert (power-up), warp, boss/armure ;
- décor de collision : bumpers, planches, arcs, piques (via une interface
  `Collider` commune, pas 4 codes séparés) ;
- classes d'oiseaux + skins complets, reliques ;
- power-ups verts (multiball, magnet, spooky, phoenix…) en data-driven ;
- slow-mo / fever ;
- 4 thèmes animés + showroom ;
- leaderboard backend, annonces, dev panel.

## Définition de « fait » (chaque phase)

- `pnpm typecheck` ✅ et `pnpm lint` ✅
- Le coeur reste **sans import React/canvas**.
- Aucune règle de jeu dans la couche React.
- Nouveau contenu = données, pas de `switch` qui gonfle.
- Commit clair sur la branche `claude/peggle-architecture-specs-kaySI`.
