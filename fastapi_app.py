import os
import sys
import json
import subprocess
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

app = FastAPI(title="SIGAP Banjir ML API Service")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class PredictMLRequest(BaseModel):
    distance_cm: float = 40.1
    rainfall_mm: float = 0.0
    tip_count: int = 0

class Predict1HourRequest(BaseModel):
    distance1: float = 0.0
    distance2: float = 0.0
    curah_hujan: float = 0.0
    curah_hujan_1h: float = 0.0
    jumlah_tip: int = 0

@app.get("/")
def read_root():
    return {"status": "ok", "service": "SIGAP Banjir ML API"}

@app.post("/predict")
def predict_ml(payload: PredictMLRequest):
    script_path = os.path.join(BASE_DIR, "predict_ml.py")
    payload_str = json.dumps(payload.dict())
    
    try:
        res = subprocess.run(
            [sys.executable, script_path, payload_str],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"ML predict error: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict_1hour")
def predict_1hour(payload: Predict1HourRequest):
    script_path = os.path.join(BASE_DIR, "predict_1hour.py")
    payload_str = json.dumps(payload.dict())
    
    try:
        res = subprocess.run(
            [sys.executable, script_path, payload_str],
            capture_output=True,
            text=True,
            check=True
        )
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"ML forecast error: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prediksi")
def get_prediksi(
    lokasi: int = Query(..., ge=1, le=3),
    mode: str = Query("db", pattern="^(db|demo)$"),
    anchor: str = Query("latest", pattern="^(now|latest)$"),
    lookback: int = Query(336)
):
    script_path = os.path.join(BASE_DIR, "ml", "prediksi.py")
    args = [
        sys.executable,
        script_path,
        "--lokasi", str(lokasi),
        "--mode", mode,
        "--anchor", anchor,
        "--lookback", str(lookback)
    ]
    
    try:
        res = subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=True,
            cwd=os.path.join(BASE_DIR, "ml")
        )
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Prediksi error: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/perbandingan")
def get_perbandingan(
    lokasi: int = Query(..., ge=1, le=3),
    mode: str = Query("demo", pattern="^(db|demo)$"),
    max_points: int = Query(48)
):
    script_path = os.path.join(BASE_DIR, "ml", "banding.py")
    args = [
        sys.executable,
        script_path,
        "--lokasi", str(lokasi),
        "--mode", mode,
        "--max-points", str(max_points)
    ]
    
    try:
        res = subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=True,
            cwd=os.path.join(BASE_DIR, "ml")
        )
        return json.loads(res.stdout)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Banding error: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
