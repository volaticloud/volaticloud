# Operational Runbooks

This directory contains step-by-step operational guides for common tasks and troubleshooting procedures.

## Available Runbooks

### Development
- **Code Generation** - `make generate` - ENT and GraphQL code generation
- **Running Tests** - `make test` - Run tests with coverage
- **Linting** - `make lint` - Code quality checks
- **Building** - `make build` - Build binary

### Database
- **Migrations** - Database schema migrations (automatic on server start)
- **Reset Database** - `make db-reset` - Reset local database

### Documentation
- **Generate Diagrams** - `make docs-generate` - Generate ERD and dependency diagrams
- **Verify Docs** - `make docs-verify` - Validate documentation structure
- **GraphQL Docs** - `./scripts/generate-graphql-docs.sh` - Generate API docs (requires running server)

### Deployment
- **Backend Deployment** - Kubernetes deployment with Helm
- **Database Migrations** - Automatic on server startup
- **Health Checks** - `/health` endpoint monitoring

### Troubleshooting
- **Server Won't Start** - Check database connection, Keycloak availability
- **GraphQL Errors** - Check schema sync, run `make generate`
- **Test Failures** - Check database state, mock configurations
- **Docker Issues** - Check Docker daemon, volumes, networks

## Quick Reference

```bash
# Development Workflow
make generate  # Generate code
make test      # Run tests
make build     # Build binary
make dev       # Run server

# Documentation
make docs-generate  # Generate diagrams
make docs-verify    # Verify structure

# Database
# Migrations run automatically on server start (no manual command needed)
make db-reset  # Reset database

# Deployment
kubectl get pods -n volaticloud  # Check pods
kubectl logs -f -l app=volaticloud-backend  # View logs
```

## Emergency Contacts

- **Primary**: Development Team
- **Escalation**: DevOps Team
- **On-Call**: See PagerDuty schedule

## Related Documentation

- [ADRs](../adr/) - Architecture decisions
- [Patterns](../patterns/) - Code patterns
- [API Docs](../api/graphql/) - GraphQL API documentation
- [Package Docs](../../internal/) - Go package documentation

## Contributing

When adding runbooks:

1. Use clear step-by-step format
2. Include prerequisites
3. Add troubleshooting section
4. Document rollback procedures
5. Link to related documentation
