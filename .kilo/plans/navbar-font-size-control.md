# Navbar Font Size Control

## Goal
Add a 3-level font size control to the header navbar: 标准 (standard = current 16px), 大 (large = 18px), 超大 (extra large = 20px). Choice persists across reloads and applies globally.

## Decisions (confirmed)
- **Mechanism**: scale root `font-size` on `<html>` (`document.documentElement.style.fontSize`). Vuetify is rem-based, so this uniformly scales all typography and rem-based spacing (pa-4, etc.). Fixed-px sizes (e.g. data-table `width: '88'`, icon `size="20"`) are unaffected — acceptable.
- **Values**: standard = remove override (return to default 16px); large = `18px`; xlarge = `20px`.
- **Persistence**: `cookieRef('font-size', 'standard')` in the config store (SSR-safe cookie, mirrors existing `theme` pattern).
- **UI**: new `NavbarFontSizeSwitcher.vue` mirroring `ThemeSwitcher` (IconBtn + VTooltip + VMenu + VList, 3 items), placed in both navbars next to `NavbarThemeSwitcher`.
- **i18n**: new namespace `components.fontSizeSwitcher` (zh/en/fr).

## Reference files
- `src/@core/components/ThemeSwitcher.vue` — UI pattern to mirror (IconBtn → VMenu → VList with `v-model:selected`, reads/writes a config store ref).
- `src/layouts/components/NavbarThemeSwitcher.vue` — thin wrapper that supplies the option list; mirror this for the font switcher.
- `src/@core/stores/config.js` — `useConfigStore` (cookieRef usage) and `initConfigStore()` (watch + apply pattern).
- `src/App.vue` — calls `initConfigStore()`.
- `src/layouts/components/DefaultLayoutWithVerticalNav.vue` & `DefaultLayoutWithHorizontalNav.vue` — navbar slot where the switcher is placed.

## Tasks

### 1. `src/@core/stores/config.js`
- In `useConfigStore`, add: `const fontSize = cookieRef('font-size', 'standard')` and return it (alongside `theme`).
- In `initConfigStore()`:
  - Add a helper to apply: map `standard`→removeProperty, `large`→`'18px'`, `xlarge`→`'20px'` onto `document.documentElement.style.fontSize`. Guard with `if (typeof document !== 'undefined')`.
  - `watch(() => configStore.fontSize, apply, { immediate: true })` so changes persist live. (Watcher fires client-side; `immediate` handles initial apply. No separate onMounted needed since App.vue setup runs on client for SPA/Nuxt hydration — but keep the document guard for SSR safety.)

### 2. `src/layouts/components/NavbarFontSizeSwitcher.vue` (new)
- Mirror `NavbarThemeSwitcher.vue` + `ThemeSwitcher.vue`:
  - `const configStore = useConfigStore()` (import from `@core/stores/config`).
  - `selectedItem = ref([configStore.fontSize])`; watch `configStore.fontSize` to keep it synced.
  - Option list:
    - `{ value: 'standard', icon: 'tabler-letter-a' }` (or `tabler-baseline`/`tabler-text-resize` — pick one that exists; `tabler-text-resize` preferred)
    - `{ value: 'large', icon: 'tabler-letter-b' }` (use `tabler-text-increase`? keep consistent simple letters or Aa icons; recommended: `tabler-letter-a`, `tabler-letter-b`, `tabler-letter-c` OR a single `tabler-text-resize` icon with size hints). Final choice: single icon `tabler-text-resize` on the button; each list item uses `tabler-letter-a`/`tabler-letter-b`/`tabler-letter-c` to imply relative size.
  - Template: `IconBtn` (same color style as ThemeSwitcher) → `VTooltip` (text = `t('components.fontSizeSwitcher.tooltip')`) → `VMenu` (offset 12px, width 180) → `VList` (`v-model:selected="selectedItem"`, `mandatory`) with `VListItem` per option; `@click` sets `configStore.fontSize = value`; title from i18n (`standard`/`large`/`xlarge`).

### 3. Navbar placement
- `src/layouts/components/DefaultLayoutWithVerticalNav.vue`: import `NavbarFontSizeSwitcher`; place `<NavbarFontSizeSwitcher />` immediately after `<NavbarThemeSwitcher />`.
- `src/layouts/components/DefaultLayoutWithHorizontalNav.vue`: same placement (after `<NavbarThemeSwitcher />`).

### 4. i18n — add `components.fontSizeSwitcher` to zh/en/fr
- zh: `tooltip`="字体大小", `standard`="标准", `large`="大", `xlarge`="超大"
- en: `tooltip`="Font size", `standard`="Standard", `large`="Large", `xlarge`="Extra large"
- fr: `tooltip`="Taille de police", `standard`="Standard", `large`="Grand", `xlarge`="Très grand"
- Insert near other `components.*` keys (e.g. after `printLabelProducts` or beside `addressBookPicker`).

## Risks / edge cases
- Root font-size scaling also scales rem-based spacing (Vuetify `pa-*`, `ma-*`, table cell paddings) — expected and uniform; verify dense tables (e.g. product list, shipping list) still render acceptably at xlarge.
- SSR: never touch `document` during SSR; guard all writes with `typeof document !== 'undefined'`. `cookieRef` handles SSR persistence via Nuxt cookie.
- `standard` must restore the default (use `removeProperty('font-size')`, not a hard `16px`, so it respects the browser/app default).
- Confirm the chosen tabler icon names exist in the installed `@tabler/icons-vue` set; if `tabler-text-resize` is missing, fall back to `tabler-typography` for the button and `tabler-letter-a/b/c` for items.

## Validation
- Toggle each level in vertical nav layout → text + spacing scale; switch to horizontal nav layout → switcher present and works.
- Reload page → choice persists (cookie).
- Select `standard` → returns to default sizing exactly.
- Run `npm run lint` (no new errors introduced).
