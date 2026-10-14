# DESIGN.md

What the code ships: tokens in `src/app/globals.css`, fonts in `src/app/[locale]/layout.tsx`, components in `src/components/`. The look started from SeeAPI's dark design system (seeapi.com, October 2026), with the template's own pine as the primary instead of SeeAPI's lime.

Change a value here and in the code together. When they disagree, the code wins and this file is the bug. `pnpm test` fails if this file names a token `globals.css` doesn't declare, or leaves out a theme token (`src/app/design-tokens.test.ts`).

## 1. Visual Identity

**Keywords:** dark-first · pine accent · monospace headlines · developer-tool feel

Near-black canvas with one accent, pine (2.2). Mono titles, sans sentences (3). A pine glow behind the hero and the final CTA (5). Dark is the default theme; users can pick light, dark or system.

## 2. Color Tokens

Tokens are plain CSS colors (hex or `oklch()`) with shadcn names, declared in `:root` (light) and `.dark` (dark). `@theme inline` maps each one to a Tailwind color, so `--card` is `bg-card` and `--primary-text` is `text-primary-text`. Use the utilities; don't wrap the tokens in `hsl()`.

### 2.1 Neutrals

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--background` | `#0D0D0D` | `#F7F7F3` | Page background, dashboard content |
| `--foreground` | `#F3F4EB` | `#181914` | Primary text (warm off-white / near-black) |
| `--card` | `#171717` | `#FFFFFF` | Cards, panels. Also `bg-surface` |
| `--popover` | `#10110E` | `#FFFFFF` | Menus, popovers |
| `--secondary` / `--muted` | `#212121` | `#F2F3ED` | Secondary buttons, quiet fills, skeletons |
| `--accent` | `#2B2B2B` | `#F2F3ED` | Hover and selected fills in menus |
| `--muted-foreground` | `#A4A69B` | `#65675F` | Secondary text |
| `--border` / `--input` | `#2E2E2E` | `#DDE0D6` | Borders, input borders |
| `--destructive` | `#DF4949` | `#DF4949` | Errors, delete actions |

Each `*-foreground` pair (`--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`) equals `--foreground`.

A bordered card on hover mixes its border toward the text color instead of using a separate token: `hover:border-[color-mix(in_oklch,var(--border),var(--foreground)_20%)]`.

### 2.2 Brand / primary

Pine on near-black has a contrast of 2.9:1, so on dark surfaces it is a fill only. Text, icons and focus rings use `--primary-text`, which keeps the hue and reaches 8.7:1.

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--primary` | `#1F634A` (oklch 0.45 0.08 165) | same | Fills: primary buttons, the avatar |
| `--primary-hover` | `#358264` (oklch 0.55 0.09 165) | `#0A553D` (oklch 0.40 0.08 165) | Lighter on dark, darker on light |
| `--primary-foreground` | `#F7FBF9` (oklch 0.985 0.006 165) | same | Text on pine (6.8:1) |
| `--primary-text` | `#62B995` (oklch 0.72 0.1 165) | `#1F634A` | Pine text, icons, links, eyebrows, active nav |
| `--primary-soft` | `#0D2D21` (oklch 0.27 0.045 165) | `#D6EFE3` (oklch 0.93 0.03 165) | Solid pine-tinted background |
| `--ring` | `#62B995` | `#1F634A` | Focus ring. Equals `--primary-text` |

For a pine tint, use `--primary-text` at low alpha (`bg-primary-text/10`); pine itself at low alpha disappears on near-black.

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--film` | `#F0B04A` | `#D9901F` | Film amber, the projector light. Brand only: the logo's viewfinder and the preview image. Not for UI text or buttons |

### 2.3 Signal colors

Icon tiles and status accents use Tailwind's palette with a fixed recipe: background `<color>-400/12`, icon `<color>-600` on light and `<color>-300` on dark (cyan uses `cyan-700` on light). Pine tiles use `bg-primary-text/12 text-primary-text`. Lists take the colors in this order:

| Order | Signal | Also means |
|---|---|---|
| 1 | Pine | Success |
| 2 | Amber | Warning |
| 3 | Cyan | |
| 4 | Violet | |
| 5 | Pink | Negative |

The chart tokens hold the same five as chart series. No chart uses them yet.

| Token | Dark | Light |
|---|---|---|
| `--chart-1` (pine) | `#62B995` | `#1F634A` |
| `--chart-2` (cyan) | `#67E8F9` | `#19B3BE` |
| `--chart-3` (violet) | `#C4B5FD` | `#A72AEF` |
| `--chart-4` (amber) | `#FCD34D` | `#FFA929` |
| `--chart-5` (pink) | `#F65A96` | `#E9206D` |

