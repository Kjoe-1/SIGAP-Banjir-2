import argparse, json, pickle, os, warnings
warnings.filterwarnings("ignore")
import pandas as pd, numpy as np
import config as C
HOR = [1, 3, 6]
def _conf(rf, x, t_was, t_sia):
    dist = float(rf.predict([x])[0])
    ens = C.status_dari_distance(dist, t_was, t_sia)
    tp = [C.status_dari_distance(float(t.predict([x])[0]), t_was, t_sia) for t in rf.estimators_]
    return dist, ens, round(sum(1 for s in tp if s == ens) / len(tp), 2)
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
            "tren": (lag1 - lag2) if (pd.notna(lag1) and pd.notna(lag2)) else np.nan, "jam_hari": jam.hour}
    x = [vals[f] for f in fitur]
    return x if all(pd.notna(v) for v in x) else None
def _db_conn(dbname):
    try:
        import pymysql
    except ImportError:
        raise RuntimeError("pymysql belum terpasang. Jalankan: pip install pymysql")
    return pymysql.connect(host=C.DB_HOST, user=C.DB_USER, password=C.DB_PASS,
                           database=dbname, port=C.DB_PORT, connect_timeout=10)
def _query(conn, sql):
    cur = conn.cursor(); cur.execute(sql)
    df = pd.DataFrame(cur.fetchall(), columns=[d[0] for d in cur.description]); cur.close()
    for c in df.columns:
        if c != "jam": df[c] = pd.to_numeric(df[c], errors="coerce")
    if "jam" in df.columns: df["jam"] = pd.to_datetime(df["jam"])
    return df
def _buat_fitur_lok1(df):
    df = df.sort_values("jam").reset_index(drop=True).copy()
    df["rain1h"]   = df["rain1h_max"]
    df["rain_3h"]  = df["rain1h_max"].rolling(3,  min_periods=1).sum()
    df["rain_6h"]  = df["rain1h_max"].rolling(6,  min_periods=1).sum()
    df["rain_12h"] = df["rain1h_max"].rolling(12, min_periods=1).sum()
    df["rain24h"]  = df["rain24h_max"]
    df["air_now"]     = df["distance_avg"]
    df["air_min_now"] = df["distance_min"]
    df["tren_1h"]     = df["distance_avg"] - df["distance_avg"].shift(1)
    df["tren_3h"]     = df["distance_avg"] - df["distance_avg"].shift(3)
    df["jam_hari"]    = df["jam"].dt.hour
    df["humi"]        = df["humi_avg"]
    return df

def _prediksi_historis(df, jam_target, h, b, cfg, t_was, t_sia, ref):
    jam_asal = jam_target - pd.Timedelta(hours=h)
    if cfg["tipe"] == "forecast_hujan":
        row = df[df.jam == jam_asal]
        if row.empty: return None
        row = row.iloc[-1]
        try: x = _fitur_lok1(row, b["fitur"])
        except Exception: return None
        if x is not None and any(pd.isna(v) for v in x): x = None
    else:
        seri = df.set_index("jam")["distance_avg"]
        x = _fitur_lok2(seri, jam_asal, b["fitur"])
    if x is None: return None
    try:
        dist_pred, st, conf = _conf(b["models"][h], x, t_was, t_sia)
        return {
            "tinggi_air_cm": round(ref - dist_pred, 1),
            "status": st,
            "confidence": conf
        }
    except Exception:
        return None

