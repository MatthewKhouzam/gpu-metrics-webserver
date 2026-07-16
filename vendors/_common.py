"""Shared sysfs helpers for GPU vendor parsers."""

import os
import glob
from typing import Optional, List, Tuple


def read_sysfs(path: str) -> Optional[str]:
    """Read a sysfs file and return its stripped content, or None if missing/unreadable."""
    try:
        if os.path.exists(path):
            with open(path, "r") as f:
                return f.read().strip()
    except (IOError, OSError):
        pass
    return None


def read_sysfs_int(path: str) -> Optional[float]:
    """Read a sysfs file as a float, or None if missing/unparseable."""
    val = read_sysfs(path)
    if val is not None:
        try:
            return float(val)
        except ValueError:
            pass
    return None


def find_drm_cards_by_driver(driver_names: List[str]) -> List[Tuple[str, str]]:
    """
    Discover DRM cards whose driver symlink matches one of the given names.

    Returns a list of (card_path, device_path) tuples.
    """
    results = []
    cards = sorted(glob.glob("/sys/class/drm/card*"))
    for card in cards:
        # Skip render nodes (card0-render, etc.)
        if not os.path.basename(card).startswith("card"):
            continue
        device_link = os.path.join(card, "device")
        driver_link = os.path.join(device_link, "driver")
        if not os.path.exists(driver_link):
            continue
        real_driver = os.path.realpath(driver_link)
        if any(name in real_driver for name in driver_names):
            results.append((card, device_link))
    return results


def read_hwmon_temperature(device_path: str, input_name: str = "temp1_input") -> Optional[float]:
    """
    Read temperature from the hwmon interface under a device path.
    The sysfs value is in millidegrees Celsius; returns degrees C.
    """
    hwmon_dirs = glob.glob(os.path.join(device_path, "hwmon", "hwmon*"))
    if not hwmon_dirs:
        return None
    temp_path = os.path.join(hwmon_dirs[0], input_name)
    val = read_sysfs_int(temp_path)
    if val is not None:
        return val / 1000.0
    return None


def read_hwmon_power(device_path: str, input_name: str = "power1_average") -> Optional[float]:
    """
    Read power from the hwmon interface under a device path.
    The sysfs value is in microwatts; returns watts.
    """
    hwmon_dirs = glob.glob(os.path.join(device_path, "hwmon", "hwmon*"))
    if not hwmon_dirs:
        return None
    power_path = os.path.join(hwmon_dirs[0], input_name)
    val = read_sysfs_int(power_path)
    if val is not None:
        return val / 1000000.0
    return None
