# CLAUDE.md

**GunthOS** is a retro Windows 98-style desktop OS running in the browser. Next.js 15, SQLite/Drizzle, better-auth, Tailwind CSS v4. Every feature is an "app" inside a draggable/resizable window.

## Commands

```bash
pnpm dev          # Dev server with Turbopack
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit — primary correctness signal (no test suite)

pnpm db:generate  # Generate Drizzle migration files
pnpm db:migrate   # Apply pending migrations
pnpm db:push      # Push schema without migration files (dev only)
pnpm db:studio    # Drizzle Studio GUI
```

## Architecture

### Provider tree (outermost → innermost)

```
AuthProvider
  SettingsProvider
    IconThemeProvider          ← src/app/layout.tsx
      SiteShell:
        SoundProvider
          RadioProvider
            SeenAppsProvider
              WindowManagerProvider
                NotificationProvider
                  UnreadProvider
                    ChatWindowsProvider
                      LiveNotificationsBridge (SSE hook, renders null)
                      GunthTitle + Taskbar + OsDesktop + WindowLayer + NotificationLayer
```

`SiteShell` (`src/components/ui/site-shell.tsx`) owns the boot/shutdown state machine. `WindowLayer` renders all open windows via `OsWindow`.

### App registry

Every app lives in `src/apps/<slug>/` with exactly two files: `index.tsx` (component, receives `{ windowId: string }`) and `manifest.ts` (`AppManifest`).

`src/apps/index.ts` is the **single source of truth** — import the manifest and add it to `APP_REGISTRY`. Window manager, taskbar, launcher, and audio cleanup all derive from this automatically.