def _ambil_db(cfg, anchor="now", lookback=None):
    conn = _db_conn(cfg["db"]); J = f"{lookback or C.JAM_HISTORI} HOUR"
    # anchor="now": jendela dihitung dari waktu server (default, untuk alert realtime).
    # anchor="latest": jendela dari data TERAKHIR yang ada (mis. saat sensor sempat offline).
    def batas(tbl, kol):
        return f"NOW() - INTERVAL {J}" if anchor == "now" else f"(SELECT MAX({kol}) FROM {tbl}) - INTERVAL {J}"
    try:
        if cfg["tipe"] == "forecast_hujan":
            air = _query(conn, f"SELECT DATE_FORMAT(time,'%Y-%m-%d %H:00:00') AS jam, AVG(distance) AS distance_avg, MIN(distance) AS distance_min FROM esp3 WHERE time >= {batas('esp3','time')} GROUP BY jam ORDER BY jam")
            cuaca = _query(conn, f"SELECT DATE_FORMAT(time,'%Y-%m-%d %H:00:00') AS jam, MAX(rain1h) AS rain1h_max, MAX(rain24h) AS rain24h_max, AVG(humi) AS humi_avg FROM esp2 WHERE time >= {batas('esp2','time')} GROUP BY jam ORDER BY jam")
            df = pd.merge(air, cuaca, on="jam", how="inner")
            df = df[df.distance_avg.between(cfg["dist_min"], cfg["dist_max"]) & df.distance_min.between(cfg["dist_min"], cfg["dist_max"])].reset_index(drop=True)
            return _buat_fitur_lok1(df)
        else:
            df = _query(conn, f"SELECT DATE_FORMAT(waktu,'%Y-%m-%d %H:00:00') AS jam, AVG(distance2) AS distance_avg FROM esp1 WHERE waktu >= {batas('esp1','waktu')} GROUP BY jam ORDER BY jam")
            df.loc[~df.distance_avg.between(cfg["dist_min"], cfg["dist_max"]), "distance_avg"] = np.nan
            return df
    finally:
        conn.close()
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lokasi", type=int, required=True, choices=[1, 2, 3])
    ap.add_argument("--mode", default="demo", choices=["demo", "db"])
    ap.add_argument("--anchor", default="now", choices=["now", "latest"],
                    help="now=jendela dari waktu server; latest=dari data terakhir yang ada")
    ap.add_argument("--lookback", type=int, default=None,
                    help="override jendela jam (default pakai config JAM_HISTORI)")
    ap.add_argument("--jam", default=None)
    a = ap.parse_args()
    cfg = C.LOKASI[a.lokasi]; base = C.BASE
    out = {"success": True, "lokasi": a.lokasi, "nama_lokasi": cfg["nama"], "tipe": cfg["tipe"], "sumber": a.mode}
    try:
        if a.mode == "db":
            try:
                df = _ambil_db(cfg, a.anchor, a.lookback)
                # Filter out data after June 24, 2026 to keep predictions valid for video recording
                df = df[df["jam"] <= "2026-06-24 23:59:59"]
            except Exception as e:
                # KONEKSI DB gagal (env/jaringan/pymysql) -> jaring pengaman: pakai demo,
                # ditandai jelas supaya frontend bisa kasih label "data demo".
                df = pd.read_csv(os.path.join(base, cfg["demo"])); df["jam"] = pd.to_datetime(df["jam"])
                out["sumber"] = "demo"; out["fallback_demo"] = True; out["alasan_fallback"] = str(e)
            else:
                # DB konek tapi tidak ada data terbaru (sensor mati) -> jujur offline.
                if df.empty or df.dropna(subset=["distance_avg"]).empty:
                    print(json.dumps({"success": False, "lokasi": a.lokasi, "message": "Tidak ada data realtime valid dari DB."})); return
        else:
            df = pd.read_csv(os.path.join(base, cfg["demo"])); df["jam"] = pd.to_datetime(df["jam"])
    except Exception as e:
        print(json.dumps({"success": False, "lokasi": a.lokasi, "message": f"Gagal ambil data: {e}"})); return
    if cfg["tipe"] == "klasifikasi":
        meta = json.load(open(os.path.join(base, cfg["meta"])))
        d = df.dropna(subset=["distance_avg"])
        if d.empty:
            out["sekarang"] = {"waktu_data": "N/A", "distance_cm": 0.0, "tinggi_air_cm": 0.0, "status": "OFFLINE"}
            out["ambang"] = {"waspada": round(meta["ref"] - meta["t_waspada_dist"], 1), "siaga": round(meta["ref"] - meta["t_siaga_dist"], 1)}
            out["prediksi"] = {str(h): {"jam_ke_depan": h, "tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None, "keandalan": "tidak_tersedia"} for h in HOR}
            out["prediksi_lalu"] = {}
            out["prediksi_historis"] = {}
            out["peringatan"] = {"ada": False, "status": "AMAN", "dalam_jam": 0, "pesan": "Sensor Pucanganom Offline"}
            out["catatan"] = "Tidak ada data sensor valid di database."
            print(json.dumps(out, default=str)); return
        row = d.iloc[-1] if (a.mode == "db" or a.jam is None) else d[d.jam == pd.to_datetime(a.jam)].iloc[-1]
        dist = float(row["distance_avg"]); ref = meta["ref"]
        t_was_d, t_sia_d = meta["t_waspada_dist"], meta["t_siaga_dist"]
        # Override ambang dengan tinggi air resmi bila tersedia (config.AMBANG_TINGGI).
        _ov = C.AMBANG_TINGGI.get(a.lokasi)
        if _ov:
            t_was_d, t_sia_d = ref - _ov["waspada"], ref - _ov["siaga"]
        st = C.status_dari_distance(dist, t_was_d, t_sia_d)
        out["sekarang"] = {"waktu_data": str(row["jam"]), "distance_cm": round(dist,1), "tinggi_air_cm": round(ref-dist,1), "status": st}
        out["ambang"] = {"waspada": round(ref - t_was_d, 1), "siaga": round(ref - t_sia_d, 1)}
        out["prediksi"] = {str(h): {"jam_ke_depan": h, "tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None, "keandalan": "tidak_tersedia"} for h in HOR}
        out["prediksi_lalu"] = {}
        out["prediksi_historis"] = {}
        out["peringatan"] = {"ada": st!="AMAN", "status": st, "dalam_jam": 0, "pesan": (f"Status SAAT INI: {st}" if st!="AMAN" else "Aman")}
        out["catatan"] = "Rumah pompa, data ~10 hari -> hanya klasifikasi status saat ini."
        print(json.dumps(out, default=str)); return
    b = pickle.load(open(os.path.join(base, cfg["model"]), "rb"))
    ref, t_was, t_sia = b["ref"], b["t_waspada_dist"], b["t_siaga_dist"]
    # Override ambang dengan tinggi air resmi bila tersedia (lihat config.AMBANG_TINGGI).
    _ov = C.AMBANG_TINGGI.get(a.lokasi)
    if _ov:
        t_was, t_sia = ref - _ov["waspada"], ref - _ov["siaga"]
    jam = df["jam"].iloc[-1] if a.mode == "db" else (pd.to_datetime(a.jam) if a.jam else (pd.to_datetime(cfg["demo_jam"]) if cfg["demo_jam"] else df["jam"].iloc[-1]))
    if cfg["tipe"] == "forecast_hujan":
        row = df[df.jam == jam]
        if row.empty: row = df.iloc[[-1]]; jam = row["jam"].iloc[-1]
        row = row.iloc[-1]
        try: x = _fitur_lok1(row, b["fitur"])
        except Exception: x = None
        if x is not None and any(pd.isna(v) for v in x): x = None
        dist_now = float(row["distance_avg"])
    else:
        seri = df.set_index("jam")["distance_avg"]
        x = _fitur_lok2(seri, jam, b["fitur"]); dist_now = float(seri.get(jam, np.nan))
    if pd.isna(dist_now):
        print(json.dumps({"success": False, "lokasi": a.lokasi, "message": "Pembacaan terakhir tidak valid (glitch/di luar rentang) — sensor bermasalah."}))
        return
    st_now = C.status_dari_distance(dist_now, t_was, t_sia)
    out["sekarang"] = {"waktu_data": str(jam), "distance_cm": round(dist_now,1), "tinggi_air_cm": round(ref-dist_now,1), "status": st_now}
    out["ambang"] = {"waspada": round(ref - t_was, 1), "siaga": round(ref - t_sia, 1)}
    pred = {}; peringatan = None
    pred_lalu = {}
    pred_hist = {}
    if x is None:
        for h in HOR:
            pred[str(h)] = {"jam_ke_depan": h, "tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None, "keandalan": "tidak_tersedia"}
            pred_lalu[str(h)] = {"tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None}
            pred_hist[str(h)] = {"tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None}
    else:
        for h in HOR:
            dist, st, conf = _conf(b["models"][h], x, t_was, t_sia)
            pred[str(h)] = {"jam_ke_depan": h, "tinggi_air_cm": round(ref-dist,1), "status": st, "confidence": conf, "keandalan": _keandalan(cfg["tipe"], h)}
            if peringatan is None and st in ("WASPADA","SIAGA"):
                peringatan = {"ada": True, "status": st, "dalam_jam": h, "pesan": f"Diprediksi {st} dalam {h} jam ({int(conf*100)}% pohon model sepakat)"}
            
            p_lalu = _prediksi_historis(df, jam, h, b, cfg, t_was, t_sia, ref)
            if p_lalu:
                pred_lalu[str(h)] = p_lalu
            else:
                pred_lalu[str(h)] = {"tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None}

            p_hist = _prediksi_historis(df, jam - pd.Timedelta(hours=h), h, b, cfg, t_was, t_sia, ref)
            if p_hist:
                pred_hist[str(h)] = p_hist
            else:
                pred_hist[str(h)] = {"tinggi_air_cm": None, "status": "tidak_tersedia", "confidence": None}

    out["prediksi"] = pred
    out["prediksi_lalu"] = pred_lalu
    out["prediksi_historis"] = pred_hist
    out["peringatan"] = peringatan or {"ada": False, "status": "AMAN", "dalam_jam": None, "pesan": "Aman"}
    out["catatan"] = ("Forecasting andal (badan air alami, hujan)." if cfg["tipe"]=="forecast_hujan" else "Rumah pompa: forecasting INDIKATIF.")
    # Histori beberapa jam terakhir (untuk konteks tren di chart): aktual s/d "sekarang".
    hist = []
    dft = df.dropna(subset=["distance_avg"])
    dft = dft[dft["jam"] <= jam].tail(7)
    for _, r in dft.iterrows():
        dd = float(r["distance_avg"])
        hist.append({"jam": str(r["jam"]), "tinggi_air_cm": round(ref - dd, 1),
                     "status": C.status_dari_distance(dd, t_was, t_sia)})
    out["histori"] = hist
    print(json.dumps(out, default=str))
if __name__ == "__main__":
    main()
