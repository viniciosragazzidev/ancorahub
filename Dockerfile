# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS dependencies

COPY package.json package-lock.json ./
# npm's download cache survives between deploys: a lockfile change no longer downloads everything again.
RUN --mount=type=cache,id=ancorahub-npm,target=/root/.npm npm ci || npm install

FROM base AS builder

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_VPS_API_URL
ARG NEXT_PUBLIC_META_APP_ID
ARG NEXT_PUBLIC_META_LEAD_ADS_APP_ID
ARG NEXT_PUBLIC_META_WHATSAPP_APP_ID
ARG NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VPS_API_URL=$NEXT_PUBLIC_VPS_API_URL
ENV NEXT_PUBLIC_META_APP_ID=$NEXT_PUBLIC_META_APP_ID
ENV NEXT_PUBLIC_META_LEAD_ADS_APP_ID=$NEXT_PUBLIC_META_LEAD_ADS_APP_ID
ENV NEXT_PUBLIC_META_WHATSAPP_APP_ID=$NEXT_PUBLIC_META_WHATSAPP_APP_ID
ENV NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID=$NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Faster deploys (20/10): the build cache stays on the VPS between builds (only the changed files
# recompile) and the type check is skipped here (tsc runs before every push). See next.config.ts.
ENV SKIP_BUILD_TYPECHECK=1
ENV NEXT_BUILD_FS_CACHE=1
RUN --mount=type=cache,id=ancorahub-next-cache,target=/app/.next/cache npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# DB pool size comes from src/shared/db/client.ts (10 on the transaction pooler,
# 4 on the session pooler); DB_POOL_MAX in Coolify overrides it.

RUN apk add --no-cache curl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
