# Troubleshooting Runbook

## Overview

This runbook provides diagnostic procedures and solutions for common issues in the VolatiCloud platform.

## Quick Diagnostic Commands

```bash
# System health check
kubectl get pods -n volaticloud
kubectl get svc -n volaticloud
kubectl get ingress -n volaticloud

# Application logs
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=100

# Resource usage
kubectl top pods -n volaticloud
kubectl top nodes

# Events
kubectl get events -n volaticloud --sort-by='.lastTimestamp' | head -20
```

---

## Server Won't Start

### Symptom
Pods in `CrashLoopBackOff` or `Error` state

### Diagnosis

```bash
# Check pod status
kubectl get pods -n volaticloud -l app=volaticloud-backend

# Check logs from failed container
kubectl logs <POD_NAME> -n volaticloud --previous

# Check pod events
kubectl describe pod <POD_NAME> -n volaticloud
```

### Common Causes & Solutions

#### 1. Database Connection Failure

**Error message**: `failed to connect to postgres`

**Check**:
```bash
# Verify database secret exists
kubectl get secret volaticloud-db-secret -n volaticloud

# Check secret contents
kubectl get secret volaticloud-db-secret -n volaticloud -o json | jq '.data | map_values(@base64d)'

# Test database connectivity
kubectl run -it --rm psql-test --image=postgres:14 --restart=Never -- \
  psql -h <DB_HOST> -U volaticloud -d volaticloud -c "SELECT 1;"
```

**Solutions**:
- Verify database credentials in secret
- Check database firewall rules (allow VKE cluster IPs)
- Verify database is running: `pg_isready -h <DB_HOST>`
- Check network connectivity from cluster to database

#### 2. Keycloak Configuration Missing

**Error message**: `Keycloak configuration required`

**Check**:
```bash
# Verify environment variables
kubectl get deployment volaticloud-backend -n volaticloud -o yaml | grep -A 10 env:
```

**Solutions**:
- Add Keycloak environment variables to `values.yaml`:
  ```yaml
  deployment:
    env:
      - name: VOLATICLOUD_KEYCLOAK_URL
        value: "https://keycloak.volaticloud.com"
      - name: VOLATICLOUD_KEYCLOAK_REALM
        value: "volaticloud"
      - name: VOLATICLOUD_KEYCLOAK_CLIENT_ID
        value: "volaticloud-api"
      - name: VOLATICLOUD_KEYCLOAK_CLIENT_SECRET
        valueFrom:
          secretKeyRef:
            name: keycloak-client-secret
            key: client-secret
  ```
- Redeploy: `helm upgrade volaticloud-backend ...`

#### 3. Migration Failure

**Error message**: `failed creating schema resources`

**Check**:
```bash
# Check logs for migration error
kubectl logs -n volaticloud -l app=volaticloud-backend | grep -i "failed creating schema"
```

**Solutions**:
- Verify database schema permissions (user needs CREATE TABLE)
- Check for conflicting manual changes to database
- Rollback manual schema changes and let ENT manage schema
- If persistent, consider fresh database with clean migration

---

## GraphQL Errors

### Symptom
GraphQL queries return errors or unexpected results

### Diagnosis

```bash
# Test GraphQL endpoint
curl -X POST https://api.volaticloud.com/query \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'

# Check for schema generation issues
make generate
git status  # Check for uncommitted schema changes
```

### Common Causes & Solutions

#### 1. Schema Out of Sync

**Error message**: `Cannot query field "xyz" on type "ABC"`

**Solutions**:
```bash
# Regenerate schema
make generate

# Rebuild and restart server
make build
pkill -f "volaticloud server"
./bin/volaticloud server

# For production, redeploy with new image
docker build -t ghcr.io/volaticloud/volaticloud:latest .
docker push ghcr.io/volaticloud/volaticloud:latest
kubectl rollout restart deployment/volaticloud-backend -n volaticloud
```

#### 2. Authorization Failures

**Error message**: `permission denied` or `403 Forbidden`

**Check**:
```bash
# Verify Keycloak is accessible
curl https://keycloak.volaticloud.com/auth/realms/volaticloud/.well-known/openid-configuration

# Check JWT token validity
echo $JWT_TOKEN | cut -d. -f2 | base64 -d | jq
```

**Solutions**:
- Verify user has correct permissions in Keycloak
- Check resource ownership (user must own resource or have permission)
- Verify JWT token is not expired
- Check Keycloak UMA resource registration

#### 3. Validation Errors

**Error message**: `config validation failed`

**Check**:
```bash
# Test config validation locally
go test -v ./internal/bot -run TestValidateConfig
```

