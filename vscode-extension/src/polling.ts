import * as http from "http";
import * as https from "https";
import { EventEmitter } from "events";
import { GPUMetrics, MonitorConfig } from "./types";

export interface GpuPollEvent {
    metrics: GPUMetrics;
    timestamp: number;
}

/**
 * Polls the remote GPU monitoring server at a configured interval
 * and emits metric events for the target GPU.
 */
export class GpuPollingService extends EventEmitter {
    private timer: NodeJS.Timeout | null = null;
    private config: MonitorConfig;
    private connected: boolean = false;

    constructor(config: MonitorConfig) {
        super();
        this.config = config;
    }

    start(): void {
        if (this.timer) {
            return;
        }
        this.poll(); // Immediately poll once
        this.timer = setInterval(() => this.poll(), this.config.pollIntervalMs);
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.connected = false;
        this.emit("disconnected");
    }

    isConnected(): boolean {
        return this.connected;
    }

    updateConfig(config: MonitorConfig): void {
        this.config = config;
        // Restart with new interval if running
        if (this.timer) {
            this.stop();
            this.start();
        }
    }

    private async poll(): Promise<void> {
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

            const event: GpuPollEvent = {
                metrics: gpu,
                timestamp: Date.now(),
            };
            this.emit("metrics", event);
        } catch (err) {
            if (this.connected) {
                this.connected = false;
                this.emit("disconnected");
            }
            this.emit("error", err);
        }
    }

    private fetchMetrics(): Promise<GPUMetrics[]> {
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
                        const parsed = JSON.parse(body) as GPUMetrics[];
                        resolve(parsed);
                    } catch (e) {
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
