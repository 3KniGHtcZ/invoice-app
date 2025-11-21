# =============================================================================
# Stage 1: Build Frontend
# =============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package.json, yarn.lock, and workspace package.json files
COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

# Install all dependencies using Yarn Workspaces
RUN yarn install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./frontend/

# Build frontend for production
RUN yarn workspace frontend build

# =============================================================================
# Stage 2: Prepare Backend Dependencies
# =============================================================================
FROM node:20-alpine AS backend-builder

WORKDIR /app

# Copy root package.json, yarn.lock, and workspace package.json files
COPY package.json yarn.lock ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json

# Install production dependencies only using Yarn Workspaces
RUN yarn install --frozen-lockfile --production

# =============================================================================
# Stage 3: Production Image
# =============================================================================
FROM node:20-alpine

# Build arguments for version information
ARG BUILD_DATE
ARG GIT_COMMIT
ARG GIT_BRANCH
ARG VERSION

# Install nginx, supervisor, and required tools
RUN apk add --no-cache \
    nginx \
    supervisor \
    tzdata \
    && mkdir -p /run/nginx

WORKDIR /app

# Create build info file
RUN echo "{\
  \"buildDate\": \"${BUILD_DATE:-unknown}\",\
  \"gitCommit\": \"${GIT_COMMIT:-unknown}\",\
  \"gitBranch\": \"${GIT_BRANCH:-unknown}\",\
  \"version\": \"${VERSION:-dev}\"\
}" > /app/build-info.json

# Copy backend source code
COPY backend/ ./backend/

# Copy backend node_modules from builder stage
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Fix permissions for backend directory
RUN chmod -R 755 /app/backend

# Copy frontend build from builder stage
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

# Create necessary directories with proper permissions
RUN mkdir -p /app/data \
    && mkdir -p /app/logs \
    && mkdir -p /var/log/supervisor \
    && mkdir -p /var/log/nginx \
    && chmod -R 777 /app/data \
    && chmod -R 777 /app/logs

# Define volumes
VOLUME ["/app/data", "/app/logs"]

# Expose port 80 (nginx)
EXPOSE 80

# Health check
# Increased start-period to 60s to give backend time to fully start
# Increased timeout to 10s for more reliable checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/api/health || exit 1

# Start supervisord (runs nginx + node backend)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
