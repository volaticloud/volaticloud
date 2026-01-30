# Stage 1: Build the React landing page
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with Caddy
FROM caddy:2-alpine

# Copy build output to /srv
COPY --from=builder /app/dist /srv

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Expose port
EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
