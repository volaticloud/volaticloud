#!/bin/bash
#
# Self-Hosted GitHub Actions Runner Setup Script
# Installs all dependencies required for volaticloud CI/CD workflows
#
# Usage:
#   sudo ./setup.sh [--skip-docker] [--skip-go] [--skip-node]
#
# Supported OS: Ubuntu 22.04+, Debian 11+
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GO_VERSION="1.24.3"
NODE_VERSION="22"
KUBECTL_VERSION="stable"
GOLANGCI_LINT_VERSION="v2.7.2"

# Parse arguments
SKIP_DOCKER=false
SKIP_GO=false
SKIP_NODE=false

for arg in "$@"; do
    case $arg in
        --skip-docker) SKIP_DOCKER=true ;;
        --skip-go) SKIP_GO=true ;;
        --skip-node) SKIP_NODE=true ;;
        --help)
            echo "Usage: sudo ./setup.sh [--skip-docker] [--skip-go] [--skip-node]"
            exit 0
            ;;
    esac
done

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        *)
            log_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    log_info "Detected architecture: $ARCH"
}

install_system_packages() {
    log_info "Installing system packages..."
    apt-get update
    apt-get install -y \
        build-essential \
        curl \
        wget \
        git \
        jq \
        unzip \
        bc \
        gettext \
        gnupg \
        lsb-release \
        ca-certificates \
        apt-transport-https \
        software-properties-common \
        python3 \
        python3-pip \
        python3-venv
    log_success "System packages installed"
}

install_docker() {
    if [[ "$SKIP_DOCKER" == true ]]; then
        log_warn "Skipping Docker installation"
        return
    fi

    if command -v docker &> /dev/null; then
        log_info "Docker already installed: $(docker --version)"
        return
    fi

    log_info "Installing Docker..."

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Enable and start Docker
    systemctl enable docker
    systemctl start docker

    log_success "Docker installed: $(docker --version)"
}

install_go() {
    if [[ "$SKIP_GO" == true ]]; then
        log_warn "Skipping Go installation"
        return
    fi

    log_info "Installing Go ${GO_VERSION}..."

    # Remove existing Go installation
    rm -rf /usr/local/go

    # Download and install Go
    curl -fsSL "https://golang.org/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz" | tar -C /usr/local -xzf -

    # Create symlinks
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
    ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt

    log_success "Go installed: $(go version)"
}

install_node() {
    if [[ "$SKIP_NODE" == true ]]; then
        log_warn "Skipping Node.js installation"
        return
    fi

    log_info "Installing Node.js ${NODE_VERSION}..."

    # Install Node.js via NodeSource
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y nodejs

    log_success "Node.js installed: $(node --version)"
    log_success "npm installed: $(npm --version)"
}

install_kubectl() {
    if command -v kubectl &> /dev/null; then
        log_info "kubectl already installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
        return
    fi

    log_info "Installing kubectl..."

    # Get latest stable version
    KUBECTL_RELEASE=$(curl -L -s https://dl.k8s.io/release/stable.txt)

    curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_RELEASE}/bin/linux/${ARCH}/kubectl"
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    rm -f kubectl

    log_success "kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
}

install_helm() {
    if command -v helm &> /dev/null; then
        log_info "Helm already installed: $(helm version --short)"
        return
    fi

    log_info "Installing Helm..."
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

    log_success "Helm installed: $(helm version --short)"
}

install_go_tools() {
    if [[ "$SKIP_GO" == true ]]; then
        log_warn "Skipping Go tools installation (Go not installed)"
        return
    fi

    log_info "Installing Go tools..."

    export PATH=$PATH:/usr/local/go/bin
    export GOPATH=/opt/go
    export GOBIN=/usr/local/bin
    mkdir -p $GOPATH

    # golangci-lint
    log_info "Installing golangci-lint ${GOLANGCI_LINT_VERSION}..."
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh | \
        sh -s -- -b /usr/local/bin ${GOLANGCI_LINT_VERSION}

    # govulncheck
    log_info "Installing govulncheck..."
    go install golang.org/x/vuln/cmd/govulncheck@latest

    # staticcheck
    log_info "Installing staticcheck..."
    go install honnef.co/go/tools/cmd/staticcheck@latest

    # gosec
    log_info "Installing gosec..."
    go install github.com/securego/gosec/v2/cmd/gosec@latest

    log_success "Go tools installed"
}

