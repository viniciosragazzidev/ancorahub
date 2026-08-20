# ADR 0039: server-first local feedback instead of a client cache layer

## Context

Users reported that additions, deletions and status changes only appeared after a
manual F5. The codebase advertised a "local-first" layer (`QueryClientProvider`,
`useLocalFirstMutation`, `localFirstQueryKey`) but contained zero `useQuery`
calls: the cache was never populated, so the layer only added bundle weight. The
actual update path was Server Components + manual `router.refresh()`, and it was
broken in three recurring ways:

1. `useEffect(() => { if (state.success) router.refresh(); }, [state.success])` —
   a boolean dependency stops firing on the second identical success, which is
   precisely the "needs F5" symptom.
2. `useOptimistic` updaters called outside `startTransition`, so React discarded
   the optimistic value and no instant feedback ever rendered.
3. `window.location.reload()` used as a mutation confirmation in several
   surfaces, discarding client state and punishing every interaction.

DEC-077 already forbids `postgres_changes` subscriptions in the browser and
establishes opaque per-user realtime signals with authenticated follow-up reads,
which constrains any solution toward server-rendered truth.

## Decision

Adopt server-first pure reactivity:

- Server Components remain the single source of truth for lists; Server Actions
  remain the only mutation path (DEC-007). No client-side domain cache is
  introduced.
- Instant feedback uses `useOptimistic` applied **inside** the same
  `startTransition` that dispatches the action.
- Post-action reconciliation uses `router.refresh()` triggered by the **state
  object** identity from `useActionState` (each dispatch produces a new object),
  never by a boolean field. Direct `await action()` calls must call
  `router.refresh()` on success.
- `window.location.reload()` is restricted to error recovery (error boundaries,
  deployment version skew).
- The dead TanStack Query runtime usage is removed (`AppProviders`,
  `RealtimeSyncProvider`, `useLocalFirstMutation` consumers). The npm dependency
  stays until its removal is explicitly approved.
- Cross-user propagation extends DEC-077's opaque per-user signal with a
  `domain.invalidated` kind: write paths publish the signal to the tenant users
  entitled to see the change, and receivers respond with the existing local
  invalidation plus a coalesced `router.refresh()`. The signal carries no
  personal data; the browser re-reads through authenticated routes. The
  capability remains behind the existing global realtime kill switch.

Alternatives rejected:

- **Hybrid with TanStack Query on hot lists** — would require read routes for
  every list and a second source of truth to keep in sync with server props;
  the reported symptoms were caused by broken refresh effects, not by the
  absence of a client cache.
- **`revalidatePath` in every action** — Next 16 includes the route re-render in
  the action response itself, which delays the `useActionState` return on heavy
  `force-dynamic` routes (already observed in the leads drawer and reverted on
  2026-08-19). Client-initiated refresh keeps the interaction responsive.

## Consequences

- One roundtrip for the mutation plus a non-blocking refresh keeps button state
  responsive; optimistic UI covers the visual gap.
- Any new mutation surface must follow the object-dependency refresh pattern;
  the harness architecture check should flag boolean-dependency refresh effects.
- Cross-user updates depend on write paths publishing `domain.invalidated`
  signals; adoption is incremental per surface, starting with lead status
  changes.
- Removing the QueryClient slightly reduces the initial JS bundle of every
  authenticated page.
