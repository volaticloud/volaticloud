# VolatiCloud

VolatiCloud is a control-plane platform for managing freqtrade trading bots. It provides centralized management of bot lifecycles, strategies, exchanges, backtesting, and hyperparameter optimization.

## CI/CD Status

[![Backend CI](https://github.com/volaticloud/volaticloud/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/volaticloud/volaticloud/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/volaticloud/volaticloud/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/volaticloud/volaticloud/actions/workflows/frontend-ci.yml)
[![Security Scanning](https://github.com/volaticloud/volaticloud/actions/workflows/security.yml/badge.svg)](https://github.com/volaticloud/volaticloud/actions/workflows/security.yml)
[![Code Quality](https://github.com/volaticloud/volaticloud/actions/workflows/quality.yml/badge.svg)](https://github.com/volaticloud/volaticloud/actions/workflows/quality.yml)

## Features

- 🤖 **Bot Management** - Create, start, stop, and monitor multiple freqtrade bots
- 📊 **Strategy Management** - Store and version control trading strategies
- 💱 **Exchange Integration** - Support for multiple cryptocurrency exchanges (Binance, Kraken, Coinbase, etc.)
- 🔬 **Backtesting** - Test strategies against historical data
- ⚡ **Hyperparameter Optimization** - Optimize strategy parameters automatically
- 🔒 **Security** - Encrypted credentials and secure API access
- 🐳 **Runtime Flexibility** - Run bots in Docker, Kubernetes, or local processes

## Architecture

VolatiCloud uses a pluggable runtime abstraction layer that allows running bots on different backends:

- **Docker** - Run bots in isolated Docker containers (default)
- **Kubernetes** - Deploy bots to Kubernetes clusters (coming soon)
- **Local** - Run bots as local processes for development

## Quick Start

### Prerequisites

- Go 1.24+
- No external dependencies required! Uses SQLite by default.
- Optional: PostgreSQL 14+ if you prefer it over SQLite

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd volaticloud
```

2. Install dependencies:
```bash
make setup
```

3. Run database migrations:
```bash
make migrate
```

4. Start the server:
```bash
make dev
# or
./bin/volaticloud server
```

The server will start on `http://localhost:8080` by default with a SQLite database at `./data/volaticloud.db`.

## Development

### Available Commands

```bash
# Setup
make setup                 # Install dependencies and generate code
make generate             # Generate ENT and GraphQL code

# Development
make dev                  # Run server in dev mode
make build                # Build binary
make test                 # Run tests with coverage
make lint                 # Run linters

# Database
make migrate              # Run database migrations
make db-reset             # Reset database (removes data/volaticloud.db)

# Other
make clean                # Clean generated files and build artifacts
```

### CLI Usage

```bash
# Start the server with SQLite (default)
./bin/volaticloud server

# Start with custom database location
./bin/volaticloud server --database sqlite://./my-custom.db

# Start with PostgreSQL
./bin/volaticloud server --database postgresql://user:pass@localhost:5432/volaticloud

# Run migrations
./bin/volaticloud migrate

# Get help
./bin/volaticloud --help
./bin/volaticloud server --help
```

### Database Options

VolatiCloud supports both SQLite and PostgreSQL:

**SQLite (Default)**
- Zero configuration
- File-based: `./data/volaticloud.db`
- Perfect for single-server deployments
```bash
./bin/volaticloud server --database sqlite://./data/volaticloud.db
```

**PostgreSQL (Optional)**
- Better for multi-server deployments
- Requires PostgreSQL 14+
```bash
./bin/volaticloud server --database postgresql://user:pass@localhost:5432/volaticloud
```

### Environment Variables

**Server Configuration:**
- `VOLATICLOUD_HOST` - Server host (default: 0.0.0.0)
- `VOLATICLOUD_PORT` - Server port (default: 8080)
- `VOLATICLOUD_DATABASE` - Database connection string (default: sqlite://./data/volaticloud.db)
- `VOLATICLOUD_MONITOR_INTERVAL` - Bot monitoring interval (default: 30s)

**Authentication (Required):**
- `VOLATICLOUD_KEYCLOAK_URL` - Keycloak server URL (e.g., https://keycloak.example.com)
- `VOLATICLOUD_KEYCLOAK_REALM` - Keycloak realm name (default: volaticloud)
- `VOLATICLOUD_KEYCLOAK_CLIENT_ID` - Keycloak client ID (default: volaticloud-api)
- `VOLATICLOUD_KEYCLOAK_CLIENT_SECRET` - Keycloak client secret (required)

**Example .env:**
```bash
VOLATICLOUD_HOST=0.0.0.0
VOLATICLOUD_PORT=8080
VOLATICLOUD_DATABASE=sqlite://./data/volaticloud.db
VOLATICLOUD_KEYCLOAK_URL=https://keycloak.volaticloud.com
VOLATICLOUD_KEYCLOAK_REALM=volaticloud
VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=your-secret-here
```

## Authentication and Authorization

VolatiCloud uses **Keycloak** for authentication and authorization. Keycloak is **REQUIRED** - the server will not start without proper configuration.

### Security Model

VolatiCloud implements a multi-layered security architecture:

1. **JWT Authentication** - All API requests require a valid JWT token from Keycloak
2. **GraphQL Directives** - Declarative authorization via `@isAuthenticated` and `@hasScope`
3. **UMA 2.0 Resource Permissions** - Fine-grained resource-level authorization for strategies
4. **Owner-Based Access** - Fast local ownership checks before hitting Keycloak

### Keycloak Setup

**Prerequisites:**
- Keycloak 23+ server running and accessible
- Admin access to create realms and clients

**1. Create Realm:**

```bash
# Create a new realm called "volaticloud"
# Or use an existing realm
```

**2. Create Backend Client (volaticloud-api):**

Navigate to: **Clients → Create Client**

**General Settings:**
- Client ID: `volaticloud-api`
- Client Protocol: `openid-connect`
- Client Authentication: **ON** (confidential client)

**Capability Config:**
- Authorization: **ON** (enable UMA 2.0)
- Service accounts: **ON** (for backend resource management)

**Advanced Settings:**
- Access Type: `confidential`
- Standard Flow: **OFF**
- Service Accounts: **ON**
- Authorization: **ON**

**Service Account Roles:**
After client creation, go to **Service Account Roles** tab:
- Assign realm-management role: `realm-admin` (or create custom role)

**Client Secret:**
- Go to **Credentials** tab
- Copy the **Client Secret** - this is your `VOLATICLOUD_KEYCLOAK_CLIENT_SECRET`

**3. Create Frontend Client (volaticloud-frontend):**

Navigate to: **Clients → Create Client**

**General Settings:**
- Client ID: `volaticloud-frontend`
- Client Protocol: `openid-connect`
- Client Authentication: **OFF** (public client)

**Capability Config:**
- Standard Flow: **ON**
- Direct Access Grants: **ON**
- Authorization: **OFF**

**Valid Redirect URIs:**
```
http://localhost:5173/*
http://localhost:3000/*
https://dashboard.volaticloud.com/*
```

**Web Origins:**
```
http://localhost:5173
http://localhost:3000
https://dashboard.volaticloud.com
```

**4. Enable UMA 2.0 Authorization:**

For `volaticloud-api` client:
- Go to **Authorization** tab
- Ensure **Policy Enforcement Mode** is set to `Enforcing`
- Enable **Resource Server** settings

**5. Create Test User:**

Navigate to: **Users → Add User**

- Username: `testuser`
- Email: `testuser@example.com`
- Email Verified: **ON**

Set password in **Credentials** tab:
- Password: `your-password`
- Temporary: **OFF**

### Testing Authentication

**1. Start the server:**
```bash
export VOLATICLOUD_KEYCLOAK_URL=https://your-keycloak-server.com
export VOLATICLOUD_KEYCLOAK_REALM=volaticloud
export VOLATICLOUD_KEYCLOAK_CLIENT_ID=volaticloud-api
export VOLATICLOUD_KEYCLOAK_CLIENT_SECRET=your-secret-here

./bin/volaticloud server
```

**2. Get a JWT token:**
```bash
curl -X POST 'https://your-keycloak-server.com/realms/volaticloud/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=testuser' \
  -d 'password=your-password' \
  -d 'grant_type=password' \
  -d 'client_id=volaticloud-frontend'
```

**3. Use token in GraphQL requests:**
```bash
curl -X POST 'http://localhost:8080/query' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ latestStrategies { edges { node { id name } } } }"}'
```

### Permission Scopes

VolatiCloud defines the following scopes for Strategy resources:

- `view` - View strategy details
- `edit` - Update strategy code
- `backtest` - Run backtests with the strategy
- `delete` - Delete the strategy

**Automatic Permissions:**
- Strategy owners automatically have all scopes
- Other users can be granted permissions via Keycloak policies

### Troubleshooting

**"Keycloak configuration is required"**
- Ensure all 4 environment variables are set
- Check that values are not empty

**"authentication required"**
- Your JWT token is missing or invalid
- Check Authorization header: `Bearer <token>`
- Verify token hasn't expired

**"insufficient permissions: missing 'edit' scope"**
- You don't have permission to modify this resource
- Check if you're the owner or have been granted access
- Verify Keycloak policies and permissions

**Check Keycloak connectivity:**
```bash
curl https://your-keycloak-server.com/realms/volaticloud/.well-known/openid-configuration
```

**Decode JWT token:**
```bash
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq
```

For detailed authorization documentation, see [CLAUDE.md - Authentication and Authorization](/.claude/CLAUDE.md#authentication-and-authorization).

## Project Structure

```
volaticloud/
├── cmd/
│   └── server/           # Main server application
├── internal/             # Internal packages
│   ├── bot/             # Bot domain logic
│   ├── exchange/        # Exchange management
│   ├── strategy/        # Strategy operations
│   ├── backtest/        # Backtesting
│   ├── hyperopt/        # Hyperparameter optimization
│   ├── trade/           # Trade management
│   ├── runtime/         # Runtime abstraction layer
│   ├── freqtrade/       # Freqtrade API client
│   ├── config/          # Configuration
│   ├── crypto/          # Encryption utilities
│   ├── auth/            # Authentication
│   └── enum/            # Enumerations
├── ent/
│   └── schema/          # Database schemas
├── graph/               # GraphQL schemas (coming soon)
├── templates/           # Configuration templates
├── docker/              # Docker configurations
└── scripts/             # Utility scripts
```

## Database Schema

VolatiCloud uses the following main entities:

- **Exchange** - Cryptocurrency exchange configuration
- **ExchangeSecret** - Encrypted API credentials
- **Strategy** - Trading strategy Python code
- **Bot** - Running bot instances
- **Backtest** - Backtest execution results
- **HyperOpt** - Hyperparameter optimization runs
- **Trade** - Individual trades synced from bots

## Current Status

### ✅ Phase 1: Foundation (COMPLETED)
- [x] Project structure setup
- [x] Go modules initialized
- [x] Dependencies installed (ENT, gqlgen, docker SDK)
- [x] SQLite database (default) with PostgreSQL support
- [x] ENT schemas defined for all 7 entities
- [x] Makefile for common tasks
- [x] CLI application with urfave/cli
- [x] Zero external dependencies - works out of the box!

### 🚧 Next Steps (Phase 2: Database Layer)
- [ ] Add encryption hooks for sensitive fields
- [ ] Test schema with seed data
- [ ] Write comprehensive tests

## Contributing

Please read the [PLAN.md](PLAN.md) file for detailed architecture and implementation plans.

## License

[Add License Here]

## Documentation

- [Architecture Plan](PLAN.md) - Detailed architecture and implementation plan
- [Architecture Overview](ARCHITECTURE.md) - High-level architecture documentation
