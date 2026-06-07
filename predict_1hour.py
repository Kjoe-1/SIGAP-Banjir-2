import sys
import json
import joblib
import pandas as pd

model_pack = joblib.load("sigap_1hour_forecast_model.pkl")

status_model = model_pack["status_model"]
rain_model = model_pack["rain_model"]
feature_cols = model_pack["feature_cols"]

payload = json.loads(sys.argv[1])

distance1 = float(payload.get("distance1", payload.get("distance_cm", 0)))
distance2 = float(payload.get("distance2", 0))
curah_hujan = float(payload.get("curah_hujan", payload.get("rainfall_mm", 0)))
curah_hujan_1h = float(payload.get("curah_hujan_1h", curah_hujan))
jumlah_tip = int(payload.get("jumlah_tip", payload.get("tip_count", 0)))

distance_values = [d for d in [distance1, distance2] if d > 0]

if distance_values:
    distance_min_cm = min(distance_values)
    distance_avg_cm = sum(distance_values) / len(distance_values)
else:
    distance_min_cm = 0
    distance_avg_cm = 0

sample = {
    "distance1": distance1,
    "distance2": distance2,
    "distance_min_cm": distance_min_cm,
    "distance_avg_cm": distance_avg_cm,
    "distance_change_cm": 0,
    "water_rise_cm": 0,
    "curah_hujan": curah_hujan,
    "curah_hujan_1h": curah_hujan_1h,
    "jumlah_tip": jumlah_tip,
    "rainfall_roll_10": curah_hujan,
    "rainfall_1h_roll": curah_hujan_1h,
    "tip_roll_10": jumlah_tip,
    "water_rise_roll_10": 0,
    "hour": 11,
    "minute": 30,
    "dayofweek": 0,
}

X = pd.DataFrame([sample])[feature_cols]

status_pred = status_model.predict(X)[0]
status_proba = status_model.predict_proba(X)[0]
rain_pred = rain_model.predict(X)[0]

result = {
    "status_next_1h": status_pred,
    "rainfall_next_1h": round(float(rain_pred), 3),
    "confidence_next_1h": round(float(max(status_proba)), 3),
    "probabilities_next_1h": {
        cls: round(float(p), 3)
        for cls, p in zip(status_model.classes_, status_proba)
    }
}

print(json.dumps(result))