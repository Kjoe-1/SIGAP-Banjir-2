#!/usr/bin/env python3
"""Latih ulang model lok1 (hujan) & lok2 (tren) dari data demo. -> model/lok1.pkl, model/lok2.pkl"""
import pandas as pd, numpy as np, pickle, os, warnings
warnings.filterwarnings("ignore")
from sklearn.ensemble import RandomForestRegressor
BASE = os.path.dirname(os.path.abspath(__file__)); HOR = [1, 3, 6, 12, 24]

def latih(X, Yd, fitur, meta, nama):
    models = {}
    for h in HOR:
        m = X.notna().all(axis=1) & Yd[h].notna()
        models[h] = RandomForestRegressor(n_estimators=120, min_samples_leaf=8, random_state=0, n_jobs=-1).fit(X[m], Yd[h][m])
    pickle.dump({"horizons": HOR, "models": models, "fitur": fitur, **meta}, open(os.path.join(BASE, f"model/{nama}.pkl"), "wb"))
    print(f"[OK] model/{nama}.pkl")

# LOK1 (rain-based)
d1 = pd.read_csv(os.path.join(BASE, "data/lok1_demo.csv"))
FIT1 = ['rain1h','rain_3h','rain_6h','rain_12h','rain24h','air_now','air_min_now','tren_1h','tren_3h','jam_hari','humi']
d1c = d1.dropna(subset=FIT1).reset_index(drop=True)
latih(d1c[FIT1], {h: d1c[f'target_{h}'] for h in HOR}, FIT1,
      {"ref": 466, "t_waspada_dist": 216, "t_siaga_dist": 186, "tipe": "forecast_hujan", "nama": "UHT"}, "lok1")

# LOK2 (autoregressive)
e2 = pd.read_csv(os.path.join(BASE, "data/lok2_demo.csv")); e2['jam'] = pd.to_datetime(e2['jam'])
s2 = e2.set_index('jam')['distance_avg']
full = pd.date_range(s2.index.min(), s2.index.max(), freq='h'); s2 = s2.reindex(full)
t_sia2 = float(s2.dropna().quantile(0.03)); t_was2 = float(s2.dropna().quantile(0.12))
FIT2 = ['lag1','lag2','lag3','lag6','tren','jam_hari']
X2 = pd.DataFrame({'lag1': s2.shift(1), 'lag2': s2.shift(2), 'lag3': s2.shift(3), 'lag6': s2.shift(6),
                   'tren': s2.shift(1) - s2.shift(2), 'jam_hari': full.hour}, index=full)
latih(X2, {h: s2.shift(-h) for h in HOR}, FIT2,
      {"ref": 545, "t_waspada_dist": t_was2, "t_siaga_dist": t_sia2, "tipe": "forecast_tren", "nama": "Kalikobor"}, "lok2")
print("Lokasi 3: tanpa model (klasifikasi via threshold, lihat model/lok3_meta.json)")
