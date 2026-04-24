# ShopMesh — Pure Kubernetes Deployment Guide

> [!IMPORTANT]
> **No CI/CD, no ArgoCD, no Helm, no GitOps.** Everything deploys with a single `kubectl apply` command.

---

## Final Directory Structure

```
k8s/
├── namespace.yaml                          # shopmesh namespace
├── ingress.yaml                            # Nginx Ingress (all routes)
│
├── storage/
│   ├── nfs-pv.yaml                         # StorageClass + NFS PersistentVolume
│   └── pvc.yaml                            # PVC bound to NFS PV
│
├── mongodb/
│   ├── secret.yaml                         # Root credentials
│   ├── service.yaml                        # Headless Service (stable DNS per pod)
│   └── statefulset.yaml                    # MongoDB 7.0 StatefulSet
│
├── services/
│   ├── auth-service/
│   │   ├── configmap.yaml                  # PORT, NODE_ENV, JWT_EXPIRES_IN, MONGO_HOST
│   │   ├── secret.yaml                     # JWT_SECRET, MONGO_URI
│   │   ├── deployment.yaml                 # 2 replicas, rolling update, probes
│   │   ├── service.yaml                    # ClusterIP :3001
│   │   └── networkpolicy.yaml             # frontend/product/order → :3001, egress → mongo+DNS
│   │
│   ├── product-service/
│   │   ├── configmap.yaml                  # PORT, AUTH_SERVICE_URL, MONGO_HOST
│   │   ├── secret.yaml                     # MONGO_URI
│   │   ├── deployment.yaml                 # 2 replicas
│   │   ├── service.yaml                    # ClusterIP :3002
│   │   └── networkpolicy.yaml             # frontend/order → :3002, egress → auth+mongo+DNS
│   │
│   ├── order-service/
│   │   ├── configmap.yaml                  # PORT, AUTH/PRODUCT_SERVICE_URL, MONGO_HOST
│   │   ├── secret.yaml                     # MONGO_URI
│   │   ├── deployment.yaml                 # 2 replicas
│   │   ├── service.yaml                    # ClusterIP :3003
│   │   └── networkpolicy.yaml             # frontend → :3003, egress → auth+product+mongo+DNS
│   │
│   └── frontend/
│       ├── configmap.yaml                  # Service URLs
│       ├── secret.yaml                     # Placeholder
│       ├── deployment.yaml                 # 2 replicas, nginx
│       ├── service.yaml                    # ClusterIP :80
│       └── networkpolicy.yaml             # ingress-nginx → :80, egress → backends+DNS
│
└── network/
    ├── default-deny.yaml                   # Deny ALL ingress+egress (applied first)
    └── allow-internal.yaml                 # DNS egress + MongoDB ingress whitelists
```

---

## Pre-flight Checklist

### 1. NFS Server IP
Edit `k8s/storage/nfs-pv.yaml` and replace the placeholder:
```yaml
nfs:
  server: 10.0.0.10      # ← your NFS server IP
  path: /exports/mongodb
```

### 2. Container Images
Replace `your-registry/...` in each `deployment.yaml`:
| File | Image placeholder |
|------|-------------------|
| `services/auth-service/deployment.yaml` | `your-registry/auth-service:latest` |
| `services/product-service/deployment.yaml` | `your-registry/product-service:latest` |
| `services/order-service/deployment.yaml` | `your-registry/order-service:latest` |
| `services/frontend/deployment.yaml` | `your-registry/frontend:latest` |

### 3. Domain
Edit `k8s/ingress.yaml`:
```yaml
- host: shopmesh.example.com   # ← your actual domain
```

### 4. Secrets (Production)
**Never commit real secrets to git.** Re-generate base64 values before deploying to production:
```bash
echo -n 'your-real-password' | base64
```
Then update `k8s/mongodb/secret.yaml` and each service's `secret.yaml`.

---

## Deploy — Full Cluster

```bash
# 1. Install Nginx Ingress Controller (if not already present)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/cloud/deploy.yaml

# 2. Apply in dependency order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/storage/
kubectl apply -f k8s/network/
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/services/auth-service/
kubectl apply -f k8s/services/product-service/
kubectl apply -f k8s/services/order-service/
kubectl apply -f k8s/services/frontend/
kubectl apply -f k8s/ingress.yaml

# 3. Or apply everything at once (order is handled by Kubernetes)
kubectl apply -f k8s/
```

---

## Deploy — Minikube Quick Start

```bash
# Enable ingress addon
minikube addons enable ingress

# Apply all manifests
kubectl apply -f k8s/

# Get Minikube IP
minikube ip
# → e.g. 192.168.49.2

# Add to hosts file (Windows: C:\Windows\System32\drivers\etc\hosts)
# 192.168.49.2  shopmesh.example.com

# Open in browser
minikube service -n shopmesh frontend --url
```

---

## Network Policy Traffic Matrix

| Source | Destination | Port | Allowed? |
|--------|-------------|------|----------|
| ingress-nginx | frontend | 80 | ✅ |
| ingress-nginx | auth-service | 3001 | ✅ |
| ingress-nginx | product-service | 3002 | ✅ |
| ingress-nginx | order-service | 3003 | ✅ |
| frontend | auth-service | 3001 | ✅ |
| frontend | product-service | 3002 | ✅ |
| frontend | order-service | 3003 | ✅ |
| auth-service | mongodb | 27017 | ✅ |
| product-service | auth-service | 3001 | ✅ |
| product-service | mongodb | 27017 | ✅ |
| order-service | auth-service | 3001 | ✅ |
| order-service | product-service | 3002 | ✅ |
| order-service | mongodb | 27017 | ✅ |
| Any pod | kube-dns | 53 | ✅ |
| **Everything else** | **—** | **any** | ❌ **BLOCKED** |

---

## Resource Summary

| Workload | Replicas | CPU Request | CPU Limit | Memory Request | Memory Limit |
|----------|----------|-------------|-----------|----------------|--------------|
| mongodb (StatefulSet) | 1 | 250m | 1000m | 256Mi | 1Gi |
| auth-service | 2 | 100m | 500m | 128Mi | 512Mi |
| product-service | 2 | 100m | 500m | 128Mi | 512Mi |
| order-service | 2 | 100m | 500m | 128Mi | 512Mi |
| frontend | 2 | 50m | 200m | 64Mi | 256Mi |

---

## Useful Commands

```bash
# Watch all resources come up
kubectl get all -n shopmesh -w

# Check MongoDB is running
kubectl exec -it -n shopmesh mongodb-0 -- mongosh --eval "db.adminCommand('ping')"

# View logs
kubectl logs -n shopmesh -l app.kubernetes.io/name=auth-service --tail=50
kubectl logs -n shopmesh -l app.kubernetes.io/name=product-service --tail=50
kubectl logs -n shopmesh -l app.kubernetes.io/name=order-service --tail=50

# Describe ingress
kubectl describe ingress -n shopmesh shopmesh-ingress

# Check network policies
kubectl get networkpolicies -n shopmesh
```
