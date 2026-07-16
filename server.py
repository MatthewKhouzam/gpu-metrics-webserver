import os
import re
import glob
import subprocess
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Harmonized GPU Monitoring Server")

# 1. Define the Harmonized Schema
class GPUMetrics(BaseModel):
    vendor: str          # "nvidia", "amd", or "intel"
    index: int
    name: str
    temperature_c: Optional[float] = None
    utilization_gpu_pct: Optional[float] = None
    memory_used_mb: Optional[float] = None
    memory_total_mb: Optional[float] = None
    power_draw_w: Optional[float] = None

# --- VENDOR PARSERS ---

def get_nvidia_gpus() -> List[GPUMetrics]:
    gpus = []
    try:
        # Query nvidia-smi with a clean CSV format
        cmd = [
            "nvidia-smi",
            "--query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
            "--format=csv,noheader,nounits"
        ]
        output = subprocess.check_output(cmd, text=True)
        for line in output.strip().split("\n"):
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            gpus.append(GPUMetrics(
                vendor="nvidia",
                index=int(parts[0]),
                name=parts[1],
                temperature_c=float(parts[2]) if parts[2] != "[N/A]" else None,
                utilization_gpu_pct=float(parts[3]) if parts[3] != "[N/A]" else None,
                memory_used_mb=float(parts[4]) if parts[4] != "[N/A]" else None,
                memory_total_mb=float(parts[5]) if parts[5] != "[N/A]" else None,
                power_draw_w=float(parts[6]) if parts[6] != "[N/A]" else None,
            ))
    except Exception:
        # nvidia-smi not installed or no Nvidia GPUs present
        pass
    return gpus


def get_amd_gpus() -> List[GPUMetrics]:
    gpus = []
    # Search for all AMD GPUs exposed by the modern amdgpu driver in sysfs
    cards = glob.glob("/sys/class/drm/card*")
    idx = 0
    
    for card in cards:
        # Check if it's an AMD card (driver name is 'amdgpu')
        device_link = os.path.join(card, "device")
        driver_link = os.path.join(device_link, "driver")
        if not os.path.exists(driver_link) or "amdgpu" not in os.path.realpath(driver_link):
            continue
            
        # 1. Find the name
        name = "AMD Radeon GPU"
        product_name_path = os.path.join(device_link, "product_name")
        if os.path.exists(product_name_path):
            with open(product_name_path, "r") as f:
                name = f.read().strip()
                
        # 2. Query hwmon (lm-sensors API mapped to sysfs)
        temp, power = None, None
        hwmon_dirs = glob.glob(os.path.join(device_link, "hwmon", "hwmon*"))
        if hwmon_dirs:
            hwmon_dir = hwmon_dirs[0]
            # Temperature (usually temp1_input, in millidegrees C)
            temp_path = os.path.join(hwmon_dir, "temp1_input")
            if os.path.exists(temp_path):
                with open(temp_path, "r") as f:
                    temp = float(f.read().strip()) / 1000.0
            # Power Draw (usually power1_average or power1_input, in microwatts)
            power_path = os.path.join(hwmon_dir, "power1_average")
            if os.path.exists(power_path):
                with open(power_path, "r") as f:
                    power = float(f.read().strip()) / 1000000.0

        # 3. Memory metrics (VRAM size)
        vram_total, vram_used = None, None
        total_vram_path = os.path.join(device_link, "mem_info_vram_total")
        used_vram_path = os.path.join(device_link, "mem_info_vram_used")
        if os.path.exists(total_vram_path) and os.path.exists(used_vram_path):
            with open(total_vram_path, "r") as f_tot, open(used_vram_path, "r") as f_usd:
                vram_total = float(f_tot.read().strip()) / (1024 * 1024) # Bytes to MB
                vram_used = float(f_usd.read().strip()) / (1024 * 1024)

        # 4. GPU Utilization (gpu_busy_percent)
        util = None
        busy_path = os.path.join(device_link, "gpu_busy_percent")
        if os.path.exists(busy_path):
            with open(busy_path, "r") as f:
                util = float(f.read().strip())

        gpus.append(GPUMetrics(
            vendor="amd",
            index=idx,
            name=name,
            temperature_c=temp,
            utilization_gpu_pct=util,
            memory_used_mb=vram_used,
            memory_total_mb=vram_total,
            power_draw_w=power
        ))
        idx += 1
        
    return gpus


