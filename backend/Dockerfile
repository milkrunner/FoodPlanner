# Backend Dockerfile - Node.js API
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

# Copy all application files (node_modules mounted via volume)
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
