# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build frontend for production
RUN yarn build

# =============================================================================
# Stage 2: Prepare Backend Dependencies
# =============================================================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package.json backend/yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# =============================================================================
# Stage 3: Production Image
# =============================================================================
FROM node:20-alpine

# Install nginx, supervisor, and required tools
RUN apk add --no-cache \
    nginx \
    supervisor \
    tzdata \
    && mkdir -p /run/nginx

WORKDIR /app

# Copy backend source code
COPY backend/ ./backend/

# Copy backend node_modules from builder stage
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Fix permissions for backend directory
RUN chmod -R 755 /app/backend

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

# Create necessary directories
RUN mkdir -p /app/data \
    && mkdir -p /app/logs \
    && mkdir -p /var/log/supervisor \
    && mkdir -p /var/log/nginx

# Expose port 80 (nginx)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/api/health || exit 1

# Start supervisord (runs nginx + node backend)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