**Solutions**:
- Ensure all required fields present (stake_currency, stake_amount, etc.)
- Verify field types match schema (numbers not strings)
- Check nested objects (entry_pricing, exit_pricing)
- Validate against Freqtrade schema: https://schema.freqtrade.io/schema.json

---

## Database Issues

### Symptom
Database queries slow or failing

### Diagnosis

```bash
# Check database connections
kubectl logs -n volaticloud -l app=volaticloud-backend | grep -i "database"

# Monitor database performance
# (Connect to Vultr control panel to view metrics)
```

### Common Causes & Solutions

#### 1. Connection Pool Exhausted

**Error message**: `pq: sorry, too many clients already`

**Solutions**:
- Increase database max_connections (via Vultr control panel)
- Reduce connection pool size in application
- Scale up database instance
- Check for connection leaks (improper closure)

#### 2. Slow Queries

**Check**:
```bash
# Enable query logging in PostgreSQL
# ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
```

**Solutions**:
- Add indexes for frequently queried fields
- Optimize N+1 query patterns (use eager loading)
- Use ENT query optimizations (`.WithXXX()` methods)
- Consider database read replicas

#### 3. Migration Deadlock

**Error message**: `deadlock detected`

**Solutions**:
- Migrations run automatically on server startup (ENT auto-migration)
- Each pod attempts migration (idempotent, safe to run multiple times)
- Deadlocks are rare due to idempotent nature of ENT migrations
- If persistent, increase statement_timeout in PostgreSQL

---

## Docker Issues

### Symptom
Bots or backtests not starting, container errors

### Diagnosis

```bash
# Check Docker daemon status
docker ps
docker info

# Check Docker logs
docker logs <CONTAINER_ID>

# Check volumes
docker volume ls
docker volume inspect volaticloud-freqtrade-data
```

### Common Causes & Solutions

#### 1. Volume Mount Issues

**Error message**: `no such file or directory`

**Solutions**:
```bash
# Recreate volume
docker volume rm volaticloud-freqtrade-data
docker volume create volaticloud-freqtrade-data

# Check volume permissions
docker run --rm -v volaticloud-freqtrade-data:/data alpine ls -la /data
```

#### 2. Image Pull Failures

**Error message**: `Failed to pull image`

**Solutions**:
- Verify Docker Hub rate limits
- Check internet connectivity
- Use authenticated Docker Hub account
- Consider using private registry

#### 3. Container Won't Start

**Check**:
```bash
# Inspect container
docker inspect <CONTAINER_ID>

# Check container logs
docker logs <CONTAINER_ID>
```

**Solutions**:
- Verify required environment variables set
- Check mounted volumes exist
- Ensure sufficient disk space
- Review container command and entrypoint

---

## Performance Issues

### Symptom
Slow API responses, high latency

### Diagnosis

```bash
# Check resource usage
kubectl top pods -n volaticloud

# Check HPA status
kubectl get hpa -n volaticloud

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s https://api.volaticloud.com/health
# curl-format.txt:
# time_namelookup:  %{time_namelookup}\n
# time_connect:  %{time_connect}\n
# time_starttransfer:  %{time_starttransfer}\n
# time_total:  %{time_total}\n
```

### Common Causes & Solutions

#### 1. High CPU/Memory Usage

**Solutions**:
- Scale horizontally (increase replica count)
- Scale vertically (increase resource limits)
- Profile application for bottlenecks
- Optimize database queries

#### 2. Database Query Performance

**Solutions**:
```go
// Use ENT query optimization
bots := client.Bot.Query().
    WithStrategy().     // Eager load strategy
    WithMetrics().      // Eager load metrics
    Limit(10).
    All(ctx)

// Add indexes
index.Fields("owner_id", "created_at")
```

#### 3. Excessive GraphQL Queries (N+1 Problem)

**Solutions**:
- Use DataLoader pattern
- Implement query batching
- Use ENT's `.WithXXX()` methods for eager loading
- Consider GraphQL query complexity limits

---

## Keycloak Integration Issues

### Symptom
Authentication or authorization failures

### Diagnosis

```bash
# Test Keycloak connectivity
curl https://keycloak.volaticloud.com/auth/realms/volaticloud

# Check Keycloak logs
docker logs volaticloud-keycloak
```

### Common Causes & Solutions

#### 1. UMA Resource Registration Failures

**Error message**: `failed to register UMA resource`

**Check**:
```bash
# Verify client credentials
curl -X POST https://keycloak.volaticloud.com/auth/realms/volaticloud/protocol/openid-connect/token \
  -d "client_id=volaticloud-api" \
  -d "client_secret=<SECRET>" \
  -d "grant_type=client_credentials"
```

