# 001 — Fix High-Frequency Dashboard Header Jitter

- **Status**: DONE
- **Commit**: e0fefe7
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file (src/components/dashboard-header.tsx)

## Problem

The sticky dashboard header has entrance animations (`y: -8` to `0`, trigger `scale: 0.9` to `1`) on mount:
```tsx
/* src/components/dashboard-header.tsx:24 — current */
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
    >
```
Because the header is rendered inside page components (mounted anew on every route change in Next.js), this animation triggers on every single navigation. This high frequency creates a jittery, distracting, and laggy dashboard experience.

## Target

Remove all animations from the dashboard header, rendering it as static layout scaffolding.
```tsx
/* target */
    <header
      className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
    >
      <div className="max-[559px]:shrink-0">
        <SidebarTrigger />
      </div>
```

## Repo conventions to follow

- High-frequency layout scaffolding elements should be static or persistent to prevent flashing.
- Component-level layout components (like shell or sidebar) remain stable.

## Steps

1. In [dashboard-header.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/components/dashboard-header.tsx), delete the import of `motion` at line 5:
   ```typescript
   import { motion } from "motion/react";
   ```
2. Replace the `<motion.header>` element (lines 24-28) with a standard HTML `<header>` element:
   ```tsx
   <header
     className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
   >
   ```
3. Replace the corresponding closing `</motion.header>` (line 52) with `</header>`.
4. Replace `<motion.div>` wrapping `<SidebarTrigger />` (lines 30-35) with a standard `<div>`:
   ```tsx
   <div className="max-[559px]:shrink-0">
     <SidebarTrigger />
   </div>
   ```
5. Replace the corresponding closing `</motion.div>` (line 37) with `</div>`.

## Boundaries

- Do NOT touch other elements within the header (buttons, theme toggle, global search).
- Do NOT change class names or attributes on child elements.

## Verification

- **Mechanical**:
  - Run typecheck: `npm run type-check` (should pass)
  - Run lint: `npm run lint` (should pass)
- **Feel check**:
  - Open the dashboard and navigate between tabs (e.g. "Clientes", "Leads", "Equipe").
  - Verify that the header remains static and does not slide/fade in on every page transition.
  - Set playback to 10% in Chrome DevTools Animations panel and confirm that navigation does not spawn header animation timelines.
- **Done when**:
  - `<motion.header>` and its inner `<motion.div>` are completely replaced by standard, non-animated HTML tags, and the unused `motion` import is removed.
