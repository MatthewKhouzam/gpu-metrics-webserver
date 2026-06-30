import asyncio
import json
import subprocess
from fastapi import FastAPI, HTTPException
import xmltodict

app = FastAPI(title="NVIDIA SMI JSON Exposer")

JSON_FILE_PATH = "gpu_status.json"


def get_nvidia_smi_json():
    """Runs nvidia-smi with XML output and converts it to a clean dictionary."""
    try:
        # Run nvidia-smi with XML flag
        result = subprocess.run(
            ["nvidia-smi", "-q", "-x"], capture_output=True, text=True, check=True
        )

        # Parse the XML string into a Python dict
        parsed_dict = xmltodict.parse(result.stdout)
        return parsed_dict

    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500, detail=f"nvidia-smi failed to execute: {e.stderr}"
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="nvidia-smi command not found. Is the NVIDIA driver installed?",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error parsing metrics: {str(e)}"
        )


async def save_json_async(data: dict):
    """Asynchronously writes the dictionary to a local JSON file."""
    loop = asyncio.get_running_loop()
    # Run the file I/O operations in a thread pool to avoid blocking the async loop
    await loop.run_in_executor(
        None,
        lambda: open(JSON_FILE_PATH, "w", encoding="utf-8").write(
            json.dumps(data, indent=4)
        ),
    )


@app.get("/gpu")
async def get_gpu_metrics():
    """Endpoint that reads nvidia-smi, saves it locally, and returns the live JSON."""
    data = get_nvidia_smi_json()

    # Save to file in the background/asynchronously
    await save_json_async(data)

    return data


if __name__ == "__main__":
    import uvicorn

    # Binds to 0.0.0.0 to make it available online over the network/internet
    uvicorn.run(app, host="0.0.0.0", port=28123)
