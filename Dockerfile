# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

# Install prod-only deps (used in final image)
RUN npm ci --only=production && \
    npm cache clean --force

# ─── Stage 2: Build (TypeScript compile) ─────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Install all deps (including devDeps needed for tsc)
RUN npm ci

# Copy source & config
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:22-alpine AS production

# dumb-init: proper PID 1 / signal forwarding
RUN apk add --no-cache dumb-init

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S nodejs -u 1001

WORKDIR /app

# Production node_modules from stage 1
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Compiled output from stage 2
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Manifest needed at runtime
COPY --chown=nodejs:nodejs package.json ./

# OpenAPI spec is read from filesystem at runtime (swagger.ts)
COPY --chown=nodejs:nodejs openapi.yaml ./

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
