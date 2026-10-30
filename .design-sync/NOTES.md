## Scope

This sync covers only `src/components/*.jsx` (5 files, 7 components after
default-export aliasing) — not the rest of the `aify` app. These are
app-infrastructure components (auth gating, error boundary, nav sidebar,
onboarding tutorial, loading skeletons), not a general-purpose design system;
they were synced at the user's explicit request despite that mismatch.

## Setup quirks this repo needed

- **No library build.** `package.json` has no `main`/`module`/`exports` (it's
  a private Vite app, not a published package) — the converter runs in
  synth-entry mode from `src/components` (`cfg.srcDir` scopes discovery to
  just that folder; without it, the whole `src/` tree — pages, services,
  etc. — would get swept in).
- **Default-export aliasing fork**: all 5 source files use
  `export default function/class Name` (app-code convention). `export *
  from` never re-exports a default, so the synth entry silently dropped
  every one of them. Forked `.design-sync/overrides/source-kit.mjs` to add
  an explicit `export { default as Name } from '<path>'` alongside the
  `export *` line whenever a default export name is statically recoverable.
  Declared in `cfg.libOverrides`. **Re-sync risk**: if a future component in
  this folder uses a default export the regex can't recover (an anonymous
  `export default function()`, or `export default someExpression`), it will
  silently be missing from `window.Aify` again — check `[BUNDLE_EXPORT]` in
  `package-validate.mjs` output after any resync.
- **`.ico` asset imports**: `Sidebar.jsx` imported `favicon.ico` /
  `aify-texto.ico` directly as JS modules (Vite-only asset convention;
  esbuild's default loader map doesn't cover `.ico`). Converted both to real
  PNGs via `sips` (`src/assets/favicon-icon.png`,
  `src/assets/aify-texto-icon.png` — originals untouched) and repointed the
  two import lines in `Sidebar.jsx`. This is a real edit to the live app
  source, done with the user's go-ahead; functionally and visually
  identical, but worth knowing it happened.
- **`cssEntry` points at a snapshot, not the live source**: `src/index.css`
  starts with `@import "tailwindcss"` (Tailwind v4, CSS-first config), which
  only resolves through Vite/Tailwind's own build — a raw copy breaks
  `[CSS_IMPORT_MISSING]`. `cfg.cssEntry` instead points at
  `.design-sync/ds-styles.css`, a snapshot of the real compiled
  `dist/assets/index-*.css` from the last `npm run build`. **Re-sync risk**:
  this snapshot goes stale if design tokens (`:root` vars) or the
  `.skeleton-shimmer` keyframe change in `src/index.css`. Before a re-sync,
  run `npm run build` and refresh the snapshot: `cp dist/assets/index-*.css
  .design-sync/ds-styles.css`.
- **Providers wired via `cfg.provider`**: `MemoryRouter` → `AuthProvider` →
  `ThemeProvider`, nested (needed by `Sidebar`/`ProtectedRoute`/`Tutorial`
  for `useAuth`/`useTheme`/router hooks). `AuthProvider`/`ThemeProvider` are
  real repo modules pulled in via `cfg.extraEntries`
  (`./src/context/AuthContext.jsx`, `./src/context/ThemeContext.jsx`).
- **Supabase is safely inert in this bundle**: `import.meta.env.*` isn't a
  real browser API outside Vite's own transform; the converter's esbuild
  config defines it to `{}`, so `VITE_SUPABASE_URL`/`_ANON_KEY` always
  resolve empty here regardless of the real `.env` — `supabase` is always
  `null` in the shipped bundle, so `AuthProvider` never makes a live network
  call. Confirmed by inspecting the compiled `_ds_bundle.js`. This is why
  `ProtectedRoute`'s preview reliably shows the logged-out `fallback` state.
- **Framer-motion entrance animations under the capture harness**: `Sidebar`
  and `Tutorial` both mount via `motion.aside`/`motion.div` with
  `initial={{opacity:0}}`. `package-capture.mjs` freezes the page clock
  (`page.clock.setFixedTime`) for deterministic screenshots; on the
  harness's *second* navigation on the same page (grid-discovery nav, then
  the `?story=` nav — every component gets both), the entrance transition
  gets stuck at `opacity: 0` — reproduced in isolation, confirmed
  framer-motion-specific (a non-motion component doesn't reproduce it), and
  confirmed that `MotionConfig reducedMotion="always"` alone does *not* fix
  it (works on a single navigation, not the second). Fixed in both preview
  files with a small `!important` stylesheet injected at module scope
  (`opacity/transform/animation/transition` forced to their settled values)
  — that reliably wins over the stuck inline style regardless of the
  underlying timing bug. Both fixes are documented inline in the preview
  files. **This is a generalizable gotcha for any framer-motion (or similar)
  entrance-animated root in this converter's package-shape captures** — if
  a future component here uses one, expect the same fix.
- **`Tutorial` only auto-activates** when `aify_onboarding_completado` is
  set and `aify_tutorial_completado`/`aify_dashboard_visitado` aren't, then
  waits 800ms. The preview primes `localStorage` and shortens the timer to
  0ms at module scope. It always resets to step 0 on a fresh mount, so only
  the first step ("bienvenida") is reachable in a static preview — later
  steps would need simulated clicks, which this framework doesn't do.
- **`ProtectedRoute`**: only the logged-out (`fallback`) state is reachable
  without a real auth backend — matches its own real usage in
  `App.jsx` (custom `fallback` for the same reason). The bare-default
  `<Navigate>` path (no `fallback`) renders nothing visible, so the
  authored preview intentionally uses the `fallback` composition instead.
- **`Tutorial`'s card needed `cfg.overrides.Tutorial: {cardMode: "single",
  primaryStory: "Default"}`** — its `position: fixed; inset: 0` modal
  escapes any grid cell (`[GRID_OVERFLOW]`).

## Accepted substitute

`SF Pro Display`/`SF Pro Text` (Apple's system font) are referenced but not
shipped — can't be legally redistributed as a webfont. Accepted the existing
fallback chain (Helvetica Neue/Arial/sans-serif), same as how the app
already renders on non-Apple devices. If aify's brand ever settles on a
licensable webfont for non-Apple platforms, wire it via `cfg.extraFonts`.

## Known render warns

None outstanding — final validate pass is clean except the accepted
`[FONT_MISSING]` above.

## Re-sync risks (read this before re-running)

- The `cssEntry` snapshot (`.design-sync/ds-styles.css`) is a point-in-time
  copy, not a live reference — see above. Stale tokens are the most likely
  silent failure mode on a future re-sync.
- The `source-kit.mjs` fork's default-export-name recovery is regex-based,
  not a full parse — see the fork's own quirk note above.
- No git repository exists in this project (`aify` isn't currently under
  version control), so nothing here is committed anywhere yet — `.design-
  sync/config.json`, `NOTES.md`, `conventions.md`, `previews/`, and
  `overrides/` only exist on disk. If this repo is ever put under git,
  commit all of those (and the `.gitignore` additions for `.ds-sync/`,
  `ds-bundle/`, `.design-sync/.cache/`, `.design-sync/learnings/`,
  `.design-sync/node_modules`) so a future sync — from this machine or any
  other — starts from the same state instead of redoing this investigation.
