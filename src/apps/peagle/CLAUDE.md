# Peagle 98

Clone de Peggle en canvas 60 FPS avec boucle roguelite (clear niveau → upgrade → niveau suivant).

Accessible aussi hors de l'OS via un lien direct : `localhost:3000/peagle`.

## Règle fondamentale

`GameState` vit dans un `useRef` — jamais de `useState` pour l'état du jeu. Le moteur mute le ref chaque frame et émet des `PeagleEvent` ; `useGameLoop.ts` les traduit en sons/changements d'écran.

```
engine/      ← logique pure TS, zéro React, zéro audio
renderer/    ← lit le GameState, dessine sur canvas, aucun side effect
hooks/       ← pont rAF ↔ React (useGameLoop, useMusic, usePeagleSounds)
components/  ← UI React (menus, HUD, overlays)
```

Pour tout ajouter ou étendre : voir **[EXTENDING.md](EXTENDING.md)**.

## Changelog

Source unique : **`peagle-versions.ts`** (`PatchNotes.tsx` lit `PEAGLE_VERSIONS` dynamiquement — ne pas l'éditer à la main).

**Ne le rédige pas à la main avant de push.** Au moment de pousser sur `main`, lance la commande Claude `/peagle-changelog`.

Elle regarde le diff Peagle depuis la dernière version, regroupe tout en **une seule** nouvelle version, rédige les notes à la charte et bump le numéro.

Un **hook pre-push** (`scripts/peagle-prepush.sh`, installé via `pnpm hooks:install`) avertit — sans bloquer — si du code Peagle part vers `main` sans bump de version. Pour le forcer : `git push --no-verify`.

Format d'une entrée (en tête du tableau) : `{ version: "0.x.y", releasedAt: "YYYY-MM-DD", notes: ["…"] }` — patch par défaut, mineur si feature ; une ligne par changement, ton neutre, en français.

## Tweaks rapides (sans nouveau code)

| Quoi | Fichier |
|---|---|
| Points, screenshake, combos, particules | `engine/balance.ts` |
| Gravité, vitesse, taille panier, œufs de départ | `engine/constants.ts` |
| Courbe de difficulté du run | `engine/difficulty.ts` |

## Styling

- Tokens canvas dans `styles.ts` — pas les tokens globaux GunthOS
- Layout responsive dans `peagle.css` (vertical mobile / horizontal 16:9)
- Polices canvas : Press Start 2P (titres/pixel) et VT323 (scores/UI)

## DevPanel

Réservé aux admins (`user.role === "admin"`). Pour tester les cas limites, utilise le DevPanel — ne modifie jamais le code temporairement pour déboguer.

## Vérification

```bash
pnpm typecheck   # signal principal — pas de suite de tests
pnpm lint
```
