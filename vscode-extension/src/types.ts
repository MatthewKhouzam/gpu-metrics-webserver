/**
 * Mirrors the GPUMetrics schema from the server's API response.
 */
export interface GPUMetrics {
    vendor: string;
    index: number;
    name: string;
    temperature_c: number | null;
    utilization_gpu_pct: number | null;
    memory_used_mb: number | null;
    memory_total_mb: number | null;
    power_draw_w: number | null;
}

/**
 * Extension configuration from VS Code settings.
 */
export interface MonitorConfig {
    serverUrl: string;
    pollIntervalMs: number;
    temperatureThreshold: number;
    powerHighThreshold: number;
    powerDropPercent: number;
    gpuIndex: number;
    notificationCooldownMs: number;
}

/**
 * Throttle detection states.
 */
export enum ThrottleState {
    NORMAL = "normal",
    HOT = "hot",
    THROTTLING = "throttling",
}
