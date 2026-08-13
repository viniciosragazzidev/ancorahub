---
name: react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. Use when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns across data fetching, rendering, bundle size, and server components.
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel. Contains rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

---

## 1. Eliminating Waterfalls (CRITICAL)

- **`async-cheap-condition-before-await`**: Check cheap synchronous conditions (permissions, cached flags, null checks) before awaiting remote promises or database calls.
- **`async-defer-await`**: Move `await` into specific conditional branches where the data is actually used.
- **`async-parallel`**: Use `Promise.all()` for independent asynchronous DB or external API operations.
- **`async-api-routes`**: Start promises early in route handlers and await them late.
- **`async-suspense-boundaries`**: Use `<Suspense>` boundaries to stream server content without blocking full page payloads.

---

## 2. Bundle Size Optimization (CRITICAL)

- **`bundle-barrel-imports`**: Import components and icons directly from their target module files rather than barrel index files (`index.ts`) when only importing specific symbols.
- **`bundle-analyzable-paths`**: Prefer statically analyzable import paths for Next.js build-time optimization.
- **`bundle-dynamic-imports`**: Use `next/dynamic` (`dynamic(() => import(...), { ssr: false })`) for heavy interactive components (e.g. 2D studio canvas, PDF exporters, rich text editors).
- **`bundle-defer-third-party`**: Defer third-party analytics and telemetry scripts until after hydration.

---

## 3. Server-Side Performance (HIGH)

- **`server-auth-actions`**: Authenticate Server Actions with strict tenant isolation and input validation.
- **`server-cache-react`**: Use `React.cache()` for per-request deduplication of database or API lookups.
- **`server-dedup-props`**: Avoid passing duplicate or redundant data from Server Components to Client Components.
- **`server-serialization`**: Minimize data passed to Client Components. Pick only required fields instead of sending entire database record objects.
- **`server-parallel-fetching`**: Restructure Server Component hierarchies to run independent data fetches in parallel.

---

## 4. Client-Side Data Fetching (MEDIUM-HIGH)

- **`client-swr-dedup`**: Use SWR or React Query for automatic request deduplication and cache revalidation.
- **`client-event-listeners`**: Deduplicate global window/document event listeners using clean teardown in `useEffect`.
- **`client-passive-event-listeners`**: Use `{ passive: true }` for scroll and touch event listeners to maintain 60 FPS scrolling.

---

## 5. Re-render Optimization (MEDIUM)

- **`rerender-memo`**: Wrap expensive calculation components in `React.memo` or `useMemo`.
- **`rerender-no-inline-components`**: Never define nested React components inside another component's render body. Define them at module scope to prevent re-creation on every render cycle.
- **`rerender-dependencies`**: Pass primitive values as `useEffect` / `useCallback` dependencies instead of unstable object references.
- **`rerender-derived-state-no-effect`**: Derive state directly during render instead of computing derived values in `useEffect`.
- **`rerender-functional-setstate`**: Use functional state updates (`setState(prev => ...)` ) for stable callbacks.

---

## 6. Rendering Performance (MEDIUM)

- **`rendering-conditional-render`**: Use ternary operators (`condition ? <Comp /> : null`) instead of `&&` for numeric or nullable conditions to avoid rendering `0` or unexpected text in the DOM.
- **`rendering-animate-svg-wrapper`**: Animate HTML `div` containers rather than raw SVG elements for high-performance GPU compositing.
- **`rendering-hoist-jsx`**: Extract static JSX elements outside component render functions to avoid unnecessary allocation.

---

## 7. JavaScript Performance (LOW-MEDIUM)

- **`js-early-exit`**: Return early from functions to minimize nesting and branch evaluation.
- **`js-set-map-lookups`**: Use `Set` or `Map` for $O(1)$ lookups in loops instead of `.includes()` or `.find()`.
- **`js-flatmap-filter`**: Use `.flatMap()` to combine mapping and filtering into a single array pass.
- **`js-combine-iterations`**: Combine consecutive `.map()` and `.filter()` calls into single loop passes when processing large collections.
