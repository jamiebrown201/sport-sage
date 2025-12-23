# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy package.json files for all packages
COPY packages/scraper-service/package.json ./packages/scraper-service/
COPY packages/database/package.json ./packages/database/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/database ./packages/database
COPY packages/scraper-service ./packages/scraper-service

# Build
WORKDIR /app/packages/database
RUN pnpm build

WORKDIR /app/packages/scraper-service
RUN pnpm build

# Production stage
FROM mcr.microsoft.com/playwright:v1.49.1-noble

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy built packages
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/scraper-service ./packages/scraper-service

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Install Playwright browsers
RUN npx playwright install chromium

WORKDIR /app/packages/scraper-service

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose health check port
EXPOSE 3001

# Run the service
CMD ["node", "dist/index.js"]
