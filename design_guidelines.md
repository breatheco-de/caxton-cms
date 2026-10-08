# Design guidelines

This file is a pointer. Design values live in code and per-site content, so they cannot drift from what renders.

## Colors and palettes (per site)

- Source: the site's `site_<name>/theme.json` — `backgrounds`, `text`, `accents`, `courses` palettes and `colors.light` / `colors.dark` CSS variables.
- A site without its own `theme.json` uses the theme of its `inherit_components_from` parent in [sites.yml](sites.yml) (whole file).
- Section YAML uses theme IDs (`background: light-blue-5`), never raw CSS colors. Components use semantic Tailwind tokens (`bg-card`, `text-muted-foreground`).
- Shared components (`shared/component-registry/`) may only use the shared base palette (`SHARED_BASE_PALETTE` in [shared/theme-palette.ts](shared/theme-palette.ts)).

## App-wide (same on every site)

- Fonts, type scale (`text-h1`, `text-h2`, `text-body`), radius, card shadow and spacing tokens: [tailwind.config.cjs](tailwind.config.cjs).
- Section spacing presets (`none`, `sm`, `md`, `lg`, `xl`) and the section wrapper (background, `paddingY`, `marginY`): `SPACING_PRESETS` / `getSectionWrapperStyles` in [client/src/components/SectionRenderer.tsx](client/src/components/SectionRenderer.tsx).
- Icons: Lucide names via `getIcon` in [client/src/lib/icons.ts](client/src/lib/icons.ts).

## Fallback layer

[client/src/index.css](client/src/index.css) holds default CSS variables and shared utilities. A site's `theme.json` overrides it; do not treat its values as the brand source of truth.

## Building components

Follow [.agents/skills/internal-new-component/SKILL.md](.agents/skills/internal-new-component/SKILL.md) (reuse check, written spec, build, verify, plus the design rules for 4geeks sites).
