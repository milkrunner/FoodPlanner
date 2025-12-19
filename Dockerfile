# Multi-stage build für optimale Image-Größe
FROM nginx:alpine

# Metadaten
LABEL maintainer="Food Planner"
LABEL description="Static web application for weekly meal planning"

# Kopiere die statischen Dateien in das nginx html Verzeichnis
COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Kopiere die nginx Konfiguration
COPY nginx.conf /etc/nginx/nginx.conf

# Exponiere Port 80
EXPOSE 80

# Starte nginx im Vordergrund
CMD ["nginx", "-g", "daemon off;"]
