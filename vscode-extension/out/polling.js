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
exports.GpuPollingService = void 0;
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const events_1 = require("events");
/**
 * Polls the remote GPU monitoring server at a configured interval
 * and emits metric events for the target GPU.
 */
class GpuPollingService extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.timer = null;
        this.connected = false;
        this.config = config;
    }
    start() {
        if (this.timer) {
            return;
        }
        this.poll(); // Immediately poll once
        this.timer = setInterval(() => this.poll(), this.config.pollIntervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.connected = false;
        this.emit("disconnected");
    }
    isConnected() {
        return this.connected;
    }
    updateConfig(config) {
        this.config = config;
        // Restart with new interval if running
        if (this.timer) {
            this.stop();
            this.start();
        }
    }
    async poll() {
        try {
            const data = await this.fetchMetrics();
            const gpu = data.find((g) => g.index === this.config.gpuIndex);
            if (!gpu) {
                this.emit("error", new Error(`GPU index ${this.config.gpuIndex} not found in response`));
                return;
            }
            if (!this.connected) {
                this.connected = true;
                this.emit("connected");
            }
            const event = {
                metrics: gpu,
                timestamp: Date.now(),
            };
            this.emit("metrics", event);
        }
        catch (err) {
            if (this.connected) {
                this.connected = false;
                this.emit("disconnected");
            }
            this.emit("error", err);
        }
    }
    fetchMetrics() {
        return new Promise((resolve, reject) => {
            const url = new URL("/gpu", this.config.serverUrl);
            const client = url.protocol === "https:" ? https : http;
            const req = client.get(url.toString(), { timeout: 5000 }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Server responded with status ${res.statusCode}`));
                    res.resume();
                    return;
                }
                let body = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (body += chunk));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve(parsed);
                    }
                    catch (e) {
                        reject(new Error(`Failed to parse response: ${e}`));
                    }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Request timed out"));
            });
        });
    }
}
exports.GpuPollingService = GpuPollingService;
//# sourceMappingURL=polling.js.map