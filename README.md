# VolatiCloud

VolatiCloud is a control-plane platform for managing freqtrade trading bots. It provides centralized management of bot lifecycles, strategies, exchanges, backtesting, and hyperparameter optimization.

## CI/CD Status

[![Backend CI](https://github.com/diazoxide/volaticloud/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/diazoxide/volaticloud/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/diazoxide/volaticloud/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/diazoxide/volaticloud/actions/workflows/frontend-ci.yml)
[![Security Scanning](https://github.com/diazoxide/volaticloud/actions/workflows/security.yml/badge.svg)](https://github.com/diazoxide/volaticloud/actions/workflows/security.yml)
[![Code Quality](https://github.com/diazoxide/volaticloud/actions/workflows/quality.yml/badge.svg)](https://github.com/diazoxide/volaticloud/actions/workflows/quality.yml)

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

- `ANYTRADE_HOST` - Server host (default: 0.0.0.0)
- `ANYTRADE_PORT` - Server port (default: 8080)
- `ANYTRADE_DATABASE` - Database connection string (default: sqlite://./data/volaticloud.db)
- `ANYTRADE_ENCRYPTION_KEY` - 32-byte encryption key for secrets
- `ANYTRADE_RUNTIME` - Default runtime type (docker, kubernetes, local)

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
