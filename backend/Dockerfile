# Backend Dockerfile - Node.js API (multi-stage build)

# Stage 1: Install dependencies
FROM node:20-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm config set strict-ssl false && npm ci --omit=dev && npm config set strict-ssl true

# Stage 2: Production image
FROM node:20-alpine

# Install system dependencies for video processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates \
    && pip3 install --break-system-packages yt-dlp

WORKDIR /app

# Copy dependencies from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
