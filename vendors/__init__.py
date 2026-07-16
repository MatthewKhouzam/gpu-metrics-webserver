"""
GPU vendor plugin loader.

Convention: Any .py file in this directory (except __init__, _common, schema)
that exports a `get_gpus() -> List[GPUMetrics]` function is automatically
loaded as a vendor plugin. Just drop in a new file and it works.
"""

import importlib
import pkgutil
from pathlib import Path
from typing import Callable, List

from .schema import GPUMetrics

# Modules that are not vendor plugins
_SKIP = {"__init__", "_common", "schema"}

# Discovered plugin functions
_plugins: List[Callable[[], List[GPUMetrics]]] = []


def _discover_plugins():
    """Walk this package and collect get_gpus() from each vendor module."""
    package_dir = Path(__file__).parent
    for module_info in pkgutil.iter_modules([str(package_dir)]):
        if module_info.name in _SKIP or module_info.name.startswith("_"):
            continue
        module = importlib.import_module(f".{module_info.name}", package=__name__)
        fn = getattr(module, "get_gpus", None)
        if callable(fn):
            _plugins.append(fn)


_discover_plugins()


def get_all_gpus() -> List[GPUMetrics]:
    """Call all discovered vendor plugins and aggregate results."""
    results = []
    for fn in _plugins:
        results.extend(fn())
    return results


__all__ = ["GPUMetrics", "get_all_gpus"]
