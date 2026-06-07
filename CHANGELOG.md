# Changelog

## [0.3.1] - 2026-06-07

### Peagle 98
- Les exclamations de combo claquent désormais juste à côté du peg qui éclate, décalées en diagonale vers l'espace libre — fini la pile centrale loin de l'action, tout en restant lisibles
- Textes de jeu enfin à la charte : combos et exclamations en police pixel arcade (Press Start 2P), scores chiffrés en VT323 — plus de « MS Sans Serif » hors-sujet
- Lexique des combos resserré sur le thème aigle/rapace (RAPACE!, PIQUÉ NET!, AIGLE ROYAL!, APOTHÉOSE!…) — adieu JUICY!/ŒUFTASTIQUE!
- Nouveau son de palier de combo : un arpège pixel ascendant qui escalade avec ton multiplicateur — la montée en combo s'entend
- Width-fit automatique : aucun mot ne déborde plus du cadre, même collé au bord

## [0.3.0] - 2026-06-07

### Peagle 98
- L'aigle te nargue à la fin : le texte de game over passe en bulle de BD avec une réplique sarcastique de l'oiseau — ou une félicitation si tu bats ton record
- Bumpers calmés : la balle ne s'envole plus dans tous les sens après un rebond
- Fix : « NOUVEAU RECORD » ne s'affiche plus quand tu fais le même score qu'avant — il faut vraiment faire mieux
- Rework des textes flottants : plus diegésiques, plus lisibles
  - Exclamations (JUICY!, TASTY!…) : aberration chromatique → étoile pixel burst + dérive latérale organique
  - Box combo Win98 grise → badge banner sombre avec bandes colorées
  - Glow réduit + highlight pixel-art fin sur les exclaims
  - Score avec multiplicateur : la partie ×N s'affiche en doré, distincte du score
- Overlay patch notes in-game : la bannière de version est cliquable depuis le menu principal
- Système de version code-driven (`peagle-versions.ts` comme source de vérité)

---

## [0.2.0] - 2026-06-04

### GunthOS
- Peagle 98 — le grand chantier
- Nouveau moteur de jeu déterministe + génération de niveaux façon pachinko
- Mascotte aigle animée partout : menu pause, lanceur et HUD
- Cri de l'aigle, expressions du visage et véritable écran de game over
- Classement du Kiff affiché directement sur l'écran de fin de partie
- Ambiance jour/nuit, mode fever et lucioles dans la canopée
- Corrections de perf, de mémoire et de déterminisme

---

## [0.1.0] - 2026-05-01

### GunthOS
- Première version publique de GunthOS
- Bureau Windows 98, fenêtres déplaçables, thèmes et icônes
- Apps : MSN, Radio, Solitaire, Annuaire, Paramètres
