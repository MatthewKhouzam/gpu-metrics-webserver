import * as vscode from "vscode";
import { ThrottleState } from "./types";
import { ThrottleEvent } from "./throttleDetector";

/**
 * Manages VSCode notifications with per-state cooldown to avoid spam.
 */
export class NotificationManager {
    private lastNotificationTime: Map<ThrottleState, number> = new Map();
    private cooldownMs: number;

    constructor(cooldownMs: number) {
        this.cooldownMs = cooldownMs;
    }

    updateCooldown(cooldownMs: number): void {
        this.cooldownMs = cooldownMs;
    }

    /**
     * Fire a notification for a throttle state change, respecting cooldown.
     */
    notify(event: ThrottleEvent): void {
        const now = Date.now();
        const lastTime = this.lastNotificationTime.get(event.state) ?? 0;

        // Don't notify on recovery to NORMAL (no spam needed)
        // but do reset cooldown trackers
        if (event.state === ThrottleState.NORMAL) {
            this.lastNotificationTime.clear();
            return;
        }

        // Cooldown check
        if (now - lastTime < this.cooldownMs) {
            return;
        }

        this.lastNotificationTime.set(event.state, now);

        switch (event.state) {
            case ThrottleState.HOT:
                vscode.window.showWarningMessage(
                    event.message,
                    "Open Settings",
                    "Dismiss"
                ).then((action) => {
                    if (action === "Open Settings") {
                        vscode.commands.executeCommand(
                            "workbench.action.openSettings",
                            "gpuMonitor"
                        );
                    }
                });
                break;

            case ThrottleState.THROTTLING:
                vscode.window.showErrorMessage(
                    event.message,
                    "Open Settings",
                    "Dismiss"
                ).then((action) => {
                    if (action === "Open Settings") {
                        vscode.commands.executeCommand(
                            "workbench.action.openSettings",
                            "gpuMonitor"
                        );
                    }
                });
                break;
        }
    }
}
