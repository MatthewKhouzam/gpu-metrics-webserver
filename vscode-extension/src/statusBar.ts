import * as vscode from "vscode";
import { GPUMetrics, ThrottleState } from "./types";

/**
 * Manages the status bar item that shows GPU metrics at a glance.
 * Color-coded: green (normal), yellow (hot), red (throttling).
 */
export class StatusBarManager {
    private item: vscode.StatusBarItem;

    constructor() {
        this.item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.item.command = "gpuMonitor.showStatus";
        this.item.name = "GPU Monitor";
        this.setDisconnected();
    }

    show(): void {
        this.item.show();
    }

    hide(): void {
        this.item.hide();
    }

    dispose(): void {
        this.item.dispose();
    }

    setDisconnected(): void {
        this.item.text = "$(debug-disconnect) GPU: Offline";
        this.item.backgroundColor = undefined;
        this.item.tooltip = "GPU Monitor — not connected to server";
    }

    setConnecting(): void {
        this.item.text = "$(sync~spin) GPU: Connecting...";
        this.item.backgroundColor = undefined;
        this.item.tooltip = "GPU Monitor — connecting to server";
    }

    update(metrics: GPUMetrics, state: ThrottleState): void {
        const temp = metrics.temperature_c !== null ? `${metrics.temperature_c}°C` : "N/A";
        const power = metrics.power_draw_w !== null ? `${metrics.power_draw_w.toFixed(0)}W` : "N/A";
        const util = metrics.utilization_gpu_pct !== null ? `${metrics.utilization_gpu_pct.toFixed(0)}%` : "N/A";

        let icon: string;
        let bg: vscode.ThemeColor | undefined;

        switch (state) {
            case ThrottleState.NORMAL:
                icon = "$(check)";
                bg = undefined;
                break;
            case ThrottleState.HOT:
                icon = "$(warning)";
                bg = new vscode.ThemeColor("statusBarItem.warningBackground");
                break;
            case ThrottleState.THROTTLING:
                icon = "$(flame)";
                bg = new vscode.ThemeColor("statusBarItem.errorBackground");
                break;
        }

        this.item.text = `${icon} GPU: ${temp} | ${power} | ${util}`;
        this.item.backgroundColor = bg;
        this.item.tooltip = new vscode.MarkdownString(
            `**GPU Monitor** — ${metrics.name}\n\n` +
            `| Metric | Value |\n|--------|-------|\n` +
            `| Temperature | ${temp} |\n` +
            `| Power Draw | ${power} |\n` +
            `| Utilization | ${util} |\n` +
            `| Memory | ${metrics.memory_used_mb !== null && metrics.memory_total_mb !== null ? `${metrics.memory_used_mb.toFixed(0)}/${metrics.memory_total_mb.toFixed(0)} MB` : "N/A"} |\n` +
            `| State | ${state.toUpperCase()} |`
        );
    }
}
