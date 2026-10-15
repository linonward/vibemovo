# syntax=docker/dockerfile:1
# Self-hosted image: docs/runbook.md#self-host-with-docker.
#   docker build --build-arg BETTER_AUTH_URL=https://your-domain.com -t starter .
#   docker build --target migrate -t starter-migrate .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Applies the committed migrations in drizzle/ to DATABASE_URL, then exits.
FROM deps AS migrate
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
CMD ["pnpm", "db:migrate"]

FROM deps AS builder
COPY . .
# The build bakes these into the pages and the browser code, so changing
# one means building again.
ARG BETTER_AUTH_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_SENTRY_DSN
ENV BETTER_AUTH_URL=$BETTER_AUTH_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=$NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    BUILD_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1
# Loading the auth module creates the database client, which needs a URL,
# and Better Auth logs an error for each page without a secret.
# The build never connects or signs anything: the container gets the real
# values at run time.
RUN DATABASE_URL=postgres://build@localhost/build \
    BETTER_AUTH_SECRET=build-only-placeholder-never-used-at-run-time \
    pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
