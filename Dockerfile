# syntax=docker/dockerfile:1
#
# VidyaPariksha — single-process production image.
# One container serves the built SPA, the Express API and the SQLite database.
# The database and uploaded images live under /app/data, which must be a
# persistent volume (see render.yaml `disk:` or a cloud volume). Without it the
# questions, attempts, users and results would be lost when the instance is
# replaced.

# ── 1. production dependencies only ─────────────────────────────────────────
FROM node:22-bookworm-slim AS deps-prod
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ── 2. full toolchain (for `vite build` and `tsc`) ──────────────────────────
FROM node:22-bookworm-slim AS deps-dev
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 3. build web bundle + compiled server ──────────────────────────────────
FROM deps-dev AS build
COPY . .
RUN npm run build

# ── 4. slim runtime ───────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=4000
WORKDIR /app

COPY --from=deps-prod /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Persistent state: the SQLite file and the image uploads.
RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node
EXPOSE 4000

# The platform's health endpoint. Render/Fly/platforms that honour Docker
# HEALTHCHECK will probe it; `healthCheckPath` in render.yaml covers Render.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist-server/index.js"]
