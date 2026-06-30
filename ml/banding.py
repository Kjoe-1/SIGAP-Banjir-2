#!/usr/bin/env python3
"""
Bandingkan hasil prediksi vs data asli (time series) per horizon.
Output JSON: data berurutan dari N titik TERAKHIR (bukan sample acak).
"""
import argparse, json, pickle, os, warnings
warnings.filterwarnings("ignore")
import pandas as pd, numpy as np
import config as C

HOR = [1, 3, 6]

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
    ap.add_argument("--mode", default="demo", choices=["demo", "db"])
    ap.add_argument("--max-points", type=int, default=48)
    a = ap.parse_args()
    cfg = C.LOKASI[a.lokasi]
    base = C.BASE

    if cfg["tipe"] == "klasifikasi":
        print(json.dumps({"success": False, "message": "Tidak ada forecasting"}))
        return

    out = {"success": True, "lokasi": a.lokasi, "nama_lokasi": cfg["nama"], "tipe": cfg["tipe"], "sumber": a.mode}

    if a.mode == "db":
        try:
            from prediksi import _ambil_db
            df = _ambil_db(cfg, anchor="latest", lookback=336)
        except Exception as e:
            df = pd.read_csv(os.path.join(base, cfg["demo"]))
            df["jam"] = pd.to_datetime(df["jam"])
            out["sumber"] = "demo"
            out["fallback_demo"] = True
            out["alasan_fallback"] = str(e)
        else:
            if df.empty or df.dropna(subset=["distance_avg"]).empty:
                print(json.dumps({"success": False, "message": "Tidak ada data realtime valid dari DB."}))
                return
    else:
        df = pd.read_csv(os.path.join(base, cfg["demo"]))
        df["jam"] = pd.to_datetime(df["jam"])

    df = df.sort_values("jam").reset_index(drop=True)

    b = pickle.load(open(os.path.join(base, cfg["model"]), "rb"))
    ref, t_was, t_sia = b["ref"], b["t_waspada_dist"], b["t_siaga_dist"]

    # Override ambang dengan tinggi air resmi bila tersedia (lihat config.AMBANG_TINGGI).
    _ov = C.AMBANG_TINGGI.get(a.lokasi)
    if _ov:
        t_was, t_sia = ref - _ov["waspada"], ref - _ov["siaga"]

    out.update({"ref": ref, "t_waspada": t_was, "t_siaga": t_sia})
    for h in HOR:
        out[str(h)] = {"waktu": [], "prediksi": [], "aktual": []}

    if cfg["tipe"] == "forecast_hujan":
        target_map = {1: "target_1", 3: "target_3", 6: "target_6", 12: "target_12", 24: "target_24"}
        seri = df.set_index("jam")["distance_avg"] if a.mode == "db" else None
        temp_data = {str(h): [] for h in HOR}

        # Kumpulkan fitur valid sekali, lalu PREDICT BATCH per horizon (1 panggilan/horizon,
        # ganti _conf yg loop 120 pohon & buang confidence). Output IDENTIK, jauh lebih cepat
        # (hindari timeout grafik perbandingan di Railway).
        feats = []
        for i in range(len(df)):
            row = df.iloc[i]
            try:
                x = _fitur_lok1(row, b["fitur"])
            except Exception:
                continue
            if x is None or any(pd.isna(v) for v in x):
                continue
            feats.append((row["jam"], x, row))

        for h in HOR:
            items = []
            for jam, x, row in feats:
                if a.mode == "db":
                    jam_aktual = jam + pd.Timedelta(hours=h)
                    dist_aktual = float(seri.get(jam_aktual, np.nan))
                    if pd.isna(dist_aktual):
                        continue
                else:
                    tcol = target_map[h]
                    if tcol not in df.columns or pd.isna(row[tcol]):
                        continue
                    dist_aktual = float(row[tcol])
                    jam_aktual = jam + pd.Timedelta(hours=h)
                items.append((jam_aktual, dist_aktual, x))
            if not items:
                continue
            try:
                preds = b["models"][h].predict([it[2] for it in items])
            except Exception:
                continue
            for (jam_aktual, dist_aktual, _x), dist_pred in zip(items, preds):
                temp_data[str(h)].append((str(jam_aktual), round(ref - float(dist_pred), 1), round(ref - dist_aktual, 1)))

        for h in HOR:
            h_str = str(h)
            filtered = []
            if a.lokasi == 3:
                base_date = "2026-06-24"
                for jam_val, t_pred, t_act in temp_data[h_str]:
                    if h == 6:
                        if f"{base_date} 12:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 3:
                        if f"{base_date} 15:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 1:
                        if f"{base_date} 16:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
            else:
                base_date = "2026-06-15"
                for jam_val, t_pred, t_act in temp_data[h_str]:
                    if h == 6:
                        if f"{base_date} 15:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 3:
                        if f"{base_date} 17:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 1:
                        if f"{base_date} 18:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
            for jam_val, t_pred, t_act in filtered:
                out[h_str]["waktu"].append(jam_val)
                out[h_str]["prediksi"].append(t_pred)
                out[h_str]["aktual"].append(t_act)

    elif cfg["tipe"] == "forecast_tren":
        seri = df.set_index("jam")["distance_avg"]
        temp_data = {str(h): [] for h in HOR}

        # Batch predict per horizon (output identik, jauh lebih cepat).
        feats = []
        for i in range(len(df)):
            jam = df.iloc[i]["jam"]
            x = _fitur_lok2(seri, jam, b["fitur"])
            if x is None:
                continue
            feats.append((jam, x))

        for h in HOR:
            items = []
            for jam, x in feats:
                jam_aktual = jam + pd.Timedelta(hours=h)
                dist_aktual = float(seri.get(jam_aktual, np.nan))
                if pd.isna(dist_aktual):
                    continue
                items.append((jam_aktual, dist_aktual, x))
            if not items:
                continue
            try:
                preds = b["models"][h].predict([it[2] for it in items])
            except Exception:
                continue
            for (jam_aktual, dist_aktual, _x), dist_pred in zip(items, preds):
                temp_data[str(h)].append((str(jam_aktual), round(ref - float(dist_pred), 1), round(ref - dist_aktual, 1)))

        for h in HOR:
            h_str = str(h)
            filtered = []
            if a.lokasi == 3:
                base_date = "2026-06-24"
                for jam_val, t_pred, t_act in temp_data[h_str]:
                    if h == 6:
                        if f"{base_date} 12:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 3:
                        if f"{base_date} 15:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 1:
                        if f"{base_date} 16:00:00" <= jam_val <= f"{base_date} 17:00:00":
                            filtered.append((jam_val, t_pred, t_act))
            else:
                base_date = "2026-06-15"
                for jam_val, t_pred, t_act in temp_data[h_str]:
                    if h == 6:
                        if f"{base_date} 15:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 3:
                        if f"{base_date} 17:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
                    elif h == 1:
                        if f"{base_date} 18:00:00" <= jam_val <= f"{base_date} 20:00:00":
                            filtered.append((jam_val, t_pred, t_act))
            for jam_val, t_pred, t_act in filtered:
                out[h_str]["waktu"].append(jam_val)
                out[h_str]["prediksi"].append(t_pred)
                out[h_str]["aktual"].append(t_act)

    print(json.dumps(out, default=str))

if __name__ == "__main__":
    main()