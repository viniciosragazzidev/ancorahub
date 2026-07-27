# Staging deployment

Vercel owns deployment. GitHub Actions only verifies lint, types, and build; it never runs migrations or deploys.

## Environments

| Environment | Vercel target | Database | Data |
|---|---|---|---|
| Development | local | local database or isolated managed branch | fictitious |
| Preview | Preview | isolated preview database, never production | fictitious |
| Staging | Preview deployment for `develop` once that branch exists | dedicated staging database | fictitious |
| Production | Production (`main`) | dedicated production database | production |

`develop` does not yet exist in this repository, so no branch mapping is configured in versioned files. Configure the staging branch in the Vercel dashboard only after it exists and is approved.

## Required Vercel variables

Configure these in **Project Settings → Environment Variables** with separate values for Development, Preview/Staging, and Production:

```env
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_APP_URL=
```

`DATABASE_URL` and `BETTER_AUTH_SECRET` are server-only. Preview and staging must use their own database credentials; neither may point to production.

## Migration policy

Run `npm run db:migrate` exactly once against the intended database from an authorized, controlled release step. Never run migrations from `next build`, pull-request CI, or every preview deployment. Production migration automation needs an approved release owner before it is introduced.

## First staging deployment checklist

1. Link this repository to a Vercel project with Vercel Git integration.
2. Create a separate PostgreSQL database for staging and set its `DATABASE_URL` only in the staging environment.
3. Set the four variables above for the correct Vercel environments.
4. Apply the reviewed migration with `npm run db:migrate` against staging.
5. Run the controlled bootstrap with fictitious staging data: `npm run bootstrap:tenant` (with the documented `BOOTSTRAP_*` variables set).
6. Deploy `develop` after the branch exists, then verify `/login` and `/dashboard`.
