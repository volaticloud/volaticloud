# Stage 1: Build the React dashboard
FROM node:20-alpine AS dashboard-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Build FreqUI with custom base path
FROM node:24-alpine AS frequi-builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Clone FreqUI source
RUN apk add --no-cache git && \
    git clone --depth 1 https://github.com/freqtrade/frequi.git .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build with custom base path /frequi/
RUN ./node_modules/.bin/vite build --base=/frequi/

# Stage 3: Serve with Caddy
FROM caddy:2-alpine

# Install jq for JSON processing
RUN apk add --no-cache jq

# Copy dashboard build to /srv (root)
COPY --from=dashboard-builder /app/dist /srv

# Copy FreqUI build to /srv/frequi
COPY --from=frequi-builder /app/dist /srv/frequi

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]