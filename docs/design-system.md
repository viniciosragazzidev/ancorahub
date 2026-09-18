# Dub — Style Reference
> frosted link dashboard on rice paper

**Theme:** light, with a dark companion (Fase 2 extension — see "Dark Mode" below)

Dub's visual system is a quiet, almost editorial SaaS aesthetic — a near-white canvas held together by hairline borders rather than elevation, with dense monochrome typography doing the structural work and one electric blue (#2563eb) doing the talking. Surfaces stay flat and borderless-looking at a glance, but every container carries a 1px #e5e5e5 edge that creates a printed-document feel. The personality comes from a small vocabulary of colored 'feature pill' accents (orange, green, violet) that float above the otherwise neutral palette, and from Satoshi-weight-500 display headlines that read as confident and contemporary without being loud. Components are compact and dense: 8px gaps, 12px card radius, pill-shaped tags at 9999px, and ghost controls instead of heavy filled buttons.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page background, card surfaces, popover panels — the absolute base of every screen |
| Paper Mist | `#f5f5f5` | `--color-paper-mist` | Subtle alt-surface for nested cards, secondary panels, and hover fills |
| Ash | `#e5e5e5` | `--color-ash` | Hairline borders on cards, inputs, and dividers — the structural line that holds the system together |
| Smoke | `#d4d4d4` | `--color-smoke` | Stronger borders for emphasis containers and secondary button outlines |
| Pebble | `#c8c8c8` | `--color-pebble` | Medium-contrast borders, control outlines, and structural separators. Do not promote it to the primary CTA color |
| Midnight Ink | `#0a0a0a` | `--color-midnight-ink` | Primary button text, high-emphasis buttons, nav text — near-black for maximum contrast |
| Charcoal | `#171717` | `--color-charcoal` | Body text, button text, default heading color — slightly softer than pure black |
| Graphite | `#262626` | `--color-graphite` | Secondary text, icon strokes, subtle UI elements |
| Slate | `#404040` | `--color-slate` | Tertiary text, nav hover states, subdued iconography |
| Steel | `#525252` | `--color-steel` | Muted body text, helper text, less-prominent labels |
| Fog | `#737373` | `--color-fog` | Placeholder text, disabled states, link text in rest state |
| Silver | `#a3a3a3` | `--color-silver` | Disabled iconography, decorative strokes, very light dividers |
| Electric Blue | `#2563eb` | `--color-electric-blue` | Primary brand color — logo, links, key metric highlights, active states, icon accents. Saturated blue against white gives the system its one moment of visual voltage |
| Deep Sapphire | `#1e40af` | `--color-deep-sapphire` | Primary action button background, high-emphasis CTA fill — the single committed action color, used sparingly so it earns attention |
| Soft Mint | `#dcfce7` | `--color-soft-mint` | Gray outline accent for tags, dividers, and focused UI edges. Use as a supporting accent, not as a status color |
| Vivid Green | `#16a34a` | `--color-vivid-green` | Green text accent for links, tags, and emphasized short phrases. Use as a supporting accent, not as a status color |
| Tangerine | `#ea580c` | `--color-tangerine` | Orange text accent for links, tags, and emphasized short phrases. |
| Lavender | `#7c3aed` | `--color-lavender` | Violet text accent for links, tags, and emphasized short phrases. |
| Conic Spectrum | `conic-gradient(from -81deg, #ff0000, #eab308 99deg, #5cff80 162deg, #00fff9 216deg, #3a8bfd 288deg, #855afc)` | `--color-conic-spectrum` | Decorative gradient — used as full-spectrum conic gradient on brand visuals and logo, never on UI elements |
| Primary Action Fill | `#000000` | `--color-primary-action-fill` | High-contrast neutral action fill for primary buttons on light surfaces. Use as the primary filled action background |
| Powder Blue | `#dbeaff` | `--color-powder-blue` | Info status tint, active Sidebar Nav Item background. Pairs with Electric Blue text/icon on top |
| Amber Wash | `#fef3c7` | `--color-amber-wash` | Pending/warning status tint (background only) |
| Amber Ink | `#92400e` | `--color-amber-ink` | Pending/warning status text, paired with Amber Wash |
| Rose Wash | `#fee2e2` | `--color-rose-wash` | Destructive/error status tint (background only). The system has no other red — reserved for this pairing |
| Rose Ink | `#991b1b` | `--color-rose-ink` | Destructive/error status text, paired with Rose Wash |
| Forest Ink | `#166534` | `--color-forest-ink` | Success/completed status text, paired with Soft Mint. Darker than Vivid Green for AA contrast at small sizes |

> Added in the Fase 1 extension (docs/implementations — /dashboard and /distribuicao pilots) to cover semantic status states the original palette didn't name. Same rule applies: don't invent a new pairing without adding it here first.

