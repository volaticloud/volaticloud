# AnyTrade Development TODO List

**Last Updated:** 2025-10-23
**Status Tracking:** ⏳ Pending | 🔧 In Progress | ✅ Done

---

## CRITICAL PRIORITY (Must Fix Before Production) 🚨

### 1.1 Fix Config Mutation Bug ✅
**File:** `internal/graph/helpers.go:33-44`
**Issue:** Map reference instead of copy causes in-memory mutation
**Impact:** Race conditions, data inconsistency
**Status:** FIXED (Completed: 2025-10-23)
**Test Coverage:** 100% verified in `helpers_test.go`
```go
// FIXED: Now creates a copy of the config
botConfig := make(map[string]interface{})
if b.Config != nil {
    for k, v := range b.Config {
        botConfig[k] = v
    }
}
botConfig["dry_run"] = (b.Mode == enum.BotModeDryRun)
```

### 1.2 Add Range Validation for Numeric Fields ⏳
**File:** `internal/graph/helpers.go:139-147`
**Issue:** No validation of value ranges (negative/zero values)
**Impact:** Invalid configs pass validation
**Estimated Time:** 1 hour
```go
// TODO: Add positive number validation
switch v := stakeAmount.(type) {
case int, int64:
    if v <= 0 {
        return fmt.Errorf("stake_amount must be positive")
    }
case float64, float32:
    if v <= 0.0 {
        return fmt.Errorf("stake_amount must be positive")
    }
default:
    return fmt.Errorf("stake_amount must be a number")
}
```

### 1.3 Improve Exchange Credential Validation ⏳
**File:** `internal/graph/helpers.go:77-84`
**Issue:** Accepts placeholder/test credentials
**Impact:** Security risk, runtime failures
**Estimated Time:** 1 hour
```go
// TODO: Add credential format validation
// - Check for placeholder values (your, test, example)
// - Validate minimum length (16+ chars)
// - Pattern validation for known exchanges
```

### 1.4 Add Container Cleanup on DB Failure ⏳
**File:** `internal/graph/schema.resolvers.go:92-110`
**Issue:** Orphaned containers if DB update fails
**Impact:** Resource leaks
**Estimated Time:** 1 hour
```go
// TODO: Add cleanup logic
if err != nil {
    cleanupErr := rt.DeleteBot(ctx, containerID)
    if cleanupErr != nil {
        // Log both errors
    }
    return nil, fmt.Errorf("failed to update bot (container cleaned up): %w", err)
}
```

### 1.5 Prevent Config Updates on Running Bots ⏳
**File:** `internal/graph/schema.resolvers.go:115-124`
**Issue:** Config changes don't apply to running bots
**Impact:** User confusion, unexpected behavior
**Estimated Time:** 30 minutes
```go
// TODO: Check bot status before allowing config update
if input.Config != nil {
    b, err := r.client.Bot.Get(ctx, id)
    if err != nil {
        return nil, err
    }
    if b.Status == enum.BotStatusRunning {
        return nil, fmt.Errorf("cannot update config while bot is running")
    }
}
```

---

## HIGH PRIORITY (Fix Soon) 🔥

### 2.1 Add Nested Field Validation ⏳
**File:** `internal/graph/helpers.go:116-137`
**Issue:** Only checks existence, not values
**Estimated Time:** 2 hours
- Validate `price_side` enum values (ask, bid, same, other)
- Validate `use_order_book` boolean type
- Validate `order_book_top` >= 1
- Add validation for `check_depth_of_market` structure

### 2.2 Add Unit Tests for Validation ⏳
**File:** `internal/graph/helpers_test.go` (new file)
**Issue:** No tests for validation logic
**Estimated Time:** 3 hours
- Test missing required fields
- Test invalid types
- Test boundary values
- Test nested object validation
- Test config mutation

### 2.3 Add Integration Tests ⏳
**File:** `internal/graph/integration_test.go` (new file)
**Issue:** No end-to-end tests
**Estimated Time:** 4 hours
- Test complete bot creation flow
- Test container lifecycle
- Test error handling paths

### 2.4 Add Input Sanitization ⏳
**File:** Multiple files
**Issue:** No sanitization of user input
**Estimated Time:** 2 hours
- Sanitize bot names (Docker container naming)
- Sanitize strategy names
- Prevent SQL/log injection

### 2.5 Add Context Timeouts ⏳
**File:** `internal/graph/schema.resolvers.go`
**Issue:** No timeout handling
**Estimated Time:** 1 hour
```go
// TODO: Add context timeouts
ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
defer cancel()
```

