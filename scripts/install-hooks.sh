#!/usr/bin/env bash
#
# Installe les git hooks du repo (idempotent).
# Lancé via `pnpm hooks:install`, ou automatiquement au `pnpm install` (postinstall).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
HOOK_DIR="$ROOT/.git/hooks"

# Pas de dossier .git (ex: install dans un tarball / CI sans repo) → on sort sans erreur.
[[ -d "$HOOK_DIR" ]] || { echo "ℹ  Pas de .git/hooks, hooks ignorés."; exit 0; }

chmod +x "$ROOT/scripts/peagle-prepush.sh"

cat > "$HOOK_DIR/pre-push" <<'EOF'
#!/usr/bin/env bash
# Auto-généré par scripts/install-hooks.sh — ne pas éditer ici.
exec "$(git rev-parse --show-toplevel)/scripts/peagle-prepush.sh" "$@"
EOF
chmod +x "$HOOK_DIR/pre-push"

echo "✓ Hook pre-push installé (garde changelog Peagle)."
