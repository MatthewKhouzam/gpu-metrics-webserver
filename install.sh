#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/gpu-monitor"
SERVICE_NAME="gpu-monitor.service"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "Error: This script must be run as root (use sudo)." >&2
  exit 1
fi

echo "==> Installing GPU Monitor Server to ${INSTALL_DIR}"

# Determine script directory (works even when extracted from tarball)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create install directory
mkdir -p "${INSTALL_DIR}"

# Copy server
cp "${SCRIPT_DIR}/server.py" "${INSTALL_DIR}/server.py"
chmod 644 "${INSTALL_DIR}/server.py"

# Install Python dependencies
echo "==> Installing Python dependencies"
pip3 install --quiet uvicorn fastapi xmltodict

# Install systemd service
echo "==> Installing systemd service"
cp "${SCRIPT_DIR}/deploy/gpu-monitor.service" "${SERVICE_FILE}"
chmod 644 "${SERVICE_FILE}"

# Reload and enable
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo "==> GPU Monitor Server installed and running"
echo "    Status: systemctl status ${SERVICE_NAME}"
echo "    Logs:   journalctl -u ${SERVICE_NAME} -f"
echo "    URL:    http://$(hostname -I | awk '{print $1}'):8000/gpu"
