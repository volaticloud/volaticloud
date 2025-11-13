#!/bin/bash
# Setup GitHub Secrets for VKE Deployment
# This script helps you configure all required GitHub secrets

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "🔐 GitHub Secrets Setup for AnyTrade"
echo "===================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Install it from: https://cli.github.com/"
    echo ""
    echo "   Or use manual setup: see deployments/GITHUB_SECRETS_SETUP.md"
    exit 1
fi

# Check if logged in to gh
if ! gh auth status &> /dev/null; then
    echo "⚠️  Not logged in to GitHub CLI"
    echo "   Running: gh auth login"
    echo ""
    gh auth login
fi

echo "✅ GitHub CLI is ready"
echo ""

# Function to read secret value
read_secret() {
    local prompt="$1"
    local value=""

    echo -n "$prompt: "
    read -s value
    echo ""
    echo "$value"
}

# 1. VKE Kubeconfig
echo "📝 Step 1: VKE Kubeconfig"
echo "-------------------------"
echo "Please download your VKE kubeconfig from Vultr dashboard"
echo "Default location: ~/Downloads/vke-*-kubeconfig.yaml"
echo ""
echo -n "Enter path to your kubeconfig file: "
read KUBECONFIG_PATH

# Expand ~ to home directory
KUBECONFIG_PATH="${KUBECONFIG_PATH/#\~/$HOME}"

if [ ! -f "$KUBECONFIG_PATH" ]; then
    echo "❌ File not found: $KUBECONFIG_PATH"
    exit 1
fi

# Test kubeconfig
echo "Testing kubeconfig..."
if kubectl --kubeconfig="$KUBECONFIG_PATH" cluster-info &> /dev/null; then
    echo "✅ Kubeconfig is valid"
else
    echo "❌ Kubeconfig test failed. Please check the file."
    exit 1
fi

# Encode kubeconfig
echo "Encoding kubeconfig..."
ENCODED_KUBECONFIG=$(cat "$KUBECONFIG_PATH" | base64)
echo "$ENCODED_KUBECONFIG" | gh secret set VKE_KUBECONFIG
echo "✅ VKE_KUBECONFIG set"
echo ""

# 2. PostgreSQL Configuration
echo "📝 Step 2: PostgreSQL Configuration"
echo "-----------------------------------"
echo "Enter your Vultr managed PostgreSQL details:"
echo ""

echo -n "PostgreSQL Host (e.g., postgres-abc123.vultr.com): "
read DB_HOST

echo -n "PostgreSQL Port (default: 16751): "
read DB_PORT
DB_PORT=${DB_PORT:-16751}

echo -n "Database Username (default: keycloak): "
read DB_USERNAME
DB_USERNAME=${DB_USERNAME:-keycloak}

echo -n "Database Password: "
read -s DB_PASSWORD
echo ""

# Set database secrets
echo "${DB_HOST}:${DB_PORT}" | gh secret set KEYCLOAK_DB_HOST
echo "✅ KEYCLOAK_DB_HOST set"

echo "$DB_USERNAME" | gh secret set KEYCLOAK_DB_USERNAME
echo "✅ KEYCLOAK_DB_USERNAME set"

echo "$DB_PASSWORD" | gh secret set KEYCLOAK_DB_PASSWORD
echo "✅ KEYCLOAK_DB_PASSWORD set"
echo ""

# Test database connection
echo "Testing database connection..."
if command -v psql &> /dev/null; then
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c '\l' &> /dev/null; then
        echo "✅ Database connection successful"

        # Check if keycloak database exists
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -lqt | cut -d \| -f 1 | grep -qw keycloak; then
            echo "✅ Keycloak database exists"
        else
            echo "⚠️  Keycloak database does not exist"
            echo "   Creating keycloak database..."
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "CREATE DATABASE keycloak;" || echo "Failed to create database (might already exist or need permissions)"
        fi
    else
        echo "⚠️  Could not connect to database. Please verify credentials."
    fi
else
    echo "ℹ️  psql not installed, skipping database test"
fi
echo ""

# 3. Hostname Configuration
echo "📝 Step 3: Hostname Configuration"
echo "---------------------------------"
echo "Enter your public domain names:"
echo ""

echo -n "Keycloak Hostname (e.g., auth.anytrade.com): "
read KEYCLOAK_HOSTNAME

echo -n "AnyTrade Application URL (e.g., https://anytrade.com): "
read ANYTRADE_URL

# Set hostname secrets
echo "$KEYCLOAK_HOSTNAME" | gh secret set KEYCLOAK_HOSTNAME
echo "✅ KEYCLOAK_HOSTNAME set"

echo "$ANYTRADE_URL" | gh secret set ANYTRADE_URL
echo "✅ ANYTRADE_URL set"
echo ""

# Summary
echo "================================================"
echo "✅ All secrets configured successfully!"
echo "================================================"
echo ""
echo "📋 Configured Secrets:"
gh secret list
echo ""

echo "🚀 Next Steps:"
echo "-------------"
echo "1. Commit and push your deployment files:"
echo "   git add deployments/ .github/workflows/"
echo "   git commit -m 'feat(k8s): add Keycloak deployment'"
echo "   git push origin $(git branch --show-current)"
echo ""
echo "2. Monitor deployment:"
echo "   gh run watch"
echo ""
echo "3. Verify Keycloak:"
echo "   kubectl --kubeconfig='$KUBECONFIG_PATH' get pods -n keycloak"
echo ""
echo "4. Access Keycloak admin console:"
echo "   https://$KEYCLOAK_HOSTNAME/auth/admin"
echo ""

# Offer to create test workflow
echo -n "Would you like to test the connection now? (y/n): "
read TEST_NOW

if [ "$TEST_NOW" = "y" ] || [ "$TEST_NOW" = "Y" ]; then
    echo ""
    echo "Creating test workflow..."

    cat > .github/workflows/test-vke-connection.yaml << 'EOF'
name: Test VKE Connection

on:
  workflow_dispatch:

jobs:
  test-connection:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install kubectl
        uses: azure/setup-kubectl@v4

      - name: Test kubeconfig
        run: |
          echo "Testing kubeconfig..."
          echo "${{ secrets.VKE_KUBECONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=./kubeconfig

          echo "Cluster info:"
          kubectl cluster-info

          echo ""
          echo "Nodes:"
          kubectl get nodes

          echo ""
          echo "Namespaces:"
          kubectl get namespaces

      - name: Test secrets
        run: |
          echo "✅ All secrets are accessible:"
          echo "  - KEYCLOAK_DB_HOST: ${{ secrets.KEYCLOAK_DB_HOST }}"
          echo "  - KEYCLOAK_DB_USERNAME: ${{ secrets.KEYCLOAK_DB_USERNAME }}"
          echo "  - KEYCLOAK_HOSTNAME: ${{ secrets.KEYCLOAK_HOSTNAME }}"
          echo "  - ANYTRADE_URL: ${{ secrets.ANYTRADE_URL }}"
          echo "  - DB password: [MASKED]"
EOF

    git add .github/workflows/test-vke-connection.yaml
    git commit -m "test: add VKE connection test workflow" || true
    git push || true

    echo ""
    echo "Running test workflow..."
    gh workflow run test-vke-connection.yaml
    sleep 3
    gh run watch
fi

echo ""
echo "✅ Setup complete!"
