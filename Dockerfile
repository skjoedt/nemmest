# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:25-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM node:25-alpine AS builder

WORKDIR /app

# Copy installed deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Generate SvelteKit types and build
RUN npm run prepare && npm run build


# ── Stage 3: production image ─────────────────────────────────────────────────
FROM node:25-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built app
COPY --from=builder /app/build ./build

# Copy node_modules (needed by the app and migrate.js)
COPY --from=deps /app/node_modules ./node_modules

# Copy package.json (needed by adapter-node)
COPY package.json ./

# Copy migration script and migration files
COPY migrate.js ./
COPY drizzle/ ./drizzle/

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