install_python_tools() {
    log_info "Installing Python tools..."

    # Install pipx for isolated Python app installation (PEP 668 compliant)
    apt-get install -y pipx

    # Ensure pipx path is available
    export PATH="$PATH:/root/.local/bin"

    # Install semgrep via pipx (isolated environment)
    pipx install semgrep --force || log_warn "semgrep installation failed (optional)"

    # PyYAML is usually available system-wide, install if missing
    apt-get install -y python3-yaml || true

    # Create symlink for semgrep if installed to user location
    if [[ -f /root/.local/bin/semgrep ]]; then
        ln -sf /root/.local/bin/semgrep /usr/local/bin/semgrep
    fi

    log_success "Python tools installed"
}

install_npm_tools() {
    if [[ "$SKIP_NODE" == true ]]; then
        log_warn "Skipping npm tools installation (Node.js not installed)"
        return
    fi

    log_info "Installing npm global tools..."
    npm install -g markdownlint-cli2 markdown-link-check

    log_success "npm tools installed"
}

install_trivy() {
    if command -v trivy &> /dev/null; then
        log_info "Trivy already installed: $(trivy --version)"
        return
    fi

    log_info "Installing Trivy..."

    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor -o /usr/share/keyrings/trivy.gpg
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | \
        tee /etc/apt/sources.list.d/trivy.list
    apt-get update
    apt-get install -y trivy

    log_success "Trivy installed: $(trivy --version)"
}

setup_runner_user() {
    RUNNER_USER="${SUDO_USER:-runner}"

    if id "$RUNNER_USER" &>/dev/null; then
        log_info "Adding $RUNNER_USER to docker group..."
        usermod -aG docker "$RUNNER_USER"
        log_success "User $RUNNER_USER added to docker group"
    fi
}

create_env_file() {
    log_info "Creating environment file..."

    cat > /etc/profile.d/github-runner.sh << 'EOF'
# GitHub Actions Runner Environment
export PATH=$PATH:/usr/local/go/bin
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin
EOF

    chmod +x /etc/profile.d/github-runner.sh
    log_success "Environment file created at /etc/profile.d/github-runner.sh"
}

verify_installation() {
    log_info "Verifying installations..."
    echo ""
    echo "=== Installed Versions ==="
    echo ""

    command -v git &>/dev/null && echo "git:            $(git --version | cut -d' ' -f3)"
    command -v docker &>/dev/null && echo "docker:         $(docker --version | cut -d' ' -f3 | tr -d ',')"
    command -v go &>/dev/null && echo "go:             $(go version | cut -d' ' -f3)"
    command -v node &>/dev/null && echo "node:           $(node --version)"
    command -v npm &>/dev/null && echo "npm:            $(npm --version)"
    command -v kubectl &>/dev/null && echo "kubectl:        $(kubectl version --client -o json 2>/dev/null | jq -r '.clientVersion.gitVersion' || echo 'installed')"
    command -v helm &>/dev/null && echo "helm:           $(helm version --short 2>/dev/null | cut -d'+' -f1)"
    command -v golangci-lint &>/dev/null && echo "golangci-lint:  $(golangci-lint --version 2>/dev/null | head -1 | awk '{print $2}')"
    command -v govulncheck &>/dev/null && echo "govulncheck:    installed"
    command -v staticcheck &>/dev/null && echo "staticcheck:    installed"
    command -v gosec &>/dev/null && echo "gosec:          installed"
    command -v trivy &>/dev/null && echo "trivy:          $(trivy --version 2>/dev/null | head -1 | awk '{print $2}')"
    command -v semgrep &>/dev/null && echo "semgrep:        $(semgrep --version 2>/dev/null)"
    command -v python3 &>/dev/null && echo "python3:        $(python3 --version | cut -d' ' -f2)"

    echo ""
    log_success "All installations verified"
}

main() {
    echo ""
    echo "=============================================="
    echo " GitHub Actions Self-Hosted Runner Setup"
    echo "=============================================="
    echo ""

    check_root
    detect_arch

    install_system_packages
    install_docker
    install_go
    install_node
    install_kubectl
    install_helm
    install_go_tools
    install_python_tools
    install_npm_tools
    install_trivy
    setup_runner_user
    create_env_file
    verify_installation

    echo ""
    log_success "Setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Log out and back in (or run: newgrp docker)"
    echo "  2. Install GitHub Actions runner: https://github.com/actions/runner"
    echo "  3. Set repository variable RUNNER_LABEL=self-hosted"
    echo ""
}

main "$@"