import time
from typing import List

from fastapi import FastAPI

from vendors import GPUMetrics, get_all_gpus

app = FastAPI(title="Harmonized GPU Monitoring Server")

# Cache GPU results for at most 1 second
_cache: List[GPUMetrics] = []
_cache_time: float = 0.0
_CACHE_TTL: float = 1.0


@app.get("/gpu", response_model=List[GPUMetrics])
def get_gpus():
    global _cache, _cache_time
    now = time.monotonic()
    if now - _cache_time >= _CACHE_TTL:
        _cache = get_all_gpus()
        _cache_time = now
    return _cache


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
