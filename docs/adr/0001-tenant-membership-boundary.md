# ADR 0001: tenant authorization is separated from BetterAuth identity

## Context

CorreTop needs a server-enforced tenant context, three tenant roles, branches, and a
future-safe identity model. BetterAuth 1.6.23 provides canonical `user`, `session`,
`account`, and `verification` tables. Its organization plugin introduces a client-facing
active-organization selection flow that is not approved for this phase.

## Decision

Keep BetterAuth identity tables canonical and create `tenants`, `branches`, and
`tenant_memberships` as domain tables. `tenant_memberships` holds the tenant role,
membership status, and optional branch association. A composite foreign key ensures a
membership branch belongs to the same tenant. Each request resolves exactly one
membership from the authenticated server session; a zero or multiple membership result
is denied rather than falling back to global access.

## Consequences

The application does not enable BetterAuth organization, team, or 2FA plugins in this
phase. Multi-tenant data access must be exposed through `createTenantDb(context)`, with
the context obtained from `getRequiredTenantContext()`. A future approved multi-branch
or tenant-switching policy can extend the membership model without changing identity.
