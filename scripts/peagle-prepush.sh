#!/usr/bin/env bash
#
# Peagle changelog guard — pre-push hook.
#
# Avertit (sans bloquer) quand du code Peagle a changé dans les commits poussés
# vers `main` sans que la version du changelog ait été bumpée.
#
# Installé via `pnpm hooks:install` (voir scripts/install-hooks.sh).
# Pour ignorer ponctuellement : `git push --no-verify`.

set -euo pipefail

VERSION_FILE="src/apps/peagle/peagle-versions.ts"
# Fichiers Peagle dont un changement N'EXIGE PAS de bump (le changelog lui-même).
EXCLUDE_REGEX='^src/apps/peagle/(peagle-versions\.ts|components/PatchNotes\.tsx)$'
PEAGLE_REGEX='^src/apps/peagle/'

RED=$'\033[1;31m'; YEL=$'\033[1;33m'; CYA=$'\033[36m'; DIM=$'\033[2m'; RST=$'\033[0m'

# stdin du hook pre-push : <local ref> <local sha> <remote ref> <remote sha>
while read -r local_ref local_sha remote_ref remote_sha; do
  # Ne contrôle que les push vers main.
  [[ "$remote_ref" == "refs/heads/main" ]] || continue

  # Branche supprimée (push de suppression) → rien à vérifier.
  [[ "$local_sha" =~ ^0+$ ]] && continue

  # Plage de commits réellement nouveaux pour le remote.
  if [[ "$remote_sha" =~ ^0+$ ]]; then
    range="$local_sha"            # nouvelle branche : tous les commits accessibles
  else
    range="${remote_sha}..${local_sha}"
  fi

  changed="$(git diff --name-only "$range" 2>/dev/null || true)"
  [[ -z "$changed" ]] && continue

  # Du code Peagle a-t-il changé (hors fichiers de changelog) ?
  peagle_code_changed="$(echo "$changed" | grep -E "$PEAGLE_REGEX" | grep -vE "$EXCLUDE_REGEX" || true)"
  [[ -z "$peagle_code_changed" ]] && continue

  # La version a-t-elle été touchée dans cette plage ?
  version_changed="$(echo "$changed" | grep -E "^${VERSION_FILE//./\\.}$" || true)"

  if [[ -z "$version_changed" ]]; then
    cur="$(grep -m1 'PEAGLE_CURRENT_VERSION' "$VERSION_FILE" 2>/dev/null | sed -E 's/.*"([^"]+)".*/\1/' || echo '?')"
    {
      echo ""
      echo "${YEL}┌──────────────────────────────────────────────────────────────┐${RST}"
      echo "${YEL}│  ⚠  Peagle : code modifié sans bump de version                │${RST}"
      echo "${YEL}└──────────────────────────────────────────────────────────────┘${RST}"
      echo ""
      echo "  Des fichiers Peagle ont changé mais ${RED}$VERSION_FILE${RST}"
      echo "  n'a pas été mis à jour (version actuelle : ${CYA}v$cur${RST})."
      echo ""
      echo "  Fichiers concernés :"
      echo "$peagle_code_changed" | sed "s/^/    ${DIM}•${RST} /"
      echo ""
      echo "  ${CYA}→ Dans Claude Code, lance :  /peagle-changelog${RST}"
      echo "    (rédige les notes + bump la version, puis re-commit avant de re-push)"
      echo ""
      echo "  ${DIM}Push autorisé quand même. Pour le silence total : git push --no-verify${RST}"
      echo ""
    } >&2
  fi
done

# Toujours laisser passer (mode souple).
exit 0
