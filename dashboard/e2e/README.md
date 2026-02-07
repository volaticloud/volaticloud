# E2E Testing with Playwright

End-to-end tests for VolatiCloud dashboard using Playwright.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Local `/etc/hosts` entries (see setup below)

## Quick Start

```bash
# One-time setup (from project root)
make e2e-setup

# Run E2E tests
make e2e

# Run specific test file
cd dashboard
npx playwright test e2e/specs/01-smoke.spec.ts
```

## Setup

### 1. Install CA Certificate

The E2E environment uses HTTPS with self-signed certificates. Install the CA cert:

```bash
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/ca.crt

# Linux
sudo cp certs/ca.crt /usr/local/share/ca-certificates/volaticloud-e2e.crt
sudo update-ca-certificates
```

### 2. Add Hosts Entries

Add to `/etc/hosts`:

```
127.0.0.1 console.volaticloud.loc
127.0.0.1 auth.volaticloud.loc
```

### 3. Generate Certificates (if missing)

```bash
make e2e-certs
```

## Directory Structure

```
e2e/
├── .auth/                    # Persisted authentication state
│   └── user.json            # Session for reuse across tests
├── flows/                    # Reusable interaction helpers
│   ├── auth.flow.ts         # Authentication and navigation
│   ├── bot.flow.ts          # Bot management
│   ├── exchange.flow.ts     # Exchange configuration
│   ├── organization.flow.ts # Organization setup
│   ├── runner.flow.ts       # Runner and data download
│   └── strategy.flow.ts     # Strategy builder
├── specs/                    # Test specifications
│   ├── 00-setup.spec.ts     # Environment setup (runs first)
│   ├── 01-smoke.spec.ts     # Basic connectivity
│   ├── 02-billing.spec.ts   # Stripe integration
│   └── ...                  # Additional test suites
├── console-tracker.ts       # JavaScript error detection
├── fixtures.ts              # Custom Playwright fixtures
├── global-setup.ts          # One-time authentication
└── state.ts                 # Cross-test state management
```

## Test Execution Order

Tests are numbered to ensure proper execution order:

1. **00-setup** - Creates organization, runner, downloads data
2. **01-smoke** - Verifies basic connectivity and authentication
3. **02-billing** - Tests Stripe subscription flow
4. **03-runner-data** - Verifies data download functionality
5. **04-strategy** - Tests strategy builder
6. **05-bot-management** - Bot CRUD operations
7. **06-error-scenarios** - Error handling tests
8. **07-permission-boundaries** - Authorization tests
9. **08-websocket-reconnection** - Real-time update tests
10. **09-concurrent-operations** - Parallel operation tests
11. **10-comprehensive-backtest** - Full backtest workflow

## Writing Tests

### Using Flow Helpers

Flow helpers encapsulate common interactions:

```typescript
import { createStrategy, runBacktest } from '../flows/strategy.flow';
import { navigateToOrg } from '../flows/auth.flow';

test('create and backtest strategy', async ({ page }) => {
  await navigateToOrg(page, '/strategies');
  const strategyId = await createStrategy(page, 'My Strategy');
  await runBacktest(page, strategyId);
});
```

### State Management

Share context between tests using `state.ts`:

```typescript
import { readState, writeState } from '../state';

// Write state in setup
writeState({ orgId: 'abc', runnerId: 'xyz' });

// Read state in tests
const state = readState();
await navigateToOrg(page, '/runners/' + state.runnerId);
```

### Console Error Tracking

Tests automatically track JavaScript errors:

```typescript
test.extend({
  consoleTracker: async ({ page }, use) => {
    const tracker = trackConsole(page);
    await use(tracker);
    // Errors are reported automatically
  }
});
```

### Adding Test IDs

Use `data-testid` for reliable element selection:

```typescript
// Component
<Button data-testid="submit-create-strategy">Create</Button>

// Test
await page.click('[data-testid="submit-create-strategy"]');
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `E2E_BASE_URL` | Dashboard URL | `https://console.volaticloud.loc` |
| `E2E_HEADLESS` | Run headless | `true` in CI, `false` locally |
| `E2E_PARALLEL` | Enable parallel execution | `false` |
| `E2E_WORKERS` | Number of parallel workers | `1` |
| `CI` | CI environment flag | - |

## Debugging

### View Test Traces

```bash
npx playwright show-trace test-results/*/trace.zip
```

### Run with UI Mode

```bash
npx playwright test --ui
```

### Debug Single Test

```bash
npx playwright test --debug e2e/specs/01-smoke.spec.ts
```

### View Test Report

```bash
npx playwright show-report
```

## Troubleshooting

### Certificate Errors

If you see SSL/TLS errors:

1. Ensure CA cert is installed: `make e2e-setup`
2. Check cert validity: `openssl x509 -in certs/ca.crt -text -noout`
3. Regenerate certs: `make e2e-certs`

### Authentication Failures

If tests fail to authenticate:

1. Check Keycloak is running: `docker compose -f docker-compose.e2e.yml ps`
2. Verify test user exists in realm
3. Delete stale auth state: `rm -rf e2e/.auth/`

### Flaky Tests

For intermittent failures:

1. Check console tracker output for JS errors
2. Increase timeouts for slow operations
3. Use `await expect(element).toBeVisible()` instead of `waitForTimeout`
4. Check network conditions in Docker Compose

### Container Issues

If E2E environment won't start:

```bash
# Clean up
docker compose -f docker-compose.e2e.yml down -v

# Rebuild
docker compose -f docker-compose.e2e.yml build --no-cache

# Start fresh
docker compose -f docker-compose.e2e.yml up -d
```

## CI Integration

E2E tests run automatically on PRs to `main`. See `.github/workflows/e2e.yml`.

Features:
- Docker layer caching for faster builds
- Parallel test execution (3 workers)
- Artifact retention for 7 days
- Automatic retry for flaky tests

## References

- [ADR-0027: E2E Testing Framework](../../docs/adr/0027-e2e-testing-framework.md)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Project Testing Strategy (ADR-0017)](../../docs/adr/0017-hybrid-testing-strategy.md)
