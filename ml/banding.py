#!/usr/bin/env python3
"""
Bandingkan hasil prediksi vs data asli (time series) per horizon.
Output JSON: data berurutan dari N titik TERAKHIR (bukan sample acak).
"""
import argparse, json, pickle, os, warnings
warnings.filterwarnings("ignore")
import pandas as pd, numpy as np
import config as C

HOR = [1, 3, 6, 12, 24]

def _conf(rf, x, t_was, t_sia):
    dist = float(rf.predict([x])[0])
    ens = C.status_dari_distance(dist, t_was, t_sia)
    tp = [C.status_dari_distance(float(t.predict([x])[0]), t_was, t_sia) for t in rf.estimators_]
    conf = sum(1 for s in tp if s == ens) / len(tp)
    return dist, ens, round(conf, 2)

def _fitur_lok1(row, fitur):
    return [float(row[f]) for f in fitur]

def _fitur_lok2(seri, jam, fitur):
    g = lambda k: seri.get(jam - pd.Timedelta(hours=k), np.nan)
    lag1, lag2, lag3, lag6 = g(1), g(2), g(3), g(6)
    vals = {"lag1": lag1, "lag2": lag2, "lag3": lag3, "lag6": lag6,
            "tren": (lag1 - lag2) if (pd.notna(lag1) and pd.notna(lag2)) else np.nan,
            "jam_hari": jam.hour}
    x = [vals[f] for f in fitur]
    return x if all(pd.notna(v) for v in x) else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lokasi", type=int, required=True, choices=[1, 2, 3])
    ap.add_argument("--max-points", type=int, default=48)
    a = ap.parse_args()
    cfg = C.LOKASI[a.lokasi]
    base = C.BASE

    if cfg["tipe"] == "klasifikasi":
        print(json.dumps({"success": False, "message": "Tidak ada forecasting"}))
        return

    df = pd.read_csv(os.path.join(base, cfg["demo"]))
    df["jam"] = pd.to_datetime(df["jam"])
    df = df.sort_values("jam").reset_index(drop=True)

    b = pickle.load(open(os.path.join(base, cfg["model"]), "rb"))
    ref, t_was, t_sia = b["ref"], b["t_waspada_dist"], b["t_siaga_dist"]

    out = {"success": True, "lokasi": a.lokasi, "nama_lokasi": cfg["nama"], "tipe": cfg["tipe"],
           "ref": ref, "t_waspada": t_was, "t_siaga": t_sia}
    for h in HOR:
        out[str(h)] = {"waktu": [], "prediksi": [], "aktual": []}

    if cfg["tipe"] == "forecast_hujan":
        target_map = {1: "target_1", 3: "target_3", 6: "target_6", 12: "target_12", 24: "target_24"}
        start = max(0, len(df) - a.max_points)

        for i in range(start, len(df)):
            row = df.iloc[i]
            jam = row["jam"]

            try:
                x = _fitur_lok1(row, b["fitur"])
            except Exception:
                continue
            if x is None or any(pd.isna(v) for v in x):
                continue

            for h in HOR:
                tcol = target_map[h]
                if tcol not in df.columns or pd.isna(row[tcol]):
                    continue
                try:
                    dist_pred, _, _ = _conf(b["models"][h], x, t_was, t_sia)
                except Exception:
                    continue
                tinggi_pred = round(ref - dist_pred, 1)
                tinggi_aktual = round(ref - float(row[tcol]), 1)
                out[str(h)]["waktu"].append(str(jam))
                out[str(h)]["prediksi"].append(tinggi_pred)
                out[str(h)]["aktual"].append(tinggi_aktual)

    elif cfg["tipe"] == "forecast_tren":
        seri = df.set_index("jam")["distance_avg"]
        start = max(0, len(df) - a.max_points)

        for i in range(start, len(df)):
            jam = df.iloc[i]["jam"]
            x = _fitur_lok2(seri, jam, b["fitur"])
            if x is None:
                continue

            for h in HOR:
                jam_aktual = jam + pd.Timedelta(hours=h)
                dist_aktual = float(seri.get(jam_aktual, np.nan))
                if pd.isna(dist_aktual):
                    continue

                try:
                    dist_pred, _, _ = _conf(b["models"][h], x, t_was, t_sia)
                except Exception:
                    continue

                tinggi_pred = round(ref - dist_pred, 1)
                tinggi_aktual = round(ref - dist_aktual, 1)
                out[str(h)]["waktu"].append(str(jam))
                out[str(h)]["prediksi"].append(tinggi_pred)
                out[str(h)]["aktual"].append(tinggi_aktual)

    print(json.dumps(out, default=str))

if __name__ == "__main__":
    main()
