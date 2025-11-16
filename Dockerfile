# Build stage
# Trigger rebuild - 2025-11-17
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make gcc musl-dev

WORKDIR /build

# Copy go mod files first (better caching)
COPY go.mod go.sum ./

# Download dependencies with cache mount
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy source code
COPY . .

# Build the binary with cache mounts
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o volaticloud ./cmd/server

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 volaticloud && \
    adduser -D -u 1000 -G volaticloud volaticloud

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/volaticloud .

# Create data directory
RUN mkdir -p /app/data && chown -R volaticloud:volaticloud /app

# Switch to non-root user
USER volaticloud

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Default command (runs server automatically with migrations)
ENTRYPOINT ["/app/volaticloud"]
