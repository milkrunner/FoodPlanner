# All-in-One Production Image: nginx (frontend) + Node.js (backend)
# Image: milkrunner/foodplanner
#
# Build:  docker build -t milkrunner/foodplanner .
# Run:    docker run -p 80:80 -e DATABASE_URL=... -e JWT_SECRET=... milkrunner/foodplanner

# --- Stage 1: Build Tailwind CSS ---
FROM node:20-alpine AS css-build
WORKDIR /app
COPY package.json tailwind.config.js ./
COPY css/input.css ./css/
COPY index.html ./
COPY js/ ./js/
RUN npm install tailwindcss \
    && npx tailwindcss -i ./css/input.css -o ./css/styles.css --minify

# --- Stage 2: Install backend dependencies ---
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# --- Stage 3: Production image ---
FROM node:20-alpine

# Install nginx, supervisor, and video processing tools
RUN apk add --no-cache \
    nginx \
    supervisor \
    python3 \
    py3-pip \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install yt-dlp \
    && ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# --- Frontend static files ---
COPY index.html /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/
COPY icons/ /usr/share/nginx/html/icons/
COPY --from=css-build /app/css/styles.css /usr/share/nginx/html/css/styles.css

# --- Nginx config (all-in-one: backend on localhost:3000) ---
COPY nginx.aio.conf /etc/nginx/nginx.conf

# --- Backend ---
WORKDIR /app/backend
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ .

# --- Supervisor config ---
COPY supervisord.conf /etc/supervisord.conf

# --- Create required directories ---
RUN mkdir -p /var/log/supervisor /var/cache/nginx /var/run/nginx /tmp/foodplanner \
    && chown -R node:node /app /tmp/foodplanner \
    && chown -R node:node /usr/share/nginx/html \
    && chown -R node:node /var/cache/nginx /var/log/nginx /var/run/nginx /var/log/supervisor

# Expose HTTP port
EXPOSE 80

# Health check against nginx (which proxies to backend)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start both services via supervisor
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
