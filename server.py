from typing import List

from fastapi import FastAPI

from vendors import GPUMetrics, get_all_gpus

app = FastAPI(title="Harmonized GPU Monitoring Server")


@app.get("/gpu", response_model=List[GPUMetrics])
def get_gpus():
    return get_all_gpus()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
