"""NVIDIA GPU parser using nvidia-smi."""

import subprocess
from typing import List

from .schema import GPUMetrics


def get_gpus() -> List[GPUMetrics]:
    """Query nvidia-smi for GPU metrics."""
    gpus = []
    try:
        cmd = [
            "nvidia-smi",
            "--query-gpu=index,name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
            "--format=csv,noheader,nounits",
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
        pass
    return gpus
