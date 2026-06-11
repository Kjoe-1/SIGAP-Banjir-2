# Konfigurasi multi-lokasi SIGAP Banjir
# Status (aman -> bahaya): AMAN, WASPADA, SIAGA
import os
BASE = os.path.dirname(os.path.abspath(__file__))

STATUS_ORDER = ["AMAN", "WASPADA", "SIAGA"]

LOKASI = {
    1: {"nama": "UHT",        "tipe": "forecast_hujan", "model": "model/lok1.pkl",      "demo": "data/lok1_demo.csv", "demo_jam": "2025-11-01 04:00:00"},
    2: {"nama": "Kalikobor",  "tipe": "forecast_tren",  "model": "model/lok2.pkl",      "demo": "data/lok2_demo.csv", "demo_jam": "2026-05-25 13:00:00"},
    3: {"nama": "Pucanganom", "tipe": "klasifikasi",    "meta":  "model/lok3_meta.json","demo": "data/lok3_demo.csv", "demo_jam": None},
}

def status_dari_distance(d, t_waspada, t_siaga):
    if d <= t_siaga:   return "SIAGA"
    elif d <= t_waspada: return "WASPADA"
    return "AMAN"
