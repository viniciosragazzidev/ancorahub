# 002 — Fix Row Hover Animation Overlap and Jarring Badge Scale

- **Status**: DONE
- **Commit**: e0fefe7
- **Severity**: HIGH
- **Category**: Performance / Cohesion & tokens
- **Estimated scope**: 2 files (src/app/(dashboard)/clientes/clientes-list.tsx, src/app/(dashboard)/equipe/team-members-table.tsx)

## Problem

In both `ClientesList` and `TeamMembersTable`, list/table rows combine Framer Motion `whileHover={{ backgroundColor: ... }}` with CSS classes containing `transition-colors`. This triggers dual background transitions simultaneously via two separate systems (Javascript and CSS), causing browser performance overhead and visual glitches during high-frequency list scrolling. 

Additionally, the member status badge inside `TeamMembersTable` has an unnecessary scale animation on row hover:
```tsx
/* src/app/(dashboard)/equipe/team-members-table.tsx:119 — current */
<Badge variant={...} className="transition-transform duration-200 group-hover/card:scale-105">
```
This causes layout shifts, text fuzzy rendering, and a cheap visual effect in a professional dashboard.

## Target

Remove Javascript-driven hovers on these list rows and replace them with standard CSS hover utility classes. Remove the scale effect on badges.

For `clientes-list.tsx`:
```tsx
/* target */
        <motion.div
          key={client.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
          }}
          className="group/card flex cursor-default flex-col gap-2 px-5 py-4 transition-colors duration-200 hover:bg-[var(--sidebar-warning)] sm:flex-row sm:items-center sm:justify-between"
        >
```

For `team-members-table.tsx`:
```tsx
/* target */
                <motion.tr
                  key={member.id}
                  custom={i}
                  variants={{
                    hidden: { opacity: 0, x: -8 },
                    visible: (index: number) => ({
                      opacity: 1,
                      x: 0,
                      transition: { duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(index * 0.03, 0.25) },
                    }),
                  }}
                  className="group/card cursor-default transition-colors duration-200 hover:bg-[var(--sidebar-warning)]"
                >
```

## Repo conventions to follow

- Hover states for high-frequency dashboard lists/tables should be handled in pure CSS (`hover:bg-...` with `transition-colors`) for maximum smoothness.
- Avoid main-thread JavaScript animations on hover.

## Steps

1. In [clientes-list.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/clientes/clientes-list.tsx), locate line 46:
   ```tsx
   whileHover={{ x: 4, backgroundColor: "var(--sidebar-warning)", transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
   ```
   Delete this `whileHover` attribute entirely.
2. Update the `className` attribute on the same `<motion.div>` (line 47) from:
   ```tsx
   className="group/card flex cursor-default flex-col gap-2 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
   ```
   to:
   ```tsx
   className="group/card flex cursor-default flex-col gap-2 px-5 py-4 transition-colors duration-200 hover:bg-[var(--sidebar-warning)] sm:flex-row sm:items-center sm:justify-between"
   ```
3. In [team-members-table.tsx](file:///c:/Users/kyper/Desktop/Kyper/Projects/corretopV2/corretop/src/app/(dashboard)/equipe/team-members-table.tsx), locate line 108:
   ```tsx
   whileHover={{ backgroundColor: "var(--sidebar-warning)" }}
   ```
   Delete this `whileHover` attribute entirely.
4. Update the `className` attribute on the same `<motion.tr>` (line 109) from:
   ```tsx
   className="group/card cursor-default transition-colors"
   ```
   to:
   ```tsx
   className="group/card cursor-default transition-colors duration-200 hover:bg-[var(--sidebar-warning)]"
   ```
5. On line 119 in `team-members-table.tsx`, remove the transition classes from the `<Badge>`:
   Change:
   ```tsx
   className="transition-transform duration-200 group-hover/card:scale-105"
   ```
   to empty string or remove `className` attribute if no longer needed:
   ```tsx
   // No className attribute needed for custom transitions on this badge
   ```

## Boundaries

- Do NOT touch table cell contents, data mapping, or row structure/variants.
- Only change motion/hover classes and props.

## Verification

- **Mechanical**:
  - Run typecheck: `npm run type-check` (should pass)
  - Run lint: `npm run lint` (should pass)
- **Feel check**:
  - Go to "Clientes" and "Equipe" pages.
  - Hover over rows and verify the hover background color changes smoothly and instantly.
  - Verify that hovering a row in "Clientes" no longer shifts the row horizontally.
  - Verify that hover in "Equipe" no longer causes the status badge to scale.
- **Done when**:
  - Row hovers use standard tailwind `hover:bg-[var(--sidebar-warning)]` transition-colors instead of JS-driven properties, and badge scaling is removed.
