# ConsentOps Agent — Cloud Run image

FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
# Shared uv cache for nextjs — avoids git fetch on every Cloud Run cold start
ENV UV_CACHE_DIR=/opt/uv-cache

# uv/uvx (musl) + git for read-only Fivetran MCP: uvx --from git+https://github.com/fivetran/fivetran-mcp
COPY --from=ghcr.io/astral-sh/uv:0.7.14-alpine /usr/local/bin/uv /usr/local/bin/uvx /usr/local/bin/

RUN apk add --no-cache git ca-certificates python3 \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /opt/uv-cache \
  && chown nextjs:nodejs /opt/uv-cache

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pre-build fivetran-mcp wheels into UV_CACHE_DIR (uvx reuses cache at runtime)
RUN uv pip install --system --break-system-packages --cache-dir /opt/uv-cache \
    "fivetran-mcp @ git+https://github.com/fivetran/fivetran-mcp" \
  && chown -R nextjs:nodejs /opt/uv-cache

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
