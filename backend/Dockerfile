# Backend Dockerfile - Node.js API
FROM ghcr.io/milkrunner/foodplanner/backend:latest AS deps

FROM node:20-alpine

# Install system dependencies for video processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates \
    && pip3 install --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Reuse dependencies from the published image to avoid npm during build
COPY --from=deps /app/node_modules ./node_modules

# Copy all application files including custom overrides
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