**Adding a new app — 5 steps:**
1. `src/apps/my-app/manifest.ts` with `AppManifest`
2. `src/apps/my-app/index.tsx` with `export function MyApp({ windowId }: AppProps)`
3. Import and add to `APP_REGISTRY` in `src/apps/index.ts`
4. Set `showInLauncher: true` to appear in Start menu and desktop
5. Add `{ slug, name, emoji }` to `src/lib/app-meta.ts` (used by GuntherBoard's scope picker — kept separate to avoid a circular import)

### Key `AppManifest` fields

| Field | Purpose |
|---|---|
| `slug` | Unique identifier, used everywhere as the key |
| `defaultSize` | Initial window size `{ w, h }` in px |
| `loadDuration` | Fake loading bar duration (ms) shown on open |
| `showInLauncher` | Appears in Start menu + desktop icon |
| `emoji` | Used by the Emoji icon theme — always set it, even for new apps |
| `persistAudio` | If `true`, audio keeps playing after window close (Radio) |
| `audioChannels` | Named channels auto-silenced on window close |

> **`iconComponent` / `iconNode` are legacy.** The icon theme system now handles all rendering via `<OsIcon slug={app.slug} size={N} />`. Don't add these fields to new apps.

### Icon theme system

`src/lib/icon-themes/` — 7 built-in themes switchable by the user (Paramètres → ICÔNES). Default: **Win98**.

| Theme id | Style | Description |
|---|---|---|
| `win98` | Grey box + raised border | Default, authentic old-school |
| `pixel` | Colored bg + black outline | 16-bit video game style |
| `lucide` | Colored bg + raised border | Modern per-app SVG |
| `neon` | Black bg + colored glow | Cyberpunk |
| `crt` | Black bg + green phosphor | Retro monochrome terminal |
| `flat` | Colored SVG icon, no bg | Minimalist |
| `emoji` | Emoji string | Reads the manifest's `emoji` field |

**`<OsIcon slug="my-app" size={N} />`** (`src/components/ui/os-icon.tsx`) — central component. Reads the current theme via `useIconTheme()` and renders the right icon. Always use this component instead of rendering `app.emoji` directly.

**`useIconTheme()`** (`src/lib/contexts/icon-theme-context.tsx`) — returns the active `IconTheme`. Useful to read `theme.style` or access `theme.icons[slug]` for custom rendering.

**Adding icons for a new app** (do this after the 5 steps above):
1. In `src/lib/icon-themes/themes/lucide.tsx` — add `"my-app": { icon: SomeLucideIcon, color: "#hexcolor" }` to `icons`
2. In `src/lib/icon-themes/themes/neon.ts` — add `"my-app": { ...lucideTheme.icons["my-app"]!, color: "#brightercolor" }`
3. win98 / pixel / crt / flat inherit from lucide, and emoji reads `manifest.emoji` — nothing to do for those.

### Window manager

`WindowManagerProvider` (`src/lib/contexts/window-manager-context.tsx`) exposes **two separate contexts**:
- `useWindowActions()` — stable, never re-renders. Use when you only need to open/close/focus.
- `useWindowState()` — re-renders on every window change. Use only when reading the window list.
- `useWindowManager()` — gives both, but re-renders on state changes.

To open an app: `useOpenApp()` (`src/lib/hooks/use-open-app.ts`) — handles audio init + open sound + window creation in one call.

### Audio system

- **Engine** (`src/lib/audio/engine.ts`) — singleton `AudioContext`, master gain, buffer cache
- **Channels** (`src/lib/audio/channel.ts`) — named instances via `getChannel(name)`, each with their own GainNode
- **Players** (`src/lib/audio/player.ts`) — `AudioPlayer` wraps a channel for play/loop/fade
- **Hook** (`src/lib/hooks/use-sound.ts`) — all OS sounds, exposed via `useSoundContext()`

### Database & Auth

SQLite via `better-sqlite3` + Drizzle ORM. Schema in `src/lib/db/schema.ts`. Migrations run automatically at startup (`migrate.js`). **No direct DB calls from client components** — all access goes through API routes in `src/app/api/`.

`better-auth` with username/password. Server: `src/lib/auth.ts`, client: `src/lib/auth-client.ts`. Auth context: `src/lib/contexts/auth-context.tsx` → `{ user, session, loading }`.

### Styling

Tailwind CSS v4. All theme values are CSS variables on `:root` — **never hardcode colors or use Tailwind color classes**. Key variables: `--t-bg` `--t-app-bg` `--t-accent` `--t-text` `--t-text-muted` `--t-border-light` `--t-border-dark` `--t-titlebar-from` `--t-titlebar-to` `--t-font-display`. Full list in `src/lib/themes.ts`.

Win98 raised/sunken border pattern (non-obvious):
- **Raised:** top/left = `--t-border-light`, bottom/right = `--t-border-dark`
- **Sunken:** top/left = `--t-border-dark`, bottom/right = `--t-border-light`

#### Font scale — IMPORTANT

**Never hardcode font sizes.** Use `--t-text-*` variables (defined in `globals.css`) — they bake in `--t-font-scale` via `calc()`. Never use Tailwind `text-sm`, `text-base`, etc.

| Variable | Base size |
| --- | --- |
| `--t-text-xs` | `0.75rem` |
| `--t-text-sm` | `0.875rem` |
| `--t-text-base` | `1rem` |
| `--t-text-md` | `1.15rem` |
| `--t-text-lg` | `1.35rem` |
| `--t-text-xl` | `1.6rem` |
| `--t-text-2xl` | `2rem` |
| `--t-text-3xl` | `2.5rem` |

For fluid sizes: `calc(clamp(12px, 1.6vw, 16px) * var(--t-font-scale))`. Fixed decorative elements using `monospace` directly are exempt.

### Path aliases

`@/` → `src/` (tsconfig.json).

---

## Cookbook

### UI sounds

`useSoundContext()` — no setup needed. Available: `playClick` `playPop` `playBip` `playDelete` `playVictory` `playWindowOpen` `playWindowClose` `playWindowMinimize` `playModemDialup` `playStartupChime` `playBiosBleep`.

### Background music (looping MP3)

Declare `audioChannels` in manifest — silenced automatically on window close. In `index.tsx`, call `init()` from `useSoundContext()`, then create a `new AudioPlayer(getChannel("my-channel"))` and `play("/sounds/file.mp3", { loop: true })`. Cleanup: `fadeOutAndStop(0.4)`. Audio files go in `public/sounds/`.

### Persistent audio (survives window close)

Set `persistAudio: true`, do **not** declare `audioChannels`. Manage cleanup yourself. See `src/lib/contexts/radio-context.tsx` as the reference.

### Display an app icon

```tsx
import { OsIcon } from "@/components/ui/os-icon";

// Adapts automatically to the user's chosen icon theme
<OsIcon slug="settings" size={24} />
<OsIcon slug="msn" size={46} />   // desktop-size
<OsIcon slug="radio" size={16} />  // titlebar/taskbar-size
```

Common sizes: 16 (titlebar/taskbar), 18 (start menu), 20 (open window), 46 (desktop).

### Open another app

```tsx
const { openApp } = useOpenApp(); // handles audio init + open sound + focus
openApp("settings");
```

### Current user

```tsx
const { user, isPending } = useAuth(); // user is null when logged out
```

### DB fetch

Add `src/app/api/my-app/route.ts` with a handler using `db` from `@/lib/db`. Call via `fetch("/api/my-app")` from the component. For auth-protected routes, validate with `auth.api.getSession` server-side.

### Toast notifications

`useNotify()` from `@/lib/contexts/notification-context` — available everywhere in the OS.

| Field | Type | Default |
| --- | --- | --- |
| `type` | `"info" \| "success" \| "warning" \| "error"` | required |
| `title` | `string` | required |
| `message` | `string` | — |
| `duration` | `number \| null` | `4000` ms; `null` = persistent |

Returns `id` — use `dismiss(id)` via `useNotificationActions()` to close early. Max 5 visible (oldest evicted).

Admin broadcast: `POST /api/notifications/broadcast` → delivers via SSE to all connected clients.
