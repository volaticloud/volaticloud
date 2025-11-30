# Backup Strategy

This document is under construction. It will cover:

- Database backup procedures
- Configuration backup
- Container volume backup
- Disaster recovery procedures
- Backup verification and testing
- Retention policies

## Current Implementation

As of now, VolatiCloud uses:

- PostgreSQL database (managed service or self-hosted)
- Docker volumes for Freqtrade data and configs
- Local development with SQLite

## Planned Backup Strategy

### Database Backups

**PostgreSQL (Production):**

- Automated daily backups via managed service
- Point-in-time recovery support
- Cross-region replication (planned)

**SQLite (Development):**

- Manual backups before major changes
- Stored in version control (development data only)

### Volume Backups

**Freqtrade Data Volume:**

- Contains historical OHLCV data
- Regenerable via download-data command
- Low priority for backup (can be re-downloaded)

**Config Volume:**

- Contains bot configurations
- Critical data - backed up to database
- Configs stored in PostgreSQL as JSON

### Disaster Recovery

**Database Recovery:**

1. Restore from latest backup
2. Apply transaction logs (PITR)
3. Verify data integrity
4. Resume operations

**Volume Recovery:**

1. Recreate Docker volumes
2. Re-download historical data
3. Restore configs from database
4. Restart containers

## Related Resources

- [Recovery Runbook](../runbooks/recovery.md) - Step-by-step recovery procedures
- [Troubleshooting Guide](../runbooks/troubleshooting.md) - Common issues and solutions
- [Deployment Documentation](../../deployments/README.md) - Infrastructure setup

## Future Enhancements

- [ ] Automated backup verification
- [ ] Encrypted backups
- [ ] Off-site backup storage
- [ ] Backup monitoring and alerting
- [ ] Disaster recovery testing schedule