## Dark Mode

Added in the Fase 2 extension (docs/implementations — /dashboard pilot), after the user asked to support both themes. Applies via the same `.dark` class the rest of the app already uses on `<html>` — no new toggle mechanism.

**Neutral ramp:** the light-mode neutral ramp (Canvas White → Midnight Ink, 12 steps from `#ffffff` to `#0a0a0a`) is mirrored end-to-end for dark mode — same 12 hex values, roles reassigned in reverse. No new neutral color introduced.

| Token | Light value | Dark value |
|---|---|---|
| Canvas White | `#ffffff` | `#0a0a0a` (was Midnight Ink) |
| Paper Mist | `#f5f5f5` | `#171717` (was Charcoal) |
| Ash | `#e5e5e5` | `#262626` (was Graphite) |
| Smoke | `#d4d4d4` | `#404040` (was Slate) |
| Pebble | `#c8c8c8` | `#525252` (was Steel) |
| Silver | `#a3a3a3` | `#737373` (was Fog) |
| Fog | `#737373` | `#a3a3a3` (was Silver) |
| Steel | `#525252` | `#c8c8c8` (was Pebble) |
| Slate | `#404040` | `#d4d4d4` (was Smoke) |
| Graphite | `#262626` | `#e5e5e5` (was Ash) |
| Charcoal | `#171717` | `#f5f5f5` (was Paper Mist) |
| Midnight Ink | `#0a0a0a` | `#ffffff` (was Canvas White) |

**Chromatic:** Electric Blue brightens to `#3b82f6` for legibility on dark surfaces. Deep Sapphire (the single reserved CTA color) is promoted to light mode's Electric Blue value (`#2563eb`) in dark mode, so it stays the more saturated of the two blues — same relative hierarchy as light mode, not a coincidence. Primary Action Fill flips `#000000` → `#ffffff`; combined with the neutral mirror, this makes the Filled Dark CTA automatically render as a light-fill/dark-text button in dark mode and the Input Field's black-border exception automatically become a white-border exception — through the existing tokens, no component-level dark variant needed.

| Token | Light value | Dark value |
|---|---|---|
| Electric Blue | `#2563eb` | `#3b82f6` |
| Deep Sapphire | `#1e40af` | `#2563eb` |
| Primary Action Fill | `#000000` | `#ffffff` |
| Vivid Green | `#16a34a` | `#4ade80` |
| Tangerine | `#ea580c` | `#fb923c` |
| Lavender | `#7c3aed` | `#a78bfa` |

**Status tint/ink pairs:** a light tint doesn't work as a dark-mode wash (too bright against a dark canvas), so these six are genuinely new values — following the standard dark-mode convention of a near-950 wash paired with a 400-ish ink:

| Token | Light value | Dark value |
|---|---|---|
| Soft Mint | `#dcfce7` | `#052e1a` |
| Forest Ink | `#166534` | `#4ade80` (aliases dark Vivid Green) |
| Powder Blue | `#dbeaff` | `#16243d` |
| Amber Wash | `#fef3c7` | `#3a2408` |
| Amber Ink | `#92400e` | `#fbbf24` |
| Rose Wash | `#fee2e2` | `#3d0e0e` |
| Rose Ink | `#991b1b` | `#f87171` |

**Shadows:** left as literal `rgba(0,0,0,…)` values in dark mode rather than inverted — a black shadow is naturally quieter against an already-dark canvas, which matches the common dark-UI convention of leaning on border/lightness contrast over shadow for elevation. Not a gap, a deliberate non-change.

## Tokens — Typography

### Satoshi — Display headings — used only at 36–48px for hero and section titles. Weight 500 (medium, not bold) is the signature: headings feel confident and modern but never shout. Satoshi's geometric proportions give the type a slightly editorial, contemporary feel that Inter body text can't replicate. · `--font-satoshi`
- **Substitute:** Inter (weight 500, letter-spacing -0.02em) or General Sans
- **Weights:** 500
- **Sizes:** 36px, 40px, 48px
- **Line height:** 1.0–1.11
- **Letter spacing:** normal
- **Role:** Display headings — used only at 36–48px for hero and section titles. Weight 500 (medium, not bold) is the signature: headings feel confident and modern but never shout. Satoshi's geometric proportions give the type a slightly editorial, contemporary feel that Inter body text can't replicate.

