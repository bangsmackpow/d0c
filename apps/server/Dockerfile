# Stage 1: Build both apps
FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace configs
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy codebase
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build web first (compiles into apps/web/dist) and then build server (compiles into apps/server/dist)
RUN pnpm --filter web build
RUN pnpm --filter server build

# Stage 2: Production environment
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

# Install production dependencies only
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
RUN pnpm install --prod --frozen-lockfile

# Copy builds from builder
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Expose port and configure environment
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/d0c.db
ENV STORAGE_PATH=/data/storage
ENV BETTER_AUTH_URL=http://localhost:3000

# Create and define persistent volume mountpoint
RUN mkdir -p /data/storage
VOLUME [ "/data" ]

# Auto-run migrations before starting server
CMD ["sh", "-c", "pnpm --filter server db:migrate && node apps/server/dist/index.js"]
