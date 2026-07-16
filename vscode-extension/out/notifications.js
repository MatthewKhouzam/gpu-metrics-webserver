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
exports.NotificationManager = void 0;
const vscode = __importStar(require("vscode"));
const types_1 = require("./types");
/**
 * Manages VSCode notifications with per-state cooldown to avoid spam.
 */
class NotificationManager {
    constructor(cooldownMs) {
        this.lastNotificationTime = new Map();
        this.cooldownMs = cooldownMs;
    }
    updateCooldown(cooldownMs) {
        this.cooldownMs = cooldownMs;
    }
    /**
     * Fire a notification for a throttle state change, respecting cooldown.
     */
    notify(event) {
        const now = Date.now();
        const lastTime = this.lastNotificationTime.get(event.state) ?? 0;
        // Don't notify on recovery to NORMAL (no spam needed)
        // but do reset cooldown trackers
        if (event.state === types_1.ThrottleState.NORMAL) {
            this.lastNotificationTime.clear();
            return;
        }
        // Cooldown check
        if (now - lastTime < this.cooldownMs) {
            return;
        }
        this.lastNotificationTime.set(event.state, now);
        switch (event.state) {
            case types_1.ThrottleState.HOT:
                vscode.window.showWarningMessage(event.message, "Open Settings", "Dismiss").then((action) => {
                    if (action === "Open Settings") {
                        vscode.commands.executeCommand("workbench.action.openSettings", "gpuMonitor");
                    }
                });
                break;
            case types_1.ThrottleState.THROTTLING:
                vscode.window.showErrorMessage(event.message, "Open Settings", "Dismiss").then((action) => {
                    if (action === "Open Settings") {
                        vscode.commands.executeCommand("workbench.action.openSettings", "gpuMonitor");
                    }
                });
                break;
        }
    }
}
exports.NotificationManager = NotificationManager;
//# sourceMappingURL=notifications.js.map