**Solutions**:
- Verify client credentials are correct
- Check client has UMA protection enabled
- Verify client has `uma_protection` scope
- Check Keycloak service account roles

#### 2. Permission Token Failures

**Error message**: `permission denied`

**Solutions**:
- Verify user exists in Keycloak
- Check resource ownership (owner_id matches user ID)
- Verify resource registered in Keycloak UMA
- Check permission policies in Keycloak

---

## Test Failures

### Symptom
`make test` fails

### Diagnosis

```bash
# Run tests with verbose output
go test -v ./internal/graph -run TestFailingTest

# Run single test
go test -v ./internal/graph -run TestCreateBot

# Check test coverage
go test -cover ./internal/graph
```

### Common Causes & Solutions

#### 1. Database State Issues

**Solutions**:
```bash
# Tests use in-memory SQLite - should be isolated
# If tests fail intermittently, check for:
- Race conditions (run with -race flag)
- Test order dependencies (tests should be independent)
- Improper cleanup (use t.Cleanup())
```

#### 2. Mock Configuration Issues

**Solutions**:
```go
// Ensure mocks are properly configured
mockUMA := &keycloak.MockUMAClient{
    RegisterResourceFunc: func(ctx context.Context, req keycloak.RegisterResourceRequest) (*keycloak.RegisterResourceResponse, error) {
        return &keycloak.RegisterResourceResponse{ID: "test-id"}, nil
    },
}
```

#### 3. Fixture Data Issues

**Solutions**:
- Verify test fixtures are created correctly
- Check foreign key constraints (Strategy before Bot)
- Use setupTestResolver() helper consistently

---

## Network Issues

### Symptom
Services unreachable, timeouts

### Diagnosis

```bash
# Check service endpoints
kubectl get endpoints -n volaticloud

# Check network policies
kubectl get networkpolicies -n volaticloud

# Test service connectivity
kubectl run -it --rm curl-test --image=curlimages/curl --restart=Never -- \
  curl http://volaticloud-backend:8080/health
```

### Common Causes & Solutions

#### 1. Service Not Exposing Pods

**Check**:
```bash
kubectl describe svc volaticloud-backend -n volaticloud
```

**Solutions**:
- Verify pod labels match service selector
- Check pod readiness (readiness probe must pass)
- Verify service port matches container port

#### 2. Ingress Issues

**Check**:
```bash
kubectl describe ingress -n volaticloud
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

**Solutions**:
- Verify DNS points to correct LoadBalancer IP
- Check TLS certificate validity
- Verify ingress-nginx controller is running
- Check ingress annotations

---

## Emergency Procedures

### Complete System Restart

```bash
# 1. Scale down deployment
kubectl scale deployment volaticloud-backend -n volaticloud --replicas=0

# 2. Wait for pods to terminate
kubectl get pods -n volaticloud -w

# 3. Clear any stuck resources
kubectl delete pod --field-selector=status.phase=Failed -n volaticloud

# 4. Scale back up
kubectl scale deployment volaticloud-backend -n volaticloud --replicas=2

# 5. Verify health
kubectl rollout status deployment/volaticloud-backend -n volaticloud
```

### Database Emergency Procedures

See [Recovery Runbook](recovery.md#database-recovery)

---

## Diagnostic Tools

### Enable Debug Logging

```yaml
# values.yaml
deployment:
  env:
    - name: LOG_LEVEL
      value: "debug"
```

### Exec into Pod

```bash
kubectl exec -it <POD_NAME> -n volaticloud -- /bin/sh
```

### Port Forward for Local Testing

```bash
# Forward pod port to localhost
kubectl port-forward -n volaticloud <POD_NAME> 8080:8080

# Test locally
curl http://localhost:8080/health
```

### Network Debugging

```bash
# Use netshoot for network debugging
kubectl run -it --rm netshoot --image=nicolaka/netshoot --restart=Never -- /bin/bash

# Inside container:
nslookup volaticloud-backend.volaticloud.svc.cluster.local
curl http://volaticloud-backend:8080/health
traceroute api.volaticloud.com
```

---

## Related Documentation

- [Deployment Runbook](deployment.md)
- [Recovery Runbook](recovery.md)
- [Monitoring Guide](../monitoring/)
- [API Documentation](../api/graphql/)

---

## Escalation Path

1. **Level 1**: Check this runbook
2. **Level 2**: #engineering Slack channel
3. **Level 3**: On-call engineer (PagerDuty)
4. **Level 4**: DevOps/Infrastructure team
5. **Level 5**: CTO escalation
