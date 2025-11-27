# Monitoring Guide

This section is under construction. It will cover:

- Bot monitoring and health checks
- Metrics collection and visualization
- Alerting and notifications
- Performance monitoring
- Distributed monitoring coordination

For now, refer to the following resources:

- [Monitor Package Documentation](../../internal/monitor/doc.go) - Detailed architecture and implementation
- [Bot Monitor Implementation](../../internal/monitor/bot_monitor.go)
- [Backtest Monitor Implementation](../../internal/monitor/backtest_monitor.go)
- [Coordinator Implementation](../../internal/monitor/coordinator.go) - Distributed coordination

## Quick Reference

The monitor package provides:

- Bot status monitoring (30-second intervals)
- Freqtrade metrics collection
- Backtest lifecycle management
- Distributed coordination via etcd
- Universal connection strategy (container IP + localhost fallback)

See the runbooks for operational guidance:

- [Troubleshooting Guide](../runbooks/troubleshooting.md)
- [Recovery Procedures](../runbooks/recovery.md)
