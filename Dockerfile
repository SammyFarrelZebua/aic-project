# ==========================================
# 1. Base Stage: System packages & setup (Node 22)
# ==========================================
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install system utilities needed for native node packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# 2. Dependencies Stage: Install NPM packages
# ==========================================
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# 3. Builder Stage: Build Next.js app
# ==========================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ==========================================
# 4. Runner Stage: Production execution
# ==========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
ENV XDG_CACHE_HOME=/app/.cache

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime assets and built output
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next-dev ./.next-dev

# Ensure directories exist and are writable by nextjs user
RUN mkdir -p /app/.next-dev/cache /app/.cache/huggingface /app/node_modules/@huggingface/transformers/.cache && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
