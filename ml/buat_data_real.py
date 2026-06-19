#!/usr/bin/env python3
"""
buat_data_real.py - Bangun data latih Lok 1 dari database (bukan demo).

Alur: tarik esp3 (air) + esp2 (cuaca) dari MySQL -> agregasi per jam ->
buang glitch -> clamp kedalaman negatif -> bikin fitur (via prediksi._buat_fitur_lok1,
sumber yang SAMA dengan serving -> anti train/serve skew) -> bikin target multi-horizon
-> simpan ke data/lok1_real.csv (dipakai oleh latih_model.py).

Cara pakai:
    python buat_data_real.py
"""
import pandas as pd, numpy as np, warnings
warnings.filterwarnings("ignore")
import config as C
from prediksi import _buat_fitur_lok1

REF = 466
HOR = [1, 3, 6, 12, 24]
DIST_MIN, DIST_MAX = 25, 600

def tarik_db():
    import pymysql
    conn = pymysql.connect(host=C.DB_HOST, user=C.DB_USER, password=C.DB_PASS,
                           database="dbpvwemon", port=C.DB_PORT, connect_timeout=20)
    def q(sql):
        cur = conn.cursor(); cur.execute(sql)
        df = pd.DataFrame(cur.fetchall(), columns=[d[0] for d in cur.description]); cur.close()
        return df
    air = q("""SELECT DATE_FORMAT(time,'%Y-%m-%d %H:00:00') jam, AVG(distance) distance_avg,
               MIN(distance) distance_min FROM esp3 GROUP BY jam ORDER BY jam""")
    cuaca = q("""SELECT DATE_FORMAT(time,'%Y-%m-%d %H:00:00') jam, MAX(rain1h) rain1h_max,
                 MAX(rain24h) rain24h_max, AVG(humi) humi_avg FROM esp2 GROUP BY jam ORDER BY jam""")
    conn.close()
    df = pd.merge(air, cuaca, on="jam", how="inner")
    for c in df.columns:
        if c != "jam":
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df

def main():
    print("[1/4] tarik data dari DB...")
    df = tarik_db()
    n0 = len(df)
    df["jam"] = pd.to_datetime(df["jam"])
    print("[2/4] bersihkan glitch + clamp kedalaman negatif...")
    df = df[df.distance_avg.between(DIST_MIN, DIST_MAX) &
            df.distance_min.between(DIST_MIN, DIST_MAX)].copy()
    n1 = len(df)
    df.loc[df.distance_avg > REF, "distance_avg"] = REF
    df.loc[df.distance_min > REF, "distance_min"] = REF
    print("[3/4] bangun fitur (sama dgn serving) + target multi-horizon...")
    df = _buat_fitur_lok1(df)
    for h in HOR:
        df[f"target_{h}"] = df["distance_avg"].shift(-h)
    fitur = ["rain1h", "rain_3h", "rain_6h", "rain_12h", "rain24h",
             "air_now", "air_min_now", "tren_1h", "tren_3h", "jam_hari", "humi"]
    df = df.dropna(subset=fitur).reset_index(drop=True)
    print("[4/4] simpan...")
    df.to_csv("data/lok1_real.csv", index=False)
    dep = REF - df.distance_avg
    print(f"  raw {n0} -> setelah filter {n1} -> siap latih {len(df)} baris")
    print(f"  kedalaman: min {dep.min():.0f} / median {dep.median():.0f} / max {dep.max():.0f} cm")
    print(f"  jam SIAGA (>=280cm): {int((dep>=280).sum())}")
    print("  -> data/lok1_real.csv")

if __name__ == "__main__":
    main()
