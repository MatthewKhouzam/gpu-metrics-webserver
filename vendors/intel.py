"""Intel GPU parser using sysfs and intel_gpu_top."""

import glob
import json
import os
import subprocess
from typing import List, Optional

from .schema import GPUMetrics
from ._common import find_drm_cards_by_driver, read_sysfs


def _read_cpu_package_temp() -> Optional[float]:
    """
    Read CPU package temperature from thermal zones.
    Integrated Intel GPUs share the CPU package thermal zone.
    """
    thermal_zones = sorted(glob.glob("/sys/class/thermal/thermal_zone*"))
    for zone in thermal_zones:
        type_path = os.path.join(zone, "type")
        temp_path = os.path.join(zone, "temp")
        zone_type = read_sysfs(type_path)
        if zone_type is None:
            continue
        zone_type_lower = zone_type.lower()
        if any(t in zone_type_lower for t in ["x86_pkg_temp", "cpu", "acpitz"]):
            raw = read_sysfs(temp_path)
            if raw is not None:
                try:
                    return float(raw) / 1000.0
                except ValueError:
                    pass
    return None


def _query_intel_gpu_top() -> dict:
    """
    Run intel_gpu_top briefly and return the parsed JSON snapshot.
    Returns an empty dict on failure.
    """
    try:
        cmd = ["timeout", "0.2s", "intel_gpu_top", "-J", "-s", "100"]
        output = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)

        clean_output = output.strip().lstrip("[").rstrip("]").strip()
        blocks = clean_output.split("\n\n")
        target_block = blocks[-1] if blocks else clean_output
        if target_block.endswith(","):
            target_block = target_block[:-1]

        return json.loads(target_block)
    except Exception:
        return {}


def get_gpus() -> List[GPUMetrics]:
    """Discover Intel GPUs via sysfs and read their metrics."""
    gpus = []
    cards = find_drm_cards_by_driver(["i915", "xe"])

    for idx, (_card_path, device_path) in enumerate(cards):
        # Name from uevent PCI_ID
        name = "Intel Graphics"
        uevent = read_sysfs(os.path.join(device_path, "uevent"))
        if uevent:
            for line in uevent.splitlines():
                if "PCI_ID" in line:
                    name = f"Intel Graphics ({line.strip()})"
                    break

        # Temperature (CPU package thermal zone)
        temp = _read_cpu_package_temp()

        # Metrics from intel_gpu_top
        util, power, mem_used, mem_total = None, None, None, None
        data = _query_intel_gpu_top()
        if data:
            # Utilization (Render/3D engine)
            engines = data.get("engines", {})
            render_engine = engines.get("Render/3D/0", {}) or engines.get("Render/3D", {})
            if render_engine:
                util = render_engine.get("busy", 0.0)

            # Power
            power_data = data.get("power", {})
            if power_data:
                power = power_data.get("value")

            # Memory (prefer local VRAM, fall back to system)
            memory_regions = data.get("memory", {})
            if memory_regions:
                region_name = "local" if "local" in memory_regions else "system"
                mem_info = memory_regions.get(region_name, {})
                if mem_info:
                    mem_used = mem_info.get("used", 0.0)
                    mem_total = mem_info.get("total", 0.0)

        gpus.append(GPUMetrics(
            vendor="intel",
            index=idx,
            name=name,
            temperature_c=temp,
            utilization_gpu_pct=util,
            memory_used_mb=mem_used,
            memory_total_mb=mem_total,
            power_draw_w=power,
        ))

    return gpus