---

## MEDIUM PRIORITY (Enhancement) ⚡

### 3.1 Validate Optional But Important Fields ⏳
**File:** `internal/graph/helpers.go`
**Estimated Time:** 3 hours
- Validate `timeframe` format (1m, 5m, 1h, etc.)
- Validate `max_open_trades` > 0
- Validate `pair_whitelist` has at least 1 pair
- Validate `pairlists` structure

### 3.2 Improve Error Messages ⏳
**File:** Multiple files
**Issue:** Inconsistent formatting
**Estimated Time:** 1 hour
- Standardize on lowercase error messages
- Add more context to errors
- Include field paths in nested errors

### 3.3 Add Proper Logging ⏳
**File:** Multiple files
**Issue:** No structured logging
**Estimated Time:** 2 hours
- Add structured logger (zerolog/zap)
- Log critical operations
- Don't log credentials
- Log error context

### 3.4 Remove Hard-coded Values ⏳
**File:** `internal/graph/helpers.go:56`
**Issue:** Magic numbers
**Estimated Time:** 30 minutes
```go
// TODO: Move to constants
const (
    DefaultFreqtradeAPIPort = 8080
    DefaultContainerTimeout = 30 * time.Second
)
```

### 3.5 Add godoc Comments ⏳
**File:** `internal/graph/helpers.go`
**Issue:** Missing documentation
**Estimated Time:** 1 hour
```go
// TODO: Add comprehensive godoc
// validateFreqtradeConfig validates a Freqtrade bot configuration.
// It checks for required fields and validates structure of pricing objects.
// Returns an error if validation fails, nil otherwise.
```

### 3.6 Optimize Database Queries ⏳
**File:** `internal/graph/schema.resolvers.go:56-67`
**Issue:** Multiple queries for same data
**Estimated Time:** 2 hours
- Use eager loading
- Reduce round trips to database
- Consider caching frequently accessed data

---

## SECURITY IMPROVEMENTS 🔒

### 4.1 Review Exchange Credential Storage ⏳
**File:** Database schema, config handling
**Issue:** Unclear if credentials are encrypted
**Estimated Time:** 4 hours
- Verify database encryption
- Consider secrets management (Vault)
- Clear sensitive data from memory
- Audit all error messages for credential leaks

### 4.2 Add Rate Limiting ⏳
**File:** GraphQL middleware (new)
**Issue:** No protection against abuse
**Estimated Time:** 3 hours
- Implement rate limiting on mutations
- Add per-user limits
- Add global limits
- Consider CAPTCHA for suspicious activity

### 4.3 Improve Container Name Security ⏳
**File:** `internal/runner/docker_runner.go`
**Issue:** Predictable naming pattern
**Estimated Time:** 30 minutes
- Add random suffix to container names
- Or use full container ID as reference

---

## FEATURES & IMPROVEMENTS 🎯

### 5.1 Add Dry-Run Validation Endpoint ⏳
**File:** `internal/graph/schema.graphqls` (new mutation)
**Issue:** No way to validate config without creating bot
**Estimated Time:** 2 hours
```graphql
# TODO: Add validateBotConfig mutation
validateBotConfig(config: JSON!): ValidationResult!

type ValidationResult {
  valid: Boolean!
  errors: [String!]!
}
```

### 5.2 Implement Config Versioning ⏳
**File:** Database schema, bot entity
**Issue:** Can't rollback to previous config
**Estimated Time:** 6 hours
- Add config history table
- Track config changes
- Add rollback mutation
- Show config diff in UI

### 5.3 Full Freqtrade Schema Validation ⏳
**File:** `internal/graph/helpers.go`
**Issue:** Only validates 4 required fields
**Estimated Time:** 8 hours
- Import Freqtrade JSON schema
- Validate against official schema
- Keep schema updated with Freqtrade versions
- Generate validation from schema

### 5.4 Add Performance Monitoring ⏳
**File:** Multiple files
**Issue:** No visibility into performance
**Estimated Time:** 4 hours
- Add request timing
- Track database query performance
- Monitor Docker operations
- Add metrics endpoint (Prometheus)

---

## TESTING IMPROVEMENTS 🧪

### 6.1 Unit Tests for helpers.go ✅
**Priority:** HIGH
**Status:** COMPLETED (2025-10-23)
**Coverage:** 100% for all 3 functions
**Tests Created:**
- ✅ `TestValidateFreqtradeConfig` - 17 test cases covering:
  - Missing required fields
  - Invalid types (string for number, number for string)
  - Nested object structure validation
  - Valid minimal and complete configs
