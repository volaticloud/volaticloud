#!/bin/bash

echo "=== Checking pods in anytrade namespace ==="
kubectl get pods -n anytrade -o wide

echo ""
echo "=== Pod details and events ==="
kubectl describe pod -n anytrade -l app=anytrade-backend

echo ""
echo "=== Pod status and image info ==="
kubectl get pods -n anytrade -l app=anytrade-backend -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}  Status: {.status.phase}{"\n"}  Image: {.spec.containers[0].image}{"\n"}  ImagePullBackOff: {.status.containerStatuses[0].state.waiting.reason}{"\n"}{end}'

echo ""
echo "=== Pod logs (if available) ==="
kubectl logs -n anytrade -l app=anytrade-backend --tail=50 || echo "No logs available yet"

echo ""
echo "=== Recent events ==="
kubectl get events -n anytrade --sort-by='.lastTimestamp' | tail -20