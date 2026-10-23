# ==========================================
# Stage 1: Build Static Assets
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable || npm install -g pnpm

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml ./
COPY packages packages
COPY apps/web apps/web

# Install all dependencies across monorepo
RUN pnpm install --frozen-lockfile=false

# Build Web bundle
RUN pnpm --filter @tenants/web build

# ==========================================
# Stage 2: High Performance Nginx Static Server
# ==========================================
FROM nginx:alpine

# Remove default nginx site
RUN rm -rf /etc/nginx/conf.d/*

# Custom hardened Nginx configuration with security headers & gzip
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:8080;" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Copy compiled assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
