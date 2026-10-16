# ==============================================================================
# Stage 1: Build Frontend Assets (React + Vite + TailwindCSS)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm 9 to match lockfileVersion: '9.0' exactly
RUN npm install -g pnpm@9

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* ./

# Install project dependencies using pnpm 9 with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Set default API URL to /api so all requests use same-origin Nginx reverse proxy
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Compile production bundle
RUN pnpm run build

# ==============================================================================
# Stage 2: Production Nginx Server (Reverse Proxy + Static SPA Host)
# ==============================================================================
FROM nginx:alpine

# Clean default configuration and web files
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
