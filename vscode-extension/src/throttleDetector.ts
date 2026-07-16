import { EventEmitter } from "events";
import { GPUMetrics, MonitorConfig, ThrottleState } from "./types";
import { GpuPollEvent } from "./polling";

export interface ThrottleEvent {
    state: ThrottleState;
    metrics: GPUMetrics;
    peakPower: number;
    message: string;
}

/**
 * Detects thermal throttling using a state machine.
 *
 * States:
 *   NORMAL → HOT: temp >= threshold AND power >= powerHighThreshold
 *   HOT → THROTTLING: temp >= threshold AND power dropped by powerDropPercent AND utilization >= 98%
 *   THROTTLING/HOT → NORMAL: temp drops below threshold - 3°C (hysteresis)
 */
export class ThrottleDetector extends EventEmitter {
    private state: ThrottleState = ThrottleState.NORMAL;
    private config: MonitorConfig;
    private peakPower: number = 0;

    private static readonly HYSTERESIS_C = 3;
    private static readonly UTILIZATION_FLOOR = 98;

    constructor(config: MonitorConfig) {
        super();
        this.config = config;
    }

    getState(): ThrottleState {
        return this.state;
    }

    getPeakPower(): number {
        return this.peakPower;
    }

    updateConfig(config: MonitorConfig): void {
        this.config = config;
    }

    reset(): void {
        this.state = ThrottleState.NORMAL;
        this.peakPower = 0;
    }

    /**
     * Process a new metrics sample and potentially transition states.
     */
    process(event: GpuPollEvent): void {
        const { metrics } = event;
        const temp = metrics.temperature_c;
        const power = metrics.power_draw_w;
        const util = metrics.utilization_gpu_pct;

        // Can't evaluate without data
        if (temp === null || power === null || util === null) {
            return;
        }

        const { temperatureThreshold, powerHighThreshold, powerDropPercent } = this.config;

        // Track peak power when GPU is loaded
        if (power >= powerHighThreshold) {
            this.peakPower = Math.max(this.peakPower, power);
        }

        // State transitions
        switch (this.state) {
            case ThrottleState.NORMAL:
                this.evaluateNormal(temp, power, util, metrics);
                break;

            case ThrottleState.HOT:
                this.evaluateHot(temp, power, util, metrics);
                break;

            case ThrottleState.THROTTLING:
                this.evaluateThrottling(temp, power, util, metrics);
                break;
        }
    }

    private evaluateNormal(temp: number, power: number, util: number, metrics: GPUMetrics): void {
        const { temperatureThreshold, powerHighThreshold } = this.config;

        if (temp >= temperatureThreshold && power >= powerHighThreshold) {
            this.state = ThrottleState.HOT;
            this.peakPower = power;
            this.emit("stateChange", {
                state: ThrottleState.HOT,
                metrics,
                peakPower: this.peakPower,
                message: `⚠️ GPU temperature has reached ${temp}°C at ${power.toFixed(0)}W — near thermal limit`,
            } as ThrottleEvent);
        }
    }

    private evaluateHot(temp: number, power: number, util: number, metrics: GPUMetrics): void {
        const { temperatureThreshold, powerDropPercent } = this.config;

        // Check for recovery
        if (temp < temperatureThreshold - ThrottleDetector.HYSTERESIS_C) {
            this.state = ThrottleState.NORMAL;
            this.peakPower = 0;
            this.emit("stateChange", {
                state: ThrottleState.NORMAL,
                metrics,
                peakPower: 0,
                message: `✅ GPU temperature recovered to ${temp}°C`,
            } as ThrottleEvent);
            return;
        }

        // Check for throttling: power dropped while temp high and utilization maxed
        const dropThreshold = this.peakPower * (1 - powerDropPercent / 100);
        if (
            temp >= temperatureThreshold &&
            power < dropThreshold &&
            util >= ThrottleDetector.UTILIZATION_FLOOR
        ) {
            this.state = ThrottleState.THROTTLING;
            this.emit("stateChange", {
                state: ThrottleState.THROTTLING,
                metrics,
                peakPower: this.peakPower,
                message: `🔥 GPU appears to be thermally throttling — power dropped from ${this.peakPower.toFixed(0)}W to ${power.toFixed(0)}W while utilization remains at ${util.toFixed(0)}%. Performance is degraded.`,
            } as ThrottleEvent);
        }
    }

    private evaluateThrottling(temp: number, power: number, util: number, metrics: GPUMetrics): void {
        const { temperatureThreshold } = this.config;

        // Recovery: temp drops below threshold with hysteresis
        if (temp < temperatureThreshold - ThrottleDetector.HYSTERESIS_C) {
            this.state = ThrottleState.NORMAL;
            this.peakPower = 0;
            this.emit("stateChange", {
                state: ThrottleState.NORMAL,
                metrics,
                peakPower: 0,
                message: `✅ GPU temperature recovered to ${temp}°C — throttling resolved`,
            } as ThrottleEvent);
        }
    }
}
