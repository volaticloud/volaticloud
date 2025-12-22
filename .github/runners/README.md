# Self-Hosted GitHub Actions Runner Setup

This directory contains scripts for setting up self-hosted GitHub Actions runners for the volaticloud project.

## Quick Start

```bash
# On your runner machine (Ubuntu 22.04+ or Debian 11+)
curl -fsSL https://raw.githubusercontent.com/volaticloud/volaticloud/main/.github/runners/setup.sh | sudo bash
```

Or clone the repo and run:

```bash
sudo ./.github/runners/setup.sh
```

## What Gets Installed

### Language Runtimes

| Tool | Version | Purpose |
|------|---------|---------|
| Go | 1.24.x | Backend builds and tests |
| Node.js | 22.x | Frontend builds and tests |
| Python | 3.x | YAML validation, Semgrep |

### Container & Kubernetes Tools

| Tool | Purpose |
|------|---------|
| Docker | Container builds |
| kubectl | Kubernetes deployments |
| Helm | Helm chart deployments |

### Go Development Tools

| Tool | Purpose |
|------|---------|
| golangci-lint v2.7.2 | Go linting |
| govulncheck | Go vulnerability scanning |
| staticcheck | Static analysis |
| gosec | Security scanning |

### Security & Quality Tools

| Tool | Purpose |
|------|---------|
| Trivy | Container image scanning |
| Semgrep | SAST analysis |
| markdownlint-cli2 | Markdown linting |
| markdown-link-check | Documentation link validation |

### System Utilities

- git, curl, wget, jq, bc, unzip
- gettext (for envsubst)
- build-essential

## Options

```bash
# Skip specific installations
sudo ./setup.sh --skip-docker    # Skip Docker (if already installed)
sudo ./setup.sh --skip-go        # Skip Go and Go tools
sudo ./setup.sh --skip-node      # Skip Node.js and npm tools
```

## Post-Installation

### 1. Add User to Docker Group

The script automatically adds the sudo user to the docker group. Log out and back in, or run:

```bash
newgrp docker
```

### 2. Install GitHub Actions Runner

Follow the official instructions to install the runner:
https://github.com/actions/runner

```bash
# Download runner (check latest version)
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.321.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.321.0.tar.gz

# Configure (get token from GitHub repo settings)
./config.sh --url https://github.com/volaticloud/volaticloud --token YOUR_TOKEN --labels self-hosted

# Install as service
sudo ./svc.sh install
sudo ./svc.sh start
```

### 3. Set Repository Variable

In GitHub repository settings:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **Variables** tab
3. Click **New repository variable**
4. Name: `RUNNER_LABEL`
5. Value: `self-hosted`

## Verification

Check installed versions:

```bash
go version
node --version
docker --version
kubectl version --client
helm version --short
golangci-lint --version
trivy --version
```

## Troubleshooting

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Go Tools Not Found

Ensure Go is in PATH:

```bash
source /etc/profile.d/github-runner.sh
```

### Runner Not Picking Up Jobs

1. Check runner status: `sudo ./svc.sh status`
2. Verify label matches `RUNNER_LABEL` variable
3. Check runner logs: `journalctl -u actions.runner.*`

## Requirements

- **OS**: Ubuntu 22.04+ or Debian 11+
- **Architecture**: x86_64 (amd64) or aarch64 (arm64)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 20GB minimum for tools + workspace
- **Network**: Outbound HTTPS access to GitHub
