

## Task 1: Dark Mode with Light/Dark/System Toggle

### Current State
- The app has 5 **color themes** (Cyber, Ember, Aurora, Phantom, Sakura) — all dark-only.
- Light mode CSS variables already exist in `:root` but are never used because the provider always forces `dark` class.
- No hardcoded gray/white/slate colors found — all components use CSS variables already.
- Sonner toaster incorrectly imports `useTheme` from `next-themes` instead of the custom hook.

### Approach
Extend the existing theme system to support a **mode** dimension (light / dark / system) alongside the existing color theme picker. Each color theme will get a light variant in CSS.

### Changes

**1. Extend `src/hooks/useTheme.tsx`**
- Add `mode: "light" | "dark" | "system"` and `resolvedMode: "light" | "dark"` to context
- Listen to `matchMedia("(prefers-color-scheme: dark)")` when mode is "system"
- Toggle `dark` class on `documentElement` based on `resolvedMode` (instead of always adding it)
- Persist mode to `localStorage` key `rocketboard-mode`

**2. Create `src/components/ThemeToggle.tsx`**
- Segmented button: Sun | Monitor | Moon icons
- Animated highlight using framer-motion
- Compact variant for sidebar (icon-only cycle when collapsed)

**3. Update CSS (`src/index.css`)**
- Each color theme gets light variants using compound selectors:
  - `.theme-cyber` (without `.dark`) → light cyber colors
  - `.theme-cyber.dark` → existing dark cyber colors
  - Same for ember, aurora, phantom, sakura
- `:root` keeps current light defaults (acts as cyber-light fallback)
- `.dark` alone keeps current dark defaults (cyber-dark fallback)

**4. Add light variants for all 5 themes**
- Light variants will use the same primary/accent hues but with light backgrounds (95-98% lightness), dark text, and subtle borders — maintaining each theme's color identity.

**5. Update `ThemeSwitcher.tsx`**
- Add the `ThemeToggle` (light/dark/system) above the color theme grid

**6. Add ThemeToggle to sidebar footer** (`AppSidebar.tsx`)
- Between user email and sign-out button
- When collapsed: single icon button that cycles modes

**7. Add ThemeToggle to Settings page** (`SettingsPage.tsx`)
- Inside the existing "Theme" section, above the color swatches

**8. Fix `sonner.tsx`**
- Replace `next-themes` import with custom `useTheme` hook, pass `resolvedMode` as theme prop

**9. Update `MermaidDiagram.tsx`**
- Read `resolvedMode` from theme context
- Re-initialize mermaid with `theme: "dark"` or `"default"` when mode changes

**10. Add theme transition CSS**
- Brief `transition: background-color 0.2s, color 0.2s, border-color 0.2s` during switches via a `.theme-transitioning` class applied/removed by the provider

### Files Modified
- `src/hooks/useTheme.tsx` — extend with mode + resolvedMode
- `src/index.css` — light variants for all 5 color themes + transition utility
- `src/components/ThemeToggle.tsx` — new component
- `src/components/ThemeSwitcher.tsx` — integrate ThemeToggle
- `src/components/AppSidebar.tsx` — add toggle to footer
- `src/pages/SettingsPage.tsx` — no changes needed (ThemeSwitcher already includes it)
- `src/components/ui/sonner.tsx` — fix import
- `src/components/MermaidDiagram.tsx` — theme-aware rendering