### Inter — Body, UI labels, navigation, subheadings, small headings. Inter is the workhorse — handles everything from 11px micro-labels to 30px secondary headlines. Weight 400 is default body, 500 for emphasis and button labels, 600 reserved for important UI labels. The 16px size at lineHeight 1.5 is the most frequent single step (1220 occurrences), confirming 16px as the canonical body size. · `--font-inter`
- **Substitute:** Inter (native)
- **Weights:** 400, 500, 600
- **Sizes:** 8px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 24px, 30px
- **Line height:** 1.33–1.56
- **Role:** Body, UI labels, navigation, subheadings, small headings. Inter is the workhorse — handles everything from 11px micro-labels to 30px secondary headlines. Weight 400 is default body, 500 for emphasis and button labels, 600 reserved for important UI labels. The 16px size at lineHeight 1.5 is the most frequent single step (1220 occurrences), confirming 16px as the canonical body size.

### Geist Mono — Code snippets, technical metadata, inline monospace tokens. Used at 12–14px in code blocks and 24px for large code display elements. Provides the developer-tool credibility that matches Dub's product positioning. · `--font-geist-mono`
- **Substitute:** JetBrains Mono or IBM Plex Mono
- **Weights:** 400, 500
- **Sizes:** 12px, 14px, 24px
- **Line height:** 1.0–1.43
- **Role:** Code snippets, technical metadata, inline monospace tokens. Used at 12–14px in code blocks and 24px for large code display elements. Provides the developer-tool credibility that matches Dub's product positioning.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.5 | — | `--text-caption` |
| body | 14px | 1.43 | — | `--text-body` |
| body-lg | 16px | 1.5 | — | `--text-body-lg` |
| body-xl | 18px | 1.56 | — | `--text-body-xl` |
| subheading | 20px | 1.4 | — | `--text-subheading` |
| heading-sm | 24px | 1.33 | — | `--text-heading-sm` |
| heading | 30px | 1.38 | — | `--text-heading` |
| heading-lg | 36px | 1.11 | — | `--text-heading-lg` |
| display | 48px | 1 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 112 | 112px | `--spacing-112` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 9999px |
| cards | 12px |
| inputs | 6px |
| buttons | 8px |
| largeCards | 16px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` | `--shadow-subtle` |
| sm | `rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0...` | `--shadow-sm` |
| sm-2 | `rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset` | `--shadow-sm-2` |
| subtle-2 | `rgba(0, 0, 0, 0.1) 0px 0px 0px 4px` | `--shadow-subtle-2` |
| md | `rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1)...` | `--shadow-md` |
| lg | `rgba(0, 0, 0, 0.09) 0px 20px 20px 0px` | `--shadow-lg` |
| subtle-3 | `rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px ...` | `--shadow-subtle-3` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 64px
- **Card padding:** 16px
- **Element gap:** 8px

## Components

### Ghost Nav Button
**Role:** Navigation bar item

Transparent background, #171717 text, 9999px radius, no border, 16px horizontal padding. Used for top-level nav items like Product, Solutions, Resources, Enterprise. No visible border until hover.

### Outlined Nav Button
**Role:** Secondary nav action (Log in)

White background (#ffffff), #171717 text, 1px #e5e5e5 border, 8px radius, 16px horizontal padding. Compact and quiet — the 'I'm here but I don't need to be seen' variant.

### Filled Dark CTA
**Role:** Primary action button (Sign up)

Near-black background (#0a0a0a or #171717), white text, 8px radius, 16px horizontal padding. The committed action — used once per surface for the primary conversion goal.

### Outlined Action Button
**Role:** Secondary or utility action (Learn more, View invoices)

White background, #171717 text, 1px #e5e5e5 border, 8px radius, 12px vertical / 16px horizontal padding. The workhorse button — used for most non-primary actions throughout the UI.

### Pill Feature Tag
**Role:** Feature category indicator in hero and nav

Transparent or white background, small colored icon (orange/violet/green emoji-style glyph), #171717 label text, 9999px radius, 12px vertical / 16px horizontal padding. These floating pills (Affiliate Programs, Conversion Analytics, Short Links) are the system's signature decorative element.

### Pill Badge
**Role:** Status, count, or label indicator

Transparent or white background, #0a0a0a text, 9999px radius, minimal padding. Used for small notification dots, version labels, and category markers.

### Dashboard Card
**Role:** Primary product surface container

White background (#ffffff), 1px #e5e5e5 border, 12px radius, 8px internal padding. The most frequent component (57 variants) — flat, border-defined, no shadow. Rely on borders and spacing for visual structure, not elevation.

### Elevated Feature Card
**Role:** Showcase or feature card with depth

White background, 16px radius, 16px padding, subtle box-shadow: rgba(0,0,0,0.1) 0px 0px 0px 4px ring effect. Used sparingly to lift hero product mockups and featured content above surrounding flat cards.

### Muted Alt Card
**Role:** Secondary panel or grouped content surface

Light gray background (#fafafa), 16px radius, 16px padding, no border. Provides tonal contrast when nesting content inside a white card or on the white canvas.

### Dashboard Table Row
**Role:** Data table body row

Transparent or white background, 1px #e5e5e5 bottom border, 14–16px text. Minimal vertical density — rows breathe with generous padding for scannability.

The original spec said "16px row height," which is smaller than the text it holds — resolved as **16px vertical padding** (`--spacing-16`, both axes), giving ~48px of real row height with 14–16px text, not a literal 16px-tall row. Header row: same 1px bottom border, caption (11px) uppercase text in Fog `#737373`. Hover (clickable rows): Paper Mist `#f5f5f5` fill, no border change.

