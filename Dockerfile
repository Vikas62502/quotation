# ---------- Base ----------
FROM node:20-slim AS base
WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=optional

# ---------- Build ----------
FROM base AS builder
# Install build dependencies for native modules (lightningcss needs these)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Disable Turbopack - Next.js 16 uses Turbopack by default, we need to force webpack
ENV NEXT_TELEMETRY_DISABLED=1

# Accept build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Copy package.json only (not package-lock.json) to work around npm optional dependencies bug
# See: https://github.com/npm/cli/issues/4828
COPY package.json ./

# Install dependencies without package-lock.json to force fresh install of optional dependencies
# This ensures @tailwindcss/oxide and lightningcss native bindings are properly installed
# Using --legacy-peer-deps to avoid peer dependency issues
RUN npm install --include=optional --legacy-peer-deps

# Force reinstall @tailwindcss packages to ensure native bindings are downloaded
RUN npm install --no-save --include=optional --legacy-peer-deps @tailwindcss/postcss @tailwindcss/node @tailwindcss/oxide || true

# Copy source code
COPY . .

# Build - we need the native bindings to be present for this to work
RUN npm run build
    
# ---------- Runner ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
    