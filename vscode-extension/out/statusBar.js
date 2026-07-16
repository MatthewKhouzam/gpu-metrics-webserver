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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Manages the status bar item that shows GPU metrics at a glance.
 * Color-coded: green (normal), yellow (hot), red (throttling).
 */
class StatusBarManager {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = "gpuMonitor.showStatus";
        this.item.name = "GPU Monitor";
        this.setDisconnected();
    }
    show() {
        this.item.show();
    }
    hide() {
        this.item.hide();
    }
    dispose() {
        this.item.dispose();
    }
    setDisconnected() {
        this.item.text = "$(debug-disconnect) GPU: Offline";
        this.item.backgroundColor = undefined;
        this.item.tooltip = "GPU Monitor — not connected to server";
    }
    setConnecting() {
        this.item.text = "$(sync~spin) GPU: Connecting...";
        this.item.backgroundColor = undefined;
        this.item.tooltip = "GPU Monitor — connecting to server";
    }
    update(metrics, state) {
        const temp = metrics.temperature_c !== null ? `${metrics.temperature_c}°C` : "N/A";
        const power = metrics.power_draw_w !== null ? `${metrics.power_draw_w.toFixed(0)}W` : "N/A";
        const util = metrics.utilization_gpu_pct !== null ? `${metrics.utilization_gpu_pct.toFixed(0)}%` : "N/A";
        let icon;
        let bg;
        switch (state) {
            case types_1.ThrottleState.NORMAL:
                icon = "$(check)";
                bg = undefined;
                break;
            case types_1.ThrottleState.HOT:
                icon = "$(warning)";
                bg = new vscode.ThemeColor("statusBarItem.warningBackground");
                break;
            case types_1.ThrottleState.THROTTLING:
                icon = "$(flame)";
                bg = new vscode.ThemeColor("statusBarItem.errorBackground");
                break;
        }
        this.item.text = `${icon} GPU: ${temp} | ${power} | ${util}`;
        this.item.backgroundColor = bg;
        this.item.tooltip = new vscode.MarkdownString(`**GPU Monitor** — ${metrics.name}\n\n` +
            `| Metric | Value |\n|--------|-------|\n` +
            `| Temperature | ${temp} |\n` +
            `| Power Draw | ${power} |\n` +
            `| Utilization | ${util} |\n` +
            `| Memory | ${metrics.memory_used_mb !== null && metrics.memory_total_mb !== null ? `${metrics.memory_used_mb.toFixed(0)}/${metrics.memory_total_mb.toFixed(0)} MB` : "N/A"} |\n` +
            `| State | ${state.toUpperCase()} |`);
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map