### Status Badge (semantic variants)
**Role:** Row-level state indicator in tables and lists

Tinted background, small colored dot icon, dark text, pill radius (9999px). Compact inline state communication.

Padding: the spec text above says 6px/10px, but that isn't on the spacing scale (4, 8, 12, 16…). Built as **4px vertical / 8px horizontal** (`--spacing-4`/`--spacing-8`) — the nearest values actually on the scale, confirmed over the literal 6/10.

| Variant | Background | Text | Notes |
|---|---|---|---|
| pending | Amber Wash `#fef3c7` | Amber Ink `#92400e` | original "pending" — no exact hex was in the doc, confirmed with the team |
| completed | Soft Mint `#dcfce7` | Forest Ink `#166534` | original "completed" |
| success | Soft Mint `#dcfce7` | Forest Ink `#166534` | alias of "completed" — same tone, different label |
| warning | Amber Wash `#fef3c7` | Amber Ink `#92400e` | alias of "pending" — same tone, different label |
| info | Powder Blue `#dbeaff` | Electric Blue `#2563eb` | never Deep Sapphire here — that color is reserved for the single primary CTA per surface, never decorative |
| secondary | Paper Mist `#f5f5f5` | Steel `#525252` | neutral/no-status tone |
| destructive | Rose Wash `#fee2e2` | Rose Ink `#991b1b` | the system's only red pairing — don't introduce another red elsewhere |

### Sidebar Nav Item
**Role:** Dashboard sidebar navigation