### 2.4 Sidebar

| Token | Dark | Light |
|---|---|---|
| `--sidebar` | `#080908` | `#F2F3ED` |
| `--sidebar-foreground` | `#F3F4EB` | `#181914` |
| `--sidebar-accent` | `#1F1F1F` | `#E3E5DC` |
| `--sidebar-accent-foreground` | `#F3F4EB` | `#181914` |
| `--sidebar-border` | `rgb(255 255 255 / 0.08)` | `#DDE0D6` |
| `--sidebar-primary` | pine | pine |
| `--sidebar-primary-foreground` | `#F7FBF9` | `#F7FBF9` |
| `--sidebar-ring` | `#62B995` | `#1F634A` |

## 3. Typography

Fonts load with `next/font/google` in `src/app/[locale]/layout.tsx`.

| Variable | Font | Use |
|---|---|---|
| `--font-sans` (`font-sans`, also `--font-heading`) | Geist | Body, UI, dashboard page titles |
| `--font-display` (`font-display`) | Martian Mono, then `"PingFang SC"`, `"Noto Sans SC"`, `ui-monospace` | Titles, labels, numbers. Chinese falls back to the system sans |
| `--font-mono` (`font-mono`) | Geist Mono | Code |

Pairing rule: **mono for anything that is a title, label or number; sans for sentences.**

| Role | Classes | Where |
|---|---|---|
| Hero H1 | `font-display font-bold text-[2.25rem] leading-[1.15] sm:text-5xl sm:leading-[1.2] display-tight break-keep` (Chinese breaks only after punctuation) | `home/hero.tsx` |
| Section H2 | `font-display font-bold text-3xl sm:text-4xl leading-tight display-tight` | `home/section-heading.tsx` |
| Card title | `font-display text-lg font-semibold` | Home tools and steps |
| FAQ question | `font-display font-bold text-base sm:text-lg` | `home/faq.tsx` |
| Lead | `text-lg sm:text-xl leading-8 text-muted-foreground` | Hero |
| Body | 16px Geist; `text-muted-foreground` for secondary text | Everywhere |
| Eyebrow | `.eyebrow`: 12px, 800, uppercase, `0.14em` tracking (`0.08em` in Chinese), `--primary-text` | Above section titles, footer column titles |
| Dashboard page title | `text-3xl sm:text-4xl font-black tracking-[-0.025em]` (Geist) | `dashboard/page-header.tsx` |
| Page description | `text-sm leading-6 text-muted-foreground` | Page header |
| Stat label | `text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground` | `dashboard/stat-cards.tsx` |
| Stat value | `text-2xl sm:text-3xl font-black tracking-[-0.025em] tabular-nums` | Stat cards |
| Small caps label | `text-xs font-semibold uppercase tracking-[0.08em]` | Badges, step numbers, footer bar |

`.display-tight` tightens Latin display text (`-0.022em`) and leaves Chinese at normal spacing. `.legal-prose` sets legal text to line-height 1.75 (1.85 in Chinese).

## 4. Spacing, Layout & Radius

- **Containers:** marketing pages, header and footer use `max-w-6xl` (1152px) with `px-5 sm:px-8`. Dashboard content uses `max-w-7xl` (1280px) with `px-5 py-8 sm:px-8 sm:py-10` and `gap-8` between blocks.
- **Sections:** home sections are `py-20` with a top border.
- **Header:** 64px (`h-16`) sticky nav.
- **Base radius:** `--radius: 0.75rem` (12px). The scale adds whole pixels to it, so every step is a whole number: `rounded-sm` 8px, `rounded-md` 10px, `rounded-lg` 12px, `rounded-xl` 16px, `rounded-2xl` 20px, `rounded-3xl` 24px, `rounded-4xl` 28px (`globals.css`, `@theme inline`).

| Element | Radius |
|---|---|
| Buttons, inputs, sidebar sub-items | `rounded-lg` 12px. Small buttons 10px |
| Cards, panels, sidebar items, icon tiles | `rounded-xl` 16px |
| Large panels (generation console, final CTA, user menu) | `rounded-2xl` 20px |
| Pills, badges, avatars, theme switcher | `rounded-full` |
| Skeleton blocks | `rounded-md` 10px |

Nest at least one step smaller than the container.

## 5. Effects

