# OLM (Operator Lifecycle Manager)

OLM is a prerequisite for installing Kubernetes operators like Keycloak operator.

## What is OLM?

OLM (Operator Lifecycle Manager) extends Kubernetes to provide a declarative way to install, manage, and upgrade operators and their dependencies.

## Installation

### Automatic (via GitHub Actions)

OLM is automatically installed when you run the bootstrap workflow:

```bash
gh workflow run bootstrap.yml
```

### Manual Installation

If you need to install OLM manually:

```bash
cd deployments/olm
./install.sh
```

The script is idempotent and can be run multiple times safely.

## Verification

Check if OLM is installed and running:

```bash
# Check OLM pods
kubectl get pods -n olm

# Check installed operators
kubectl get csv -n olm

# Check catalog sources
kubectl get catalogsource -n olm
```

Expected output:

- `olm-operator` pod running
- `catalog-operator` pod running
- `operatorhubio-catalog` catalog source available

## Configuration

Configuration is defined in `values.yaml`:

- OLM version: `v0.28.0`
- Namespace: `olm`
- Catalog sources: OperatorHub.io community operators

## Troubleshooting

### OLM pods not starting

```bash
kubectl describe pod -n olm
kubectl logs -n olm deployment/olm-operator
```

### Catalog source not syncing

```bash
kubectl get catalogsource -n olm
kubectl describe catalogsource operatorhubio-catalog -n olm
```

### Reinstall OLM

```bash
# Delete OLM
kubectl delete csv -n olm --all
kubectl delete subscription -n olm --all
kubectl delete namespace olm

# Reinstall
./install.sh
```

## References

- [OLM Documentation](https://olm.operatorframework.io/)
- [OLM Architecture](https://olm.operatorframework.io/docs/concepts/olm-architecture/)
- [GitHub Repository](https://github.com/operator-framework/operator-lifecycle-manager)
