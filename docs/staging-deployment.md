# Staging deployment

Coolify (VPS) owns deployment. GitHub Actions only verifies lint, types, and build; it never runs migrations or deploys. Vercel is no longer used.

## Environments

| Environment | Coolify resource | Database | Data |
|---|---|---|---|
| Development | local | local database or isolated managed branch | fictitious |
| Staging | separate Coolify application for `develop` once that branch exists | dedicated staging database | fictitious |
| Production | Coolify CRM application (`main`), `https://crm.ancorasaude.cloud` | dedicated production database | production |

`develop` does not yet exist in this repository, so no branch mapping is configured in versioned files. Create the staging application in Coolify only after the branch exists and is approved.

## Required environment variables

Configure these in the Coolify application's **Environment Variables**, with separate values per environment:

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_APP_URL=
```

`DATABASE_URL` and `BETTER_AUTH_SECRET` are server-only. Staging must use its own database credentials; it may never point to production.

## Migration policy

Run `npm run db:migrate` exactly once against the intended database from an authorized, controlled release step. Never run migrations from `next build` or pull-request CI. Production migration automation needs an approved release owner before it is introduced.

## Scheduled jobs

Every job is a Coolify Scheduled Task: see `docs/runbooks/coolify-scheduled-tasks.md`.

## First staging deployment checklist

1. Create a Coolify application for this repository pointing at `develop`.
2. Create a separate PostgreSQL database for staging and set its `DATABASE_URL` only in that application.
3. Set the four variables above.
4. Apply the reviewed migration with `npm run db:migrate` against staging.
5. Run the controlled bootstrap with fictitious staging data: `npm run bootstrap:tenant` (with the documented `BOOTSTRAP_*` variables set).
6. Deploy `develop`, then verify `/login` and `/dashboard`.
