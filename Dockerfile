# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for native modules (bcrypt, etc.)
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

# Production-only node_modules
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma client (generated in builder)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built Next.js output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy source needed at runtime (tsx executes server.ts + src/ directly)
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Data directory for SQLite volume mount
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV SMTP_PORT=2525
ENV DATABASE_URL="file:/app/data/prod.db"

EXPOSE 3000 2525

# Sync schema and start the server
CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss && node_modules/.bin/tsx server.ts"]
