#!/usr/bin/env bash
#
# Installe les git hooks du repo (idempotent).
# Opt-in : à lancer une fois via `pnpm hooks:install`.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
HOOK_DIR="$ROOT/.git/hooks"

# Pas de dossier .git (ex: install dans un tarball / CI sans repo) → on sort sans erreur.
[[ -d "$HOOK_DIR" ]] || { echo "ℹ  Pas de .git/hooks, hooks ignorés."; exit 0; }

chmod +x "$ROOT/scripts/peagle-prepush.sh"

# Un pre-push existe déjà et n'est PAS le nôtre → on le sauvegarde plutôt que de
# l'écraser (ne pas détruire le hook d'un contributeur).
HOOK="$HOOK_DIR/pre-push"
if [[ -f "$HOOK" ]] && ! grep -q "peagle-prepush.sh" "$HOOK" 2>/dev/null; then
  mv "$HOOK" "$HOOK.bak"
  echo "ℹ  pre-push existant sauvegardé → pre-push.bak"
fi

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# Auto-généré par scripts/install-hooks.sh — ne pas éditer ici.
exec "$(git rev-parse --show-toplevel)/scripts/peagle-prepush.sh" "$@"
EOF
chmod +x "$HOOK_DIR/pre-push"

echo "✓ Hook pre-push installé (garde changelog Peagle)."
