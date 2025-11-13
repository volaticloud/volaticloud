#!/bin/bash
# Install OLM (Operator Lifecycle Manager) on Kubernetes cluster
# This script is idempotent and can be run multiple times safely

set -euo pipefail

OLM_VERSION="${OLM_VERSION:-v0.28.0}"

echo "🚀 Installing OLM (Operator Lifecycle Manager) version ${OLM_VERSION}"

# Check if OLM is already installed
if kubectl get csv -n olm &>/dev/null; then
    echo "✅ OLM is already installed"
    kubectl get csv -n olm
    exit 0
fi

echo "📦 Downloading OLM ${OLM_VERSION}..."
curl -sL "https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${OLM_VERSION}/install.sh" | bash -s ${OLM_VERSION}

echo "⏳ Waiting for OLM to be ready..."
kubectl wait --for=condition=Available -n olm deployment/olm-operator --timeout=300s
kubectl wait --for=condition=Available -n olm deployment/catalog-operator --timeout=300s

echo "✅ OLM installed successfully!"
echo ""
echo "📋 OLM Components:"
kubectl get pods -n olm
echo ""
kubectl get catalogsource -n olm

echo ""
echo "✅ OLM installation complete. You can now install operators."
