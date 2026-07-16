"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const polling_1 = require("./polling");
const throttleDetector_1 = require("./throttleDetector");
const statusBar_1 = require("./statusBar");
const notifications_1 = require("./notifications");
let pollingService = null;
let throttleDetector = null;
let statusBar = null;
let notificationManager = null;
let configListener = null;
function getConfig() {
    const cfg = vscode.workspace.getConfiguration("gpuMonitor");
    return {
        serverUrl: cfg.get("serverUrl", "http://localhost:8000"),
        pollIntervalMs: cfg.get("pollIntervalMs", 2000),
        temperatureThreshold: cfg.get("temperatureThreshold", 87),
        powerHighThreshold: cfg.get("powerHighThreshold", 300),
        powerDropPercent: cfg.get("powerDropPercent", 15),
        gpuIndex: cfg.get("gpuIndex", 0),
        notificationCooldownMs: cfg.get("notificationCooldownMs", 60000),
    };
}
function startMonitoring() {
    if (pollingService) {
        vscode.window.showInformationMessage("GPU Monitor is already running.");
        return;
    }
    const config = getConfig();
    // Initialize components
    statusBar = new statusBar_1.StatusBarManager();
    statusBar.setConnecting();
    statusBar.show();
    notificationManager = new notifications_1.NotificationManager(config.notificationCooldownMs);
    throttleDetector = new throttleDetector_1.ThrottleDetector(config);
    pollingService = new polling_1.GpuPollingService(config);
    // Wire events
    pollingService.on("metrics", (event) => {
        throttleDetector.process(event);
        statusBar.update(event.metrics, throttleDetector.getState());
    });
    pollingService.on("connected", () => {
        vscode.window.showInformationMessage("GPU Monitor: Connected to server.");
    });
    pollingService.on("disconnected", () => {
        statusBar.setDisconnected();
    });
    pollingService.on("error", (err) => {
        // Silently handle — status bar shows disconnected state
    });
    throttleDetector.on("stateChange", (event) => {
        notificationManager.notify(event);
    });
    pollingService.start();
}
function stopMonitoring() {
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
function showStatus() {
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
function activate(context) {
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("gpuMonitor.start", startMonitoring), vscode.commands.registerCommand("gpuMonitor.stop", stopMonitoring), vscode.commands.registerCommand("gpuMonitor.showStatus", showStatus));
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
exports.activate = activate;
function deactivate() {
    stopMonitoring();
    configListener?.dispose();
    configListener = null;
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map