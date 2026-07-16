import * as vscode from "vscode";
import { MonitorConfig, ThrottleState } from "./types";
import { GpuPollingService, GpuPollEvent } from "./polling";
import { ThrottleDetector, ThrottleEvent } from "./throttleDetector";
import { StatusBarManager } from "./statusBar";
import { NotificationManager } from "./notifications";

let pollingService: GpuPollingService | null = null;
let throttleDetector: ThrottleDetector | null = null;
let statusBar: StatusBarManager | null = null;
let notificationManager: NotificationManager | null = null;
let configListener: vscode.Disposable | null = null;

function getConfig(): MonitorConfig {
    const cfg = vscode.workspace.getConfiguration("gpuMonitor");
    return {
        serverUrl: cfg.get<string>("serverUrl", "http://localhost:8000"),
        pollIntervalMs: cfg.get<number>("pollIntervalMs", 2000),
        temperatureThreshold: cfg.get<number>("temperatureThreshold", 87),
        powerHighThreshold: cfg.get<number>("powerHighThreshold", 300),
        powerDropPercent: cfg.get<number>("powerDropPercent", 15),
        gpuIndex: cfg.get<number>("gpuIndex", 0),
        notificationCooldownMs: cfg.get<number>("notificationCooldownMs", 60000),
    };
}

function startMonitoring(): void {
    if (pollingService) {
        vscode.window.showInformationMessage("GPU Monitor is already running.");
        return;
    }

    const config = getConfig();

    // Initialize components
    statusBar = new StatusBarManager();
    statusBar.setConnecting();
    statusBar.show();

    notificationManager = new NotificationManager(config.notificationCooldownMs);
    throttleDetector = new ThrottleDetector(config);
    pollingService = new GpuPollingService(config);

    // Wire events
    pollingService.on("metrics", (event: GpuPollEvent) => {
        throttleDetector!.process(event);
        statusBar!.update(event.metrics, throttleDetector!.getState());
    });

    pollingService.on("connected", () => {
        vscode.window.showInformationMessage("GPU Monitor: Connected to server.");
    });

    pollingService.on("disconnected", () => {
        statusBar!.setDisconnected();
    });

    pollingService.on("error", (err: Error) => {
        // Silently handle — status bar shows disconnected state
    });

    throttleDetector.on("stateChange", (event: ThrottleEvent) => {
        notificationManager!.notify(event);
    });

    pollingService.start();
}

function stopMonitoring(): void {
    if (!pollingService) {
        vscode.window.showInformationMessage("GPU Monitor is not running.");
        return;
    }

    pollingService.stop();
    pollingService.removeAllListeners();
    pollingService = null;

    throttleDetector?.removeAllListeners();
    throttleDetector = null;

    statusBar?.dispose();
    statusBar = null;

    notificationManager = null;

    vscode.window.showInformationMessage("GPU Monitor: Stopped.");
}

function showStatus(): void {
    if (!pollingService || !throttleDetector) {
        vscode.window.showInformationMessage("GPU Monitor is not running. Use 'GPU Monitor: Start Monitoring' to begin.");
        return;
    }

    const state = throttleDetector.getState();
    const peak = throttleDetector.getPeakPower();
    const connected = pollingService.isConnected();

    const lines = [
        `Connection: ${connected ? "Connected" : "Disconnected"}`,
        `Throttle State: ${state.toUpperCase()}`,
        `Peak Power Recorded: ${peak > 0 ? `${peak.toFixed(0)}W` : "N/A"}`,
    ];

    vscode.window.showInformationMessage(lines.join(" | "));
}

export function activate(context: vscode.ExtensionContext): void {
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand("gpuMonitor.start", startMonitoring),
        vscode.commands.registerCommand("gpuMonitor.stop", stopMonitoring),
        vscode.commands.registerCommand("gpuMonitor.showStatus", showStatus)
    );

    // Listen for config changes
    configListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("gpuMonitor")) {
            const config = getConfig();
            if (pollingService) {
                pollingService.updateConfig(config);
            }
            if (throttleDetector) {
                throttleDetector.updateConfig(config);
            }
            if (notificationManager) {
                notificationManager.updateCooldown(config.notificationCooldownMs);
            }
        }
    });
    context.subscriptions.push(configListener);

    // Auto-start monitoring on activation
    startMonitoring();
}

export function deactivate(): void {
    stopMonitoring();
    configListener?.dispose();
    configListener = null;
}