| Effect | Classes |
|---|---|
| Sticky nav | `border-b bg-background/65 backdrop-blur-xl backdrop-saturate-150` |
| Hero badge | `rounded-full border border-primary-text/60 bg-background/55 backdrop-blur-md`, with a `--primary-text` dot |
| Glow | `Glow` in `home/section-heading.tsx`: `radial-gradient(closest-side, var(--primary-text), transparent)`, `opacity-15 blur-2xl`. Behind the hero and the final CTA |
| Border glow | `.border-glow` wrapper on the hero `GenerationConsole`: two arcs, teal through green and lime to amber, run around the 1px border every 8s, with a `blur(28px)` copy at 45% behind. Static with reduced motion |
| Tool card | `bg-gradient-to-br from-muted/70 to-transparent`, border, hover border mix |

## 6. Components

### Buttons (`ui/button.tsx`)

| Variant | Look |
|---|---|
| `default` | `bg-primary text-primary-foreground`, hover `bg-primary-hover` |
| `outline` | Border, `bg-background` (dark: `bg-input/30`), hover `bg-muted` |
| `secondary` | `bg-secondary`, hover mixes in 5% foreground |
| `ghost` | Transparent, hover `bg-muted` |
| `destructive` | `bg-destructive/10 text-destructive` |
| `link` | `text-primary-text`, underline on hover |

Sizes: `default` 40px (`h-10 px-4`), `lg` 44px (`h-11 px-5 text-base`), `sm` 28px, `xs` 24px, icon sizes 24-36px. Text is 14px/500. Buttons move down 1px while pressed.

`PrimaryLink` (`home/primary-link.tsx`) is a `lg` primary button link with a trailing arrow that nudges on hover (`.icon-nudge`). The hero's secondary link is a 44px `rounded-full` pill with `bg-card` and a border.

### Inputs (`ui/input.tsx`)

40px high, `rounded-lg`, `px-3`, `--input` border.

### Cards

Base card: `rounded-xl border bg-card p-5`. Empty states use `rounded-xl border border-dashed` with muted, centered text.

### Site header and footer (`layout/`)

- Header: `Brand` (the logo mark (7.1) and the project name in `font-display font-semibold`), then the Pricing and Blog links, the language menu and an account button: Sign in for visitors, Dashboard once signed in. Links are `text-sm font-semibold` and underline on hover; the account button is a primary button, `h-9 px-2.5` below `sm`. Below `sm` the Blog link hides, the language menu shows only its icon and the gaps shrink from 24px to 8px, so the header fits a 320px phone.
- Footer: brand and blurb, then link columns (Product, Support, Legal) with `.eyebrow` titles and the theme switcher; a bottom bar with the copyright in `text-xs uppercase tracking-[0.08em]`.

### Theme switcher (`layout/theme-switcher.tsx`)

A `rounded-full bg-muted p-1` group of three icon buttons: Sun (light), Moon (dark), Monitor (system). The checked one gets `bg-accent`.

### Home (`home/`)

1. **Hero:** two columns on large screens. Left: badge, H1, lead, `PrimaryLink`, the secondary pill (to the prompt ideas) and two check items. Right: the generation console. Stacked on phones.
2. **Prompt ideas** (`ideas.tsx`): six sample prompts as tiles over scenes, in a dense 4 × 3 grid of uneven sizes on large screens and two columns on phones. Each tile has a kind chip (`bg-black/45`) and the prompt over a `from-black/75` scrim, white in both themes. The scene scales to 1.03 on hover.
3. **Tools** (`features.tsx`): text to image leads with a large panel holding a scene; image to video and rap duo stack beside it. Each card has an icon tile, a mono meta label and a pine link to the tool.
4. **Steps** (`how-it-works.tsx`): three columns under a 2px top rule, with a large mono number. The first step's rule and number are `--primary-text`.
5. **FAQ accordion:** `<details>` rows. When a row is open, its number circle and plus button fill with `--foreground`, and the plus turns 45° (`.icon-turn`).
6. **Final CTA:** a `rounded-2xl` card with a glow, a badge, a title, `PrimaryLink` and three `--primary-text` check items.

`home/generation-console.tsx` is an HTML stand-in for the product: a prompt, a finished image and a video still rendering. `home/scene.tsx` draws the images with CSS gradients and clipped shapes; replace them with real work made with the product.

### Blog (`blog/`)

Posts list as base cards: date, a card title (3) that links the whole card, description, tags. Tags are `rounded-full border px-2.5 py-0.5 text-xs font-semibold` links with the hover border mix. A post page shows the date, a `text-3xl sm:text-4xl` display title, the description and the tags, then the body in `.legal-prose`.

### Icon tiles

`flex size-10 items-center justify-center rounded-xl` with a signal tint (2.3) and a 20px icon. Stat cards use 32px tiles (`size-8 rounded-lg`) on phones and 40px tiles (`sm:size-10 sm:rounded-xl`) above.

## 7. Iconography

