# GPU Thermal Throttle Monitor — VS Code Extension

A VS Code extension that monitors a remote GPU's temperature and power draw in real time, alerting you when thermal throttling is detected.

## Prerequisites

This extension requires the **GPU monitoring server** to be running on the machine with the GPU. The server exposes GPU metrics over HTTP that this extension polls.

### Installing the Server on the Target Machine

1. Download or clone the [gpu-metrics-webserver](https://github.com/MatthewKhouzam/gpu-metrics-webserver) repository on the GPU machine.

2. Run the install script as root:

   ```bash
   sudo ./install.sh
   ```

   This will:
   - Copy `server.py` to `/opt/gpu-monitor/`
   - Install Python dependencies (`uvicorn`, `fastapi`, `xmltodict`)
   - Install and enable a systemd service that starts on boot

3. Verify the server is running:

   ```bash
   curl http://localhost:8000/gpu
   ```

4. Ensure port 8000 is accessible from your development machine:

   ```bash
   sudo ufw allow 8000/tcp
   ```

> **Note:** The server supports NVIDIA, AMD, and Intel GPUs. It requires Python 3.8+ on the target machine.

## Installing the Extension

Install from a `.vsix` file:

```bash
code --install-extension gpu-thermal-monitor-0.2.0.vsix
```

Or for Theia-based IDEs:

```bash
theia --install-extension gpu-thermal-monitor-0.2.0.vsix
```

## How It Works

The extension polls the GPU server and uses a state machine to detect thermal throttling:

1. **NORMAL → HOT**: Temperature hits the threshold while power is high (GPU under full load at thermal limit)
2. **HOT → THROTTLING**: Power draw drops while temperature stays high and utilization remains at 100% (GPU is clock-throttling to shed heat)
3. **Recovery**: Temperature drops below the threshold minus 3°C hysteresis

### Status Bar

Real-time GPU stats appear in the VS Code status bar:

- 🟢 `✓ GPU: 65°C | 320W | 98%` — Normal
- 🟡 `⚠ GPU: 87°C | 350W | 100%` — Hot
- 🔴 `🔥 GPU: 89°C | 280W | 100%` — Throttling

### Notifications

- **Warning** (HOT): "GPU temperature has reached 87°C at 350W — near thermal limit"
- **Error** (THROTTLING): "GPU appears to be thermally throttling — power dropped from 350W to 280W while utilization remains at 100%. Performance is degraded."

Notifications have a configurable cooldown (default: 60s) to avoid spam.

## Configuration

Open VS Code Settings and search for "GPU Monitor":

| Setting | Default | Description |
|---------|---------|-------------|
| `gpuMonitor.serverUrl` | `http://localhost:8000` | URL of the GPU monitoring server |
| `gpuMonitor.pollIntervalMs` | `2000` | Polling interval in ms |
| `gpuMonitor.temperatureThreshold` | `87` | Temperature (°C) to trigger alerts |
| `gpuMonitor.powerHighThreshold` | `300` | Power (W) considered "high" at full load |
| `gpuMonitor.powerDropPercent` | `15` | % power drop that indicates throttling |
| `gpuMonitor.gpuIndex` | `0` | Which GPU to monitor (0-indexed) |
| `gpuMonitor.notificationCooldownMs` | `60000` | Minimum time between repeated alerts |

### Example: Monitoring a Remote Machine

Set `gpuMonitor.serverUrl` to the IP of your GPU machine:

```json
{
  "gpuMonitor.serverUrl": "http://192.168.1.50:8000"
}
```

## Commands

Open the Command Palette (`Ctrl+Shift+P`) and search for:

| Command | Description |
|---------|-------------|
| `GPU Monitor: Start Monitoring` | Begin polling the server |
| `GPU Monitor: Stop Monitoring` | Stop polling |
| `GPU Monitor: Show GPU Status` | Display current connection and throttle state |

The extension auto-starts monitoring on activation. Use the stop command if you want to pause it.

## Building from Source

```bash
cd vscode-extension
npm install
npm run compile
npm run package
```

This produces a `.vsix` file you can install or distribute.

## License

MIT — see [LICENSE](LICENSE).
