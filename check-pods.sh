#!/bin/bash

echo "=== Checking pods in volaticloud namespace ==="
kubectl get pods -n volaticloud -o wide

echo ""
echo "=== Pod details and events ==="
kubectl describe pod -n volaticloud -l app=volaticloud-backend

echo ""
echo "=== Pod status and image info ==="
kubectl get pods -n volaticloud -l app=volaticloud-backend -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}  Status: {.status.phase}{"\n"}  Image: {.spec.containers[0].image}{"\n"}  ImagePullBackOff: {.status.containerStatuses[0].state.waiting.reason}{"\n"}{end}'

echo ""
echo "=== Pod logs (if available) ==="
kubectl logs -n volaticloud -l app=volaticloud-backend --tail=50 || echo "No logs available yet"

echo ""
echo "=== Recent events ==="
kubectl get events -n volaticloud --sort-by='.lastTimestamp' | tail -20