- ✅ `TestExtractExchangeCredentials` - 12 test cases covering:
  - Nil/empty configs
  - Missing/empty credentials
  - Invalid types
  - Valid credentials for multiple exchanges
- ✅ `TestBuildBotSpec` - 6 test cases covering:
  - Missing edges
  - Config mutation prevention (regression test)
  - Dry-run vs live mode
  - Nil config handling
  - Error propagation

**File:** `internal/graph/helpers_test.go`
**Coverage Report:**
- `buildBotSpec`: 100%
- `extractExchangeCredentials`: 100%
- `validateFreqtradeConfig`: 100%

### 6.2 Unit Tests for schema.resolvers.go ⏳
**Priority:** HIGH
**Estimated Time:** 4 hours
- `TestCreateBot_ValidationErrors`
- `TestCreateBot_ContainerFailure`
- `TestCreateBot_DBFailure`
- `TestUpdateBot_RunningBot`
- `TestStartBot_MissingContainer`
- `TestStopBot_AlreadyStopped`

### 6.3 Integration Tests ⏳
**Priority:** MEDIUM
**Estimated Time:** 4 hours
- Test complete bot lifecycle
- Test error recovery
- Test concurrent operations
- Test with real Docker containers

### 6.4 Increase Test Coverage to 95%+ ⏳
**Priority:** MEDIUM
**Estimated Time:** 4 hours
- Cover all error paths
- Cover all edge cases
- Add table-driven tests
- Add fuzzing tests for validation

---

## DOCUMENTATION 📚

### 7.1 Add Examples to CLAUDE.md ⏳
**Estimated Time:** 2 hours
- Explain each config field
- Provide common config templates
- Document validation rules
- Add troubleshooting guide

### 7.2 Create API Documentation ⏳
**Estimated Time:** 3 hours
- Document all mutations
- Document all queries
- Provide curl examples
- Explain error responses

### 7.3 Create Developer Guide ⏳
**Estimated Time:** 4 hours
- Setup instructions
- Architecture overview
- Contributing guidelines
- Testing guide

---

## CLEANUP & REFACTORING 🧹

### 8.1 Remove Background Test Processes ⏳
**Issue:** Multiple zombie processes running
**Estimated Time:** 15 minutes
```bash
# TODO: Create cleanup script
pkill -f "anytrade server"
pkill -f "npm.*dev"
```

### 8.2 Extract Validation to Separate Package ⏳
**File:** `internal/validation/` (new package)
**Issue:** Validation mixed with business logic
**Estimated Time:** 3 hours
- Create `internal/validation/freqtrade.go`
- Move all validation functions
- Add comprehensive tests
- Import in graph resolvers

### 8.3 Create Constants File ⏳
**File:** `internal/constants/constants.go` (new)
**Issue:** Magic numbers scattered
**Estimated Time:** 1 hour
- Extract all hard-coded values
- Group by category
- Document each constant

---

## SUMMARY

**Total TODOs:** 35

**By Priority:**
- Critical: 5 (Must fix before production)
- High: 5 (Fix in next sprint)
- Medium: 6 (Enhancement)
- Security: 3 (Important)
- Features: 4 (Nice to have)
- Testing: 4 (Quality)
- Documentation: 3 (Maintenance)
- Cleanup: 3 (Tech debt)

**Total Estimated Time:** ~75 hours

**Recommended Sprint Planning:**
1. **Sprint 1 (Critical):** Issues 1.1-1.5 + 6.1-6.2 (~10 hours)
2. **Sprint 2 (High Priority):** Issues 2.1-2.5 (~15 hours)
3. **Sprint 3 (Security + Medium):** Issues 3.1-3.6 + 4.1-4.3 (~20 hours)
4. **Sprint 4 (Features + Testing):** Issues 5.1-5.4 + 6.3-6.4 (~20 hours)
5. **Sprint 5 (Documentation + Cleanup):** Issues 7.1-7.3 + 8.1-8.3 (~10 hours)

---

## TRACKING

Use this format to track progress:
```
✅ 1.1 Fix Config Mutation Bug - DONE (Completed: 2025-10-23)
🔧 1.2 Add Range Validation - IN PROGRESS (Started: 2025-10-23)
⏳ 1.3 Improve Credential Validation - PENDING
```

Update this file as items are completed!