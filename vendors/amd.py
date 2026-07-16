"""AMD GPU parser using amdgpu sysfs interface."""

import os
from typing import List

from .schema import GPUMetrics
from ._common import (
    find_drm_cards_by_driver,
    read_hwmon_temperature,
    read_hwmon_power,
    read_sysfs,
    read_sysfs_int,
)


def get_gpus() -> List[GPUMetrics]:
    """Discover AMD GPUs via sysfs and read their metrics."""
    gpus = []
    cards = find_drm_cards_by_driver(["amdgpu"])

    for idx, (_card_path, device_path) in enumerate(cards):
        # Name
        name = read_sysfs(os.path.join(device_path, "product_name")) or "AMD Radeon GPU"

        # Temperature (hwmon temp1_input, millidegrees C)
        temp = read_hwmon_temperature(device_path)

        # Power (hwmon power1_average, microwatts)
        power = read_hwmon_power(device_path)

        # VRAM
        vram_total_bytes = read_sysfs_int(os.path.join(device_path, "mem_info_vram_total"))
        vram_used_bytes = read_sysfs_int(os.path.join(device_path, "mem_info_vram_used"))
        vram_total = vram_total_bytes / (1024 * 1024) if vram_total_bytes is not None else None
        vram_used = vram_used_bytes / (1024 * 1024) if vram_used_bytes is not None else None

        # GPU Utilization
        util = read_sysfs_int(os.path.join(device_path, "gpu_busy_percent"))

        gpus.append(GPUMetrics(
            vendor="amd",
            index=idx,
            name=name,
            temperature_c=temp,
            utilization_gpu_pct=util,
            memory_used_mb=vram_used,
            memory_total_mb=vram_total,
            power_draw_w=power,
        ))

    return gpus