Transparent or light blue (#dbeaff) active background, 8px radius, #171717 text, 12px vertical / 8px horizontal padding. Active state uses a soft chromatic fill rather than a bold left-border indicator.

### Input Field
**Role:** Form input, search, URL field

White background, #111827 text, 1px #000000 border (distinctive — inputs use near-black border instead of #e5e5e5 for emphasis), 6px radius, 8px vertical / 12px horizontal padding. The black border is a signature: inputs feel important, not optional.

### Logo Cloud Item
**Role:** Customer/social proof logo display

Transparent background, grayscale (#262626 to #737373) wordmark, no border, centered in grid cell. Logos desaturated to harmonize with monochrome palette — color appears only in active or interactive states.

### Product Mockup Container
**Role:** Hero screenshot or dashboard preview frame

White background, 16px top-left/top-right radius (asymmetric — bottom is flush), subtle 4px outer ring shadow for depth. Container is a window into the product, not a framed picture — it sits on the canvas like a floating panel.

### Page Header
**Role:** Top bar of a product page — breadcrumb, title, actions, search

Not in the original spec — extrapolated for `/dashboard` and `/distribuicao`. Canvas White background, 1px Ash border on the bottom edge only, no shadow. Height 64px (`--spacing-64`). Padding 24px horizontal (`--spacing-24`). Breadcrumb: caption (11px/1.5), Fog. Title: heading-sm (24px/1.33), Charcoal, Inter 600. Actions slot: right-aligned, 8px gap, built from Filled Dark CTA / Outlined Action Button — no new button style. Search: **is** the Input Field (the original spec already lists "search" as one of its roles) — same black 1px border, 6px radius, not a lighter treatment.

### Select / Dropdown
**Role:** Choose one value from a list — filters, period pickers, form selects

Not in the original spec. Trigger: white background, 1px Ash border, 8px radius (treated as a button-like control, not a text field — it doesn't get the Input Field's black border). Padding 8px/12px, body (14px) Charcoal text, Graphite chevron. Hover: Paper Mist fill. Focus/open: border turns Electric Blue. Disabled: Ash border, Paper Mist background, Fog text.

Panel (open): white background, 1px Ash border, 12px radius, `--shadow-md` (defined in Tokens — Shadows, previously unassigned to any component — reused here rather than inventing a new shadow value). Padding 4px around the list, no radius on individual rows — hover is a full-bleed Paper Mist fill. Dividers between groups: 1px Ash.

### Progress Bar
**Role:** Linear completion/goal indicator

Not in the original spec. Track: Paper Mist `#f5f5f5`, 8px tall, 9999px radius. Fill: Electric Blue (not Deep Sapphire — that color is reserved for the single primary CTA per surface). No border. Optional label: caption (11px), Steel.

### Avatar
**Role:** User identity — profile menu trigger, assignee indicator

Not in the original spec. Circle (9999px radius on a square box). Ring: `--shadow-subtle-3` (defined in Tokens — Shadows, previously unassigned — it's literally a white-then-black double ring, built for exactly this). Fallback/initials: Midnight Ink `#0a0a0a` background, Canvas White text, Inter 600 — same pairing as the Filled Dark CTA. Sizes: sm 24px, default 32px, lg 40px (`--spacing-24`/`32`/`40`). Profile dropdown reuses the Select/Dropdown panel spec above.

### Dialog / Modal
**Role:** Blocking confirmation or focused task overlay

Not in the original spec. Scrim: Midnight Ink at 40% opacity. Panel: Canvas White, 16px radius (largeCards — same tier as Elevated Feature Card), 1px Ash border **and** `--shadow-lg` (defined in Tokens — Shadows, previously unassigned). This is the one deliberate exception to border-only elevation — a modal is the only surface that fully leaves the canvas over a scrim. Padding 24px. Title: heading-sm, Charcoal, Inter 600. Body: body-lg (16px/1.5), Steel. Footer: right-aligned actions, 8px gap, Filled Dark CTA (confirm) + Outlined Action Button (cancel). Close (×): 32px square, 8px radius, Graphite icon, Paper Mist hover.

### Chart (simple bar chart)
**Role:** Trend/volume visualization — e.g. leads received per day

Not in the original spec. Primary series: Electric Blue. Secondary series (e.g. a comparison metric): **Electric Blue at ~35% opacity, not a second hue** — keeps the chart within the "one chromatic color per component" rule as a single color at two tones. Baseline/axis: 1px Ash. Bar radius: 6px, top corners only (smallest value in the radius vocabulary, reused — bar caps aren't covered by the original vocabulary otherwise). Axis labels: caption, Fog. Tooltip on hover: white, 1px Ash border, 8px radius, `--shadow-md`, caption text — a compact variant of the Select/Dropdown panel. Legend: 8px dot + caption text, same dot pattern as the Status Badge.

### Tabs
**Role:** Primary in-page navigation between views

Not in the original spec. Bar: Canvas White, 1px Ash bottom border. Inactive tab: body (14px), Fog. Active tab: Charcoal, Inter 600. Active indicator: 2px underline, Electric Blue, 9999px-radius caps. Padding per tab: 12px/16px. Hover (inactive): text darkens to Charcoal only — no background fill, unlike Ghost Nav Button, to keep an adjacent row of tabs visually calm.

### Sheet / Drawer
**Role:** Side panel for a focused secondary task without leaving the page

Not in the original spec. Radius: 16px, but only on the two corners on the inner edge — the edge flush against the viewport stays square (same asymmetric-radius idea as the Product Mockup Container, rotated for a side panel). 1px Ash border on the edge facing the page content. `--shadow-lg`, same as Dialog — both are overlay surfaces. Header/body/footer: identical to Dialog. A `SheetSection` (bordered sub-block inside the sheet) reuses the Dashboard Card spec directly. Width is an implementation detail, not a design-system token.

### Switch / Toggle
**Role:** Binary on/off setting

Not in the original spec. Track: 36×20px (`--spacing-36`/`--spacing-20`), 9999px radius. Off: Ash background. On: Electric Blue background. Thumb: white circle, 16px, `--shadow-subtle` (the same lift already defined for primary buttons, reused for the thumb). Disabled: 50% opacity, matching every other Ds control's disabled pattern.

### Checkbox
**Role:** Multi-select / boolean form field

Not in the original spec. Box: 16px, 6px radius (inputs vocabulary — it's a small form control). Unchecked: white background, 1px Pebble `#c8c8c8` border — Pebble's documented role is literally "control outlines," used here as specified rather than assumed. Checked: Electric Blue background + border, white checkmark. Disabled: Paper Mist background, Ash border, Silver checkmark (Silver's role: "disabled iconography"). "Checkbox-card" composite (a checkbox that makes its whole row selectable): the row is a Dashboard Card whose border swaps to Electric Blue and background tints to Electric Blue at 5% when checked.

### Segmented Control
**Role:** Small set of mutually-exclusive choices shown inline (e.g. SLA minute presets)

Not in the original spec. Track: Paper Mist background, 8px radius, 1px Ash border, 2px inner padding. Unselected segment: Fog text, transparent. Selected segment: white pill floating in the track, 6px radius (nested inside the 8px track), Charcoal text, `--shadow-subtle` (same small lift as the Switch thumb). Padding per segment: 8px/12px.

### Callout / Alert panel
**Role:** Inline informational/warning/error message block

Not in the original spec. Reuses the Status Badge's semantic tone pairs at panel scale rather than pill scale. Radius 12px (cards). Padding 16px (`--card-padding`). Border 1px, tone-colored (the one component where the border legitimately carries semantic color instead of Ash). Body text stays Charcoal at body (14px) regardless of tone — only the icon, border and background wash carry the accent color, so paragraph-length text stays readable.

| Tone | Background | Border / icon |
|---|---|---|
| neutral | Paper Mist | Ash |
| info | Powder Blue | Electric Blue |
| success | Soft Mint | Vivid Green |
| warning | Amber Wash | Amber Ink |
| destructive | Rose Wash | Rose Ink |

### Stat / KPI Tile
**Role:** Single-number metric card (e.g. "1,284 leads")

Not in the original spec. Container: Dashboard Card, no new container. Icon chip: 28px square, 8px radius. Number: Geist Mono, 24px — the original doc already reserves Geist Mono 24px for "large code display elements," which is exactly what a dashboard metric is, rather than inventing a new treatment. Label: caption, Steel.

**Color policy:** Electric Blue is the only accent used by default (icon chip tinted light blue, icon Electric Blue). A semantic tone (success/warning/destructive) is used **only** when the number itself represents a real status (e.g. an "SLA vencido" count in red) — never applied just for visual variety across a grid of tiles. A row of KPI tiles should not read as four different chromatic colors side by side.

### Empty State
**Role:** Zero-data placeholder inside a list, table or panel

Not in the original spec. Icon square: 40px, 12px radius, Paper Mist background. Icon: Silver `#a3a3a3`, 20px (Silver's documented role: "decorative strokes"). Title: body-lg (16px), Inter 600, Charcoal. Description: body (14px), Fog, ~40ch max width. Optional action: Outlined Action Button. No border of its own when already nested inside a Card (avoids a double border); a standalone empty state (not nested) gets a 1px Ash **dashed** border, matching the dashed pattern already used in the product today.

## Do's and Don'ts

### Do
- Use #e5e5e5 for all container borders — 1px solid is the default structural line, not shadows
- Reserve #1e40af (Deep Sapphire) for exactly one primary action per surface — never use it decoratively
- Use Satoshi weight 500 at 36–48px for display headlines; switch to Inter for everything 30px and below
- Use 9999px radius for all tags, badges, and pill-shaped indicators; 8px for buttons; 12px for cards; 16px for large feature cards
- Use 16px as the canonical body text size with lineHeight 1.5; drop to 14px for dense data and 11–12px for micro-labels
- Apply the soft tint palette (#dcfce7 mint, #dbeaff blue, light yellow) to small badge backgrounds and feature highlights — not to large surfaces
- Keep imagery as product UI mockups and desaturated logos; avoid stock photography and decorative illustrations

### Don't
- Don't use heavy drop shadows for card elevation — the system relies on 1px borders, not depth, to define containers
- Don't use pure black (#000000) for body text — use #171717 or #0a0a0a for slightly softer contrast
- Don't apply the Electric Blue (#2563eb) to large background fills — it's a highlight color, not a surface color
- Don't use multiple chromatic colors on a single component — each pill or feature tag gets exactly one accent
- Don't use Satoshi at body sizes — Satoshi is display-only (36px+); Inter handles everything below 30px
- Don't use radii outside the defined vocabulary (9999px, 16px, 12px, 8px, 6px) — ad-hoc rounding breaks the system's rhythm
- Don't use color for decorative gradients on UI elements — the conic spectrum gradient is reserved for the logo and brand visuals only

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | `#ffffff` | Page background — the base layer, always pure white |
| 1 | Paper | `#f5f5f5` | Alt-section backgrounds, nested panel surfaces, subtle hover fills |
| 2 | Card | `#ffffff` | Product cards, dashboard surfaces, popovers — white-on-white separated by 1px #e5e5e5 border |
| 3 | Tinted Accent | `#dcfce7` | Decorative wash for feature highlights and 'new' badges |

## Elevation

- **Primary buttons:** `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- **Elevated cards:** `rgba(0, 0, 0, 0.1) 0px 0px 0px 4px`
- **Feature showcase cards:** `rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px`
- **Product mockup frames:** `rgba(0, 0, 0, 0.1) 0px 0px 0px 4px`

Assigned in the Fase 1 extension, to tokens that existed in Tokens — Shadows but had no component yet:
- **Switch thumb / Segmented Control selected pill:** `--shadow-subtle` (same token as primary buttons — a small control lifting off its track)
- **Select/Dropdown panel, Chart tooltip:** `--shadow-md` (same token as feature showcase cards — a floating overlay)
- **Dialog, Sheet:** `--shadow-lg` — the only surfaces that fully leave the canvas over a scrim, the deliberate exception to border-only elevation
- **Avatar ring:** `--shadow-subtle-3` (`rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px 0px 4px`) — this token is a literal white-then-black double ring, unused until now

## Imagery

Imagery is product-first, not lifestyle. The hero centers a large dashboard screenshot — a real product mockup with sidebar nav, data table, and floating UI elements — presented as a flat panel on the white canvas. Customer logos appear in a desaturated grayscale grid (beehiv, superpower, Chatbase, etc.) for social proof, stripped of color so the page's single blue accent stays dominant. Floating partner cards (small profile + revenue/payout tiles) drift around editorial text blocks in the lower section, giving a sense of depth without using shadows on the text itself. The dotted grid background pattern is a signature: a fine array of small dots at very low opacity creates texture and a sense of a design system / blueprint surface, reinforcing the 'modern link attribution platform' positioning. Iconography is small, outlined-to-filled, and uses the accent palette (orange tangerine, violet lavender, green mint) for feature tags. No photography, no illustrations, no 3D — the product UI IS the visual language.

## Layout

The page follows a centered, max-width contained model at approximately 1200px. The hero is a centered text stack with three floating feature pills (Affiliate Programs, Conversion Analytics, Short Links) arranged horizontally above a large product mockup. Sections stack vertically with consistent 64px gaps, alternating between white canvas and the #f5f5f5 paper mist for tonal separation. The lower section uses a z-pattern: editorial text centered in the middle third, with floating UI cards anchored at the left and right margins, creating an asymmetric, magazine-like rhythm. The logo cloud is a simple 5×2 grid centered on the page. Navigation is a minimal top bar — logo left, nav center, two-button cluster (ghost Log in + filled Sign up) right — with no sticky or mega-menu behavior. The dashboard mockup in the hero shows a classic 2-column app shell: fixed sidebar (240px-ish) + content area, establishing the product's information density for visitors before they scroll.

## Agent Prompt Guide

## Quick Color Reference
- Text primary: #171717
- Text muted: #737373
- Background: #ffffff
- Surface alt: #f5f5f5
- Border: #e5e5e5
- Accent: #2563eb
- primary action: #000000 (filled action)

## Example Component Prompts
1. **Hero Feature Pill**: Transparent background, 9999px radius, 8px vertical / 16px horizontal padding. Small colored emoji-style icon (orange tangerine #ea580c for 'Short Links', violet #7c3aed for 'Conversion Analytics', green #16a34a for 'Affiliate Programs') + 14px Inter weight 500 #171717 label. No border.

2. **Dashboard Card**: White (#ffffff) background, 1px #e5e5e5 border, 12px radius, 16px padding. Content inside uses 14–16px Inter weight 400 #171717. No shadow — borders define the container.

3. Create a Primary Action Button: #000000 background, #ffffff text, 9999px radius, compact pill padding. Use this filled treatment for the main CTA.

4. **Outlined Action Button**: White (#ffffff) background, #171717 text, 1px #e5e5e5 border, 8px radius, 6px vertical / 12px horizontal padding. 14px Inter weight 500. Use for secondary actions like 'Learn more' or 'View invoices'.

5. **Display Headline**: Satoshi weight 500, 48px, lineHeight 1.0, color #171717. No letter-spacing adjustment. Use only for the largest hero and section titles — switch to Inter for anything 30px or below.

## Border-First Elevation Philosophy

Dub deliberately uses 1px borders over shadows as the primary container-defining mechanism. The base border color is #e5e5e5 at 1px solid — used 1942 times across the system, making it the most deployed visual element. Shadows are reserved for three specific cases: (1) a barely-there 1px lift on primary buttons (rgba(0,0,0,0.05) 0px 1px 2px), (2) a 4px outer ring on elevated feature cards and product mockups to create a 'floating panel' effect, and (3) the layered 10px/4px shadow stack on hero showcase elements. The philosophy: borders create a printed-document clarity that's better for information-dense SaaS UIs, while shadows are saved for moments that need to truly pop off the page. This is the opposite of Material Design's shadow-heavy approach.

## Pill Architecture

The 9999px radius is deployed 367 times — the second most common radius token. It's used for: feature category tags, status badges, notification dots, partner avatars, and pill-shaped nav elements. Combined with the 8px and 12px radii for buttons and cards, the system has a clear three-tier radius vocabulary: pills (9999px) for tags and badges, medium (8–12px) for buttons and cards, large (16px) for feature surfaces. This tight radius discipline is a key part of what makes the design feel intentional and cohesive.

## Similar Brands

- **Linear** — Same light-canvas + monochrome + single-accent approach, with similar compact density and 1px-border container treatment over heavy shadows
- **Vercel** — Geometric sans-serif headlines at weight 500 (not bold), hairline borders, white-on-white card surfaces with 12px radius, and a restrained color palette that lets the product UI do the visual work
- **Cal.com** — Open-source SaaS with the same pill-button + flat card aesthetic, similar use of small colored feature tags floating above monochrome layouts, and Inter as the primary workhorse font
- **Plausible Analytics** — Editorial-meets-dashboard layout with centered text stacks, floating UI cards, dotted grid background texture, and a near-monochrome palette with a single accent color for emphasis
- **Raycast** — Compact information density, border-defined containers instead of shadows, pill-shaped status indicators, and a confident use of one saturated accent (blue) against near-black text

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-paper-mist: #f5f5f5;
  --color-ash: #e5e5e5;
  --color-smoke: #d4d4d4;
  --color-pebble: #c8c8c8;
  --color-midnight-ink: #0a0a0a;
  --color-charcoal: #171717;
  --color-graphite: #262626;
  --color-slate: #404040;
  --color-steel: #525252;
  --color-fog: #737373;
  --color-silver: #a3a3a3;
  --color-electric-blue: #2563eb;
  --color-deep-sapphire: #1e40af;
  --color-soft-mint: #dcfce7;
  --color-vivid-green: #16a34a;
  --color-tangerine: #ea580c;
  --color-lavender: #7c3aed;
  --color-conic-spectrum: #8b5cf6;
  --gradient-conic-spectrum: conic-gradient(from -81deg, #ff0000, #eab308 99deg, #5cff80 162deg, #00fff9 216deg, #3a8bfd 288deg, #855afc);
  --color-primary-action-fill: #000000;

  /* Colors — Fase 1 extension (semantic status pairs) */
  --color-powder-blue: #dbeaff;
  --color-amber-wash: #fef3c7;
  --color-amber-ink: #92400e;
  --color-rose-wash: #fee2e2;
  --color-rose-ink: #991b1b;
  --color-forest-ink: #166534;

  /* Typography — Font Families */
  --font-satoshi: 'Satoshi', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.5;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-body-xl: 18px;
  --leading-body-xl: 1.56;
  --text-subheading: 20px;
  --leading-subheading: 1.4;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.33;
  --text-heading: 30px;
  --leading-heading: 1.38;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 48px;
  --leading-display: 1;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 64px;
  --card-padding: 16px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-full: 9999px;

  /* Named Radii */
  --radius-tags: 9999px;
  --radius-cards: 12px;
  --radius-inputs: 6px;
  --radius-buttons: 8px;
  --radius-largecards: 16px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
  --shadow-sm: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;
  --shadow-sm-2: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.1) 0px 0px 0px 4px;
  --shadow-md: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
  --shadow-lg: rgba(0, 0, 0, 0.09) 0px 20px 20px 0px;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px 0px 4px;

  /* Surfaces */
  --surface-canvas: #ffffff;
  --surface-paper: #f5f5f5;
  --surface-card: #ffffff;
  --surface-tinted-accent: #dcfce7;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-paper-mist: #f5f5f5;
  --color-ash: #e5e5e5;
  --color-smoke: #d4d4d4;
  --color-pebble: #c8c8c8;
  --color-midnight-ink: #0a0a0a;
  --color-charcoal: #171717;
  --color-graphite: #262626;
  --color-slate: #404040;
  --color-steel: #525252;
  --color-fog: #737373;
  --color-silver: #a3a3a3;
  --color-electric-blue: #2563eb;
  --color-deep-sapphire: #1e40af;
  --color-soft-mint: #dcfce7;
  --color-vivid-green: #16a34a;
  --color-tangerine: #ea580c;
  --color-lavender: #7c3aed;
  --color-conic-spectrum: #8b5cf6;
  --color-primary-action-fill: #000000;

  /* Colors — Fase 1 extension (semantic status pairs) */
  --color-powder-blue: #dbeaff;
  --color-amber-wash: #fef3c7;
  --color-amber-ink: #92400e;
  --color-rose-wash: #fee2e2;
  --color-rose-ink: #991b1b;
  --color-forest-ink: #166534;

  /* Typography */
  --font-satoshi: 'Satoshi', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.5;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-body-xl: 18px;
  --leading-body-xl: 1.56;
  --text-subheading: 20px;
  --leading-subheading: 1.4;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.33;
  --text-heading: 30px;
  --leading-heading: 1.38;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 48px;
  --leading-display: 1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
  --shadow-sm: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;
  --shadow-sm-2: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.1) 0px 0px 0px 4px;
  --shadow-md: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
  --shadow-lg: rgba(0, 0, 0, 0.09) 0px 20px 20px 0px;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px 0px 4px;
}
```
