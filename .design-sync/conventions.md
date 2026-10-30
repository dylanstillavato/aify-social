## Wrapping and setup

Three of these components read from React context and need it present or they render incorrectly:

- **`Sidebar` and `ProtectedRoute`** call `useAuth()` — wrap in `AuthProvider` (no session in a design context is fine and expected; `ProtectedRoute` correctly falls back to its `fallback` prop or a login redirect).
- **`Sidebar`** also calls `useTheme()` — wrap in `ThemeProvider`. It sets `document.documentElement.setAttribute('data-theme', theme)`, which is what the dark-mode tokens below key off.
- **`ProtectedRoute`** uses `<Navigate>` and **`Sidebar`**/**`Tutorial`** use `useNavigate`/`NavLink` — all three need a router ancestor (`MemoryRouter`, `BrowserRouter`, etc.).

Minimal wrap:

```jsx
<MemoryRouter>
  <AuthProvider>
    <ThemeProvider>
      <Sidebar />
    </ThemeProvider>
  </AuthProvider>
</MemoryRouter>
```

Without `AuthProvider`/`ThemeProvider` in the tree, `useAuth`/`useTheme` throw immediately (they call `useContext` on a context with no default) and the component never mounts.

## Styling idiom: CSS custom properties, not utility classes

This system does **not** style components with utility classes — components use inline `style={{...}}` objects that reference CSS custom properties for anything theme-dependent (light/dark). Build new UI the same way: inline styles for layout/spacing, `var(--token-name)` for any color, background, border, or shadow so it stays theme-aware.

Real token names (defined in `styles.css`, redefined under `[data-theme="dark"]`):

| Purpose | Tokens |
|---|---|
| Surface | `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-hover` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary` |
| Border | `--border-color`, `--border-subtle` |
| Accent | `--accent-blue`, `--accent-blue-hover`, `--accent-purple`, `--accent-green`, `--accent-orange` |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Glass/gradient chrome | `--glass-bg`, `--card-glass`, `--card-glass-border`, `--gradient-bg`, `--gradient-hero` |
| Radius | `--card-radius` |

Example from the real components: `background: 'var(--bg-card)'`, `color: 'var(--text-primary)'`, `border: '1px solid var(--border-color)'`.

The one real class name in this set is `.skeleton-shimmer` (used by the `Skeleton` primitive) — everything else is inline styles.

## Where the truth lives

- `styles.css` (root) — the full token set and the shimmer keyframe; read this before styling anything new.
- Each component's `<Name>.prompt.md` — real usage per component.
- `_ds_bundle.js` — the compiled source; `AuthProvider`/`ThemeProvider`/`MemoryRouter` ship in it (via the DS's own context modules and `react-router-dom`) even though they aren't separate "components" with their own preview card.

## Build snippet

```jsx
<MemoryRouter>
  <AuthProvider>
    <ThemeProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-secondary)' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 24 }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--card-radius)',
            border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', padding: 24,
          }}>
            <p style={{ color: 'var(--text-primary)', margin: 0 }}>Contenido</p>
          </div>
        </main>
      </div>
    </ThemeProvider>
  </AuthProvider>
</MemoryRouter>
```
