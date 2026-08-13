---
name: nextjs-best-practices
description: Next.js App Router principles and best practices covering Server vs Client component boundaries, data fetching, routing conventions, API routes, caching, metadata, performance, and server actions.
---

# Next.js App Router Best Practices

Essential architectural principles and design patterns for Next.js App Router applications.

## 1. Server vs Client Components

### Decision Tree
```
Does it need...?
│
├── useState, useEffect, event handlers
│   └── Client Component ('use client')
│
├── Direct data fetching, no interactivity
│   └── Server Component (default)
│
└── Both? 
    └── Split: Server parent + Client child
```

### Defaults
- **Server Components (Default)**: Direct data fetching, page layouts, static content, DB queries, security boundary.
- **Client Components (`'use client'`)**: Forms, buttons, interactive state, event handlers, client hooks.

---

## 2. Data Fetching Patterns

### Fetch Strategy
- **Default**: Static (cached at build/request time)
- **Revalidate**: ISR (time-based or tag-based refresh)
- **No-store**: Dynamic data on every request

### Data Flow
| Source | Pattern |
|--------|---------|
| Database | Server Component direct fetch |
| External API | `fetch` with caching options |
| User Input | Client state + Server Actions |

---

## 3. Routing Principles

### File Conventions
- `page.tsx` - Route UI
- `layout.tsx` - Shared layout
- `loading.tsx` - Instant loading boundary (Skeleton UI)
- `error.tsx` - Error boundary for runtime recovery
- `not-found.tsx` - 404 page for missing resources

### Route Organization
- **Route groups `(group)`**: Organize routes without affecting URL path.
- **Parallel routes `@slot`**: Simultaneous views on the same layout.
- **Intercepting routes `(.)`**: Modal overlays and contextual routes.

---

## 4. API Routes & Route Handlers

### Best Practices
1. **Validation**: Validate all incoming parameters and bodies with Zod schemas.
2. **Status Codes**: Return explicit HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`).
3. **Error Handling**: Wrap route handlers in structured `try / catch` blocks and return JSON error contracts.
4. **Tenant Isolation**: Multi-tenant authorization checked via server session (never trust client tenant IDs).

---

## 5. Performance Principles

- **Image Optimization**: Use `next/image` (`<Image />`) with explicit `sizes`, `priority` for above-the-fold assets, and WebP/AVIF formatting.
- **Bundle Optimization**: Use `next/dynamic` for heavy client components (e.g. 2D studio canvas, PDF generators).
- **Automatic Code Splitting**: Keep route segments decoupled.

---

## 6. Metadata

- **Static vs Dynamic**: Export static `metadata` object or `generateMetadata()` for dynamic pages.
- **Essential Tags**: `title` (50-60 chars), `description` (150-160 chars), `openGraph`, `canonical`.

---

## 7. Server Actions

- Mark module or function with `'use server'`.
- Validate all inputs on the server using Zod.
- Return typed responses `{ success: boolean; data?: T; error?: string }`.
- Audit security and authorization inside every Server Action.

---

## 8. Anti-Patterns to Avoid

| ❌ Don't | ✅ Do |
|----------|-------|
| `'use client'` everywhere | Server Components by default |
| Fetching data in client `useEffect` | Fetching in Server Components or Server Actions |
| Missing `loading.tsx` states | Use `loading.tsx` per route segment |
| Ignoring error boundaries | Implement `error.tsx` |
| Monolithic client bundles | Dynamic imports for heavy UI tools |