- `lucide-react` only; ESLint blocks other icon libraries.
- Stroke width 1.75, set once on `svg.lucide` in `globals.css`.
- Sizes: 16px in buttons (the button default), 18px in sidebar items, 20px in tiles.
- Icons are `aria-hidden` by default; give icon-only buttons an `aria-label`.

### 7.1 Logo

- **Mark** (`layout/logo-mark.tsx`): four rounded viewfinder corners in `--film` around the brand dot in `--primary-text`, which leaves a short `--primary-text/35` trail to its left: a frame, and a picture that moves. 32-unit grid, 3-unit strokes. Shown at 24px (`size-6`) next to the name.
- **Favicon** (`src/app/icon.svg`, `favicon.ico`, `apple-icon.png`): the dark-theme mark on a `#0D0D0D` tile with a 7-unit radius, so it reads on light and dark browser tabs.
- **Preview image** (`src/app/_lib/og-image.tsx`): film strip perforations along the top and bottom edges, lit in `--film`; the mark and the name, then the title and description, on the dark canvas.

## 8. Motion

Transform and opacity only, 120-200ms. Every class below turns off under `prefers-reduced-motion`.

| Class | Motion |
|---|---|
| `.icon-nudge` | Arrow moves 3px right when its link or button is hovered |
| `.icon-turn` | Plus turns 45° inside an open `<details>` |
| `.icon-swap` | Cross-fade and scale between two icons |

The generation console has ambient loops instead: `.render-progress` fills the progress bar every 6s, `.render-scan` sweeps a band of light across the video every 3s, `.scene-drift` slowly zooms the video frame over 12s and `.render-caret` blinks the prompt caret. With reduced motion they stop, and the bar holds at 62%.

Cards change only their border color on hover. Hover styles apply only on devices that hover (`@media (hover: hover)`).

## 9. Dashboard

### 9.1 Layout shell

```
┌──────── 256px ────────┬────────────────── fluid ──────────────────┐
│ Brand · bell · ‹      │ Page header: title + description | action │
│                       │                                           │
│ Nav items             │ Content (max-w-7xl, gap 32px)             │
│                       │                                           │
│ User menu (avatar)    │                                           │
└───────────────────────┴───────────────────────────────────────────┘
```

- **Sidebar** (`dashboard/app-sidebar.tsx`, shadcn `Sidebar` with `variant="inset"` and `collapsible="icon"`): 256px (`SIDEBAR_WIDTH` 16rem), 48px collapsed, 288px as a sheet on phones. Background `--sidebar`. The `sidebar_state` cookie keeps it collapsed or open. Links sit in groups: the dashboard home on top, then "Create" (chat, images, videos) and "Account" (credits and billing) under a `SidebarGroupLabel`, then Admin for admins. Labels hide when the sidebar is collapsed.
- **Nav item:** `h-10 rounded-xl px-3`, 18px icon. Active: `bg-primary-text/10 text-primary-text`. Sub-items: `h-8 rounded-lg`; active changes only the text color and weight.
- **Content panel:** `bg-background`; on desktop it sits on the sidebar color, inset with `m-2 rounded-xl shadow-sm`.
- **Phone bar** (`dashboard/mobile-trigger.tsx`): a 36px menu button, the brand and the notification bell.
- **Loading** (`dashboard/shell-skeleton.tsx`): mirrors the shell with `Skeleton` blocks (`animate-pulse rounded-md bg-muted`). Inside a page, `dashboard/page-skeleton.tsx` outlines the content (and the page header with `header`), and `admin/list-skeleton.tsx` outlines admin lists. "Loading…" is for screen readers only.

### 9.2 Components

**Page header** (`dashboard/page-header.tsx`): title and description on the left, an optional action on the right; it wraps on small screens.

**Stat card** (`dashboard/stat-cards.tsx`): base card with `p-4 sm:p-5`, 2 columns on phones and 4 on large screens (`gap-3 sm:gap-4`). Uppercase label → large black value → 11px footnote, with an icon tile top-right. A card with a link is focusable and gets the hover border.

**User menu** (`dashboard/user-menu.tsx`): the trigger is the avatar, name and email at the bottom of the sidebar. The menu is `w-80 rounded-2xl p-3` and holds, in order:

1. Profile row: avatar, name, email.
2. Plan card: `rounded-xl border border-primary-text/40 bg-primary-text/5 p-4`, the plan label as a mono eyebrow in `--primary-text`, the plan name in 22px black, and a faint icon on the right.
3. Credits row: balance in `font-display text-lg font-bold`.
4. Upgrade (Manage subscription for subscribers) and Profile items.
5. Language and theme.
6. Sign out.

**Pagination** (`dashboard/pagination.tsx`): "Page N of M" in muted tabular numbers, with previous and next buttons.
