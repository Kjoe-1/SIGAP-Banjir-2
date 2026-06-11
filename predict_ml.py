import sys
import json
import joblib
import pandas as pd

model_pack = joblib.load("sigap_flood_model.pkl")
model = model_pack["model"]
feature_cols = model_pack["feature_cols"]

payload = json.loads(sys.argv[1])

distance = float(payload.get("distance_cm", 40.1))
rainfall = float(payload.get("rainfall_mm", 0))
tip = int(payload.get("tip_count", 0))

sample = {
    "distance1": distance,
    "distance2": 0,
    "distance_min_cm": distance,
    "distance_avg_cm": distance,
    "distance_change_cm": 0,
    "water_rise_cm": 0,
    "curah_hujan": rainfall,
    "curah_hujan_1h": rainfall,
    "jumlah_tip": tip,
    "rainfall_roll_10": rainfall,
    "rainfall_1h_roll": rainfall,
    "tip_roll_10": tip,
    "water_rise_roll_10": 0,
    "hour": 14,
    "minute": 30,
    "dayofweek": 6,
}

X = pd.DataFrame([sample])[feature_cols]

prediction = model.predict(X)[0]
proba = model.predict_proba(X)[0]

result = {
    "risk_prediction": prediction,
    "confidence": round(float(max(proba)), 3),
    "probabilities": {
        cls: round(float(p), 3)
        for cls, p in zip(model.classes_, proba)
    }
}

print(json.dumps(result))