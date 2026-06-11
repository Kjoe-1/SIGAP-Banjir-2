#!/usr/bin/env python3
"""
Prediksi status banjir SIGAP - terpadu 3 lokasi.
Output JSON SERAGAM untuk semua lokasi (dipakai dashboard).

Pakai:
  python prediksi.py --lokasi 1 --mode demo
  python prediksi.py --lokasi 2 --mode demo --jam "2026-05-25 13:00:00"
  python prediksi.py --lokasi 3 --mode demo

Mode 'db' (realtime) belum diaktifkan di paket ini -> langkah integrasi berikut (lihat README).
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

def _keandalan(tipe, h):
    if tipe == "forecast_hujan": return "andal" if h <= 3 else "indikatif"
    if tipe == "forecast_tren":  return "indikatif"
    return "tidak_tersedia"

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
    ap.add_argument("--jam", default=None)
    a = ap.parse_args()
    cfg = C.LOKASI[a.lokasi]
    base = C.BASE

    if a.mode == "db":
        print(json.dumps({"success": False, "lokasi": a.lokasi,
                          "message": "Mode db (realtime) belum diaktifkan. Gunakan --mode demo. Lihat README untuk integrasi DB."}))
        return

    out = {"success": True, "lokasi": a.lokasi, "nama_lokasi": cfg["nama"], "tipe": cfg["tipe"], "sumber": "demo"}

    # ---- LOKASI 3: KLASIFIKASI SAJA ----
    if cfg["tipe"] == "klasifikasi":
        meta = json.load(open(os.path.join(base, cfg["meta"])))
        df = pd.read_csv(os.path.join(base, cfg["demo"])); df["jam"] = pd.to_datetime(df["jam"])
        df = df.dropna(subset=["distance_avg"])
        row = df.iloc[-1] if a.jam is None else df[df.jam == pd.to_datetime(a.jam)].iloc[-1]
        dist = float(row["distance_avg"]); ref = meta["ref"]
        st = C.status_dari_distance(dist, meta["t_waspada_dist"], meta["t_siaga_dist"])
        out["sekarang"] = {"waktu_data": str(row["jam"]), "distance_cm": round(dist, 1),
                           "tinggi_air_cm": round(ref - dist, 1), "status": st}
        out["prediksi"] = {str(h): {"jam_ke_depan": h, "tinggi_air_cm": None, "status": "tidak_tersedia",
                                    "confidence": None, "keandalan": "tidak_tersedia"} for h in HOR}
        out["peringatan"] = {"ada": st != "AMAN", "status": st, "dalam_jam": 0,
                             "pesan": f"Status SAAT INI: {st}" if st != "AMAN" else "Aman"}
        out["catatan"] = "Lokasi rumah pompa, data hanya ~10 hari -> forecasting tidak dapat dilatih. Hanya klasifikasi status saat ini. Threshold tentatif, perlu konfirmasi Tim Sipil."
        print(json.dumps(out)); return

    # ---- LOKASI 1 & 2: FORECAST ----
    b = pickle.load(open(os.path.join(base, cfg["model"]), "rb"))
    ref, t_was, t_sia = b["ref"], b["t_waspada_dist"], b["t_siaga_dist"]
    df = pd.read_csv(os.path.join(base, cfg["demo"])); df["jam"] = pd.to_datetime(df["jam"])
    jam = pd.to_datetime(a.jam) if a.jam else (pd.to_datetime(cfg["demo_jam"]) if cfg["demo_jam"] else df.jam.iloc[-1])

    if cfg["tipe"] == "forecast_hujan":
        row = df[df.jam == jam].iloc[-1]
        x = _fitur_lok1(row, b["fitur"]); dist_now = float(row["distance_avg"])
    else:
        seri = df.set_index("jam")["distance_avg"]
        x = _fitur_lok2(seri, jam, b["fitur"]); dist_now = float(seri.get(jam, np.nan))

    st_now = C.status_dari_distance(dist_now, t_was, t_sia)
    out["sekarang"] = {"waktu_data": str(jam), "distance_cm": round(dist_now, 1),
                       "tinggi_air_cm": round(ref - dist_now, 1), "status": st_now}

    pred = {}; peringatan = None
    if x is None:
        for h in HOR:
            pred[str(h)] = {"jam_ke_depan": h, "tinggi_air_cm": None, "status": "tidak_tersedia",
                            "confidence": None, "keandalan": "tidak_tersedia"}
    else:
        for h in HOR:
            dist, st, conf = _conf(b["models"][h], x, t_was, t_sia)
            pred[str(h)] = {"jam_ke_depan": h, "tinggi_air_cm": round(ref - dist, 1), "status": st,
                            "confidence": conf, "keandalan": _keandalan(cfg["tipe"], h)}
            if peringatan is None and st in ("WASPADA", "SIAGA"):
                peringatan = {"ada": True, "status": st, "dalam_jam": h,
                              "pesan": f"Diprediksi {st} dalam {h} jam (keyakinan {int(conf*100)}%)"}
    out["prediksi"] = pred
    out["peringatan"] = peringatan or {"ada": False, "status": "AMAN", "dalam_jam": None, "pesan": "Aman"}
    out["catatan"] = ("Forecasting andal (badan air alami, digerakkan hujan)." if cfg["tipe"] == "forecast_hujan"
                      else "Lokasi rumah pompa: forecasting INDIKATIF (operasi pompa tidak terobservasi). Recall bahaya rendah.")
    print(json.dumps(out))

if __name__ == "__main__":
    main()
