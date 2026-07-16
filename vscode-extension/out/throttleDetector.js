"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThrottleDetector = void 0;
const events_1 = require("events");
const types_1 = require("./types");
/**
 * Detects thermal throttling using a state machine.
 *
 * States:
 *   NORMAL → HOT: temp >= threshold AND power >= powerHighThreshold
 *   HOT → THROTTLING: temp >= threshold AND power dropped by powerDropPercent AND utilization >= 98%
 *   THROTTLING/HOT → NORMAL: temp drops below threshold - 3°C (hysteresis)
 */
class ThrottleDetector extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.state = types_1.ThrottleState.NORMAL;
        this.peakPower = 0;
        this.config = config;
    }
    getState() {
        return this.state;
    }
    getPeakPower() {
        return this.peakPower;
    }
    updateConfig(config) {
        this.config = config;
    }
    reset() {
        this.state = types_1.ThrottleState.NORMAL;
        this.peakPower = 0;
    }
    /**
     * Process a new metrics sample and potentially transition states.
     */
    process(event) {
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
            case types_1.ThrottleState.NORMAL:
                this.evaluateNormal(temp, power, util, metrics);
                break;
            case types_1.ThrottleState.HOT:
                this.evaluateHot(temp, power, util, metrics);
                break;
            case types_1.ThrottleState.THROTTLING:
                this.evaluateThrottling(temp, power, util, metrics);
                break;
        }
    }
    evaluateNormal(temp, power, util, metrics) {
        const { temperatureThreshold, powerHighThreshold } = this.config;
        if (temp >= temperatureThreshold && power >= powerHighThreshold) {
            this.state = types_1.ThrottleState.HOT;
            this.peakPower = power;
            this.emit("stateChange", {
                state: types_1.ThrottleState.HOT,
                metrics,
                peakPower: this.peakPower,
                message: `⚠️ GPU temperature has reached ${temp}°C at ${power.toFixed(0)}W — near thermal limit`,
            });
        }
    }
    evaluateHot(temp, power, util, metrics) {
        const { temperatureThreshold, powerDropPercent } = this.config;
        // Check for recovery
        if (temp < temperatureThreshold - ThrottleDetector.HYSTERESIS_C) {
            this.state = types_1.ThrottleState.NORMAL;
            this.peakPower = 0;
            this.emit("stateChange", {
                state: types_1.ThrottleState.NORMAL,
                metrics,
                peakPower: 0,
                message: `✅ GPU temperature recovered to ${temp}°C`,
            });
            return;
        }
        // Check for throttling: power dropped while temp high and utilization maxed
        const dropThreshold = this.peakPower * (1 - powerDropPercent / 100);
        if (temp >= temperatureThreshold &&
            power < dropThreshold &&
            util >= ThrottleDetector.UTILIZATION_FLOOR) {
            this.state = types_1.ThrottleState.THROTTLING;
            this.emit("stateChange", {
                state: types_1.ThrottleState.THROTTLING,
                metrics,
                peakPower: this.peakPower,
                message: `🔥 GPU appears to be thermally throttling — power dropped from ${this.peakPower.toFixed(0)}W to ${power.toFixed(0)}W while utilization remains at ${util.toFixed(0)}%. Performance is degraded.`,
            });
        }
    }
    evaluateThrottling(temp, power, util, metrics) {
        const { temperatureThreshold } = this.config;
        // Recovery: temp drops below threshold with hysteresis
        if (temp < temperatureThreshold - ThrottleDetector.HYSTERESIS_C) {
            this.state = types_1.ThrottleState.NORMAL;
            this.peakPower = 0;
            this.emit("stateChange", {
                state: types_1.ThrottleState.NORMAL,
                metrics,
                peakPower: 0,
                message: `✅ GPU temperature recovered to ${temp}°C — throttling resolved`,
            });
        }
    }
}
exports.ThrottleDetector = ThrottleDetector;
ThrottleDetector.HYSTERESIS_C = 3;
ThrottleDetector.UTILIZATION_FLOOR = 98;
//# sourceMappingURL=throttleDetector.js.map