import json

def get_intel_gpus() -> List[GPUMetrics]:
    gpus = []
    cards = glob.glob("/sys/class/drm/card*")
    idx = 0

    for card in cards:
        device_link = os.path.join(card, "device")
        driver_link = os.path.join(device_link, "driver")
        
        # Ensure it is an Intel card
        if not os.path.exists(driver_link) or not any(d in os.path.realpath(driver_link) for d in ["i915", "xe"]):
            continue

        name = "Intel Graphics"
        # Try to parse the real device name from uevent
        uevent_path = os.path.join(device_link, "uevent")
        if os.path.exists(uevent_path):
            with open(uevent_path, "r") as f:
                for line in f:
                    if "PCI_ID" in line:
                        name = f"Intel Graphics ({line.strip()})"

        # Initialize fallback variables
        temp, util, power, mem_used, mem_total = None, None, None, None, None

        # 1. Fallback temperature: Integrated Intel GPUs share the CPU package thermal zone
        # Look in the system thermal zones for the package temperature
        thermal_zones = glob.glob("/sys/class/thermal/thermal_zone*")
        for zone in thermal_zones:
            type_path = os.path.join(zone, "type")
            temp_path = os.path.join(zone, "temp")
            if os.path.exists(type_path) and os.path.exists(temp_path):
                with open(type_path, "r") as f_type:
                    z_type = f_type.read().strip().lower()
                    # Look for package, cpu, or coretemp zones
                    if "x86_pkg_temp" in z_type or "cpu" in z_type or "acpitz" in z_type:
                        with open(temp_path, "r") as f_temp:
                            try:
                                temp = float(f_temp.read().strip()) / 1000.0
                                break  # Grab the first matching thermal zone
                            except ValueError:
                                pass

        # 2. Query engine metrics using intel_gpu_top
        try:
            # We sample for a short window (120ms) using timeout to quickly grab the JSON telemetry
            cmd = ["timeout", "0.2s", "intel_gpu_top", "-J", "-s", "100"]
            output = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL)
            
            # intel_gpu_top streams JSON lines. We parse the first complete snapshot we find.
            # Clean up the stream formatting (stripping brackets if present)
            clean_output = output.strip().lstrip("[").rstrip("]").strip()
            
            # Grab the last valid JSON block in the stream if there are multiple
            blocks = clean_output.split("\n\n")
            target_block = blocks[-1] if blocks else clean_output
            
            # If there's a trailing comma from the array format, strip it
            if target_block.endswith(","):
                target_block = target_block[:-1]
                
            data = json.loads(target_block)

            # Extract Utilization (Look at Render/3D engine load)
            engines = data.get("engines", {})
            render_engine = engines.get("Render/3D/0", {}) or engines.get("Render/3D", {})
            if render_engine:
                util = render_engine.get("busy", 0.0)

            # Extract Power
            power_data = data.get("power", {})
            if power_data:
                power = power_data.get("value")

            # Extract Memory (For discrete Arc cards or system shared memory)
            memory_regions = data.get("memory", {})
            if memory_regions:
                # Use local memory (VRAM) if available, otherwise fall back to system memory
                region_name = "local" if "local" in memory_regions else "system"
                mem_info = memory_regions.get(region_name, {})
                if mem_info:
                    mem_used = mem_info.get("used", 0.0)
                    mem_total = mem_info.get("total", 0.0)

        except Exception:
            # If intel_gpu_top isn't available or fails, we fall back to the defaults
            pass

        gpus.append(GPUMetrics(
            vendor="intel",
            index=idx,
            name=name,
            temperature_c=temp,
            utilization_gpu_pct=util,
            memory_used_mb=mem_used,
            memory_total_mb=mem_total,
            power_draw_w=power
        ))
        idx += 1

    return gpus

# --- API ENDPOINTS ---

@app.get("/gpu", response_model=List[GPUMetrics])
def get_all_gpus():
    all_gpus = []
    all_gpus.extend(get_nvidia_gpus())
    all_gpus.extend(get_amd_gpus())
    all_gpus.extend(get_intel_gpus())
    return all_gpus

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
