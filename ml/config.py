import os
BASE = os.path.dirname(os.path.abspath(__file__))
STATUS_ORDER = ["AMAN", "WASPADA", "SIAGA"]
DB_HOST = "31.97.66.191"
DB_USER = "Joko"
DB_PASS = "Joko12345"
DB_PORT = 3306
JAM_HISTORI = 48
LOKASI = {
    1: {"nama": "Pucanganom", "tipe": "klasifikasi",    "meta":  "model/lok3_meta.json", "demo": "data/lok3_demo.csv", "demo_jam": None,                 "db": "dbpvwemonbaru2", "dist_min": 50,  "dist_max": 600},
    2: {"nama": "UHT",        "tipe": "forecast_hujan", "model": "model/lok1.pkl",       "demo": "data/lok1_demo.csv", "demo_jam": "2025-11-01 04:00:00", "db": "dbpvwemon",      "dist_min": 100, "dist_max": 600},
    3: {"nama": "Kalikobor",  "tipe": "forecast_tren",  "model": "model/lok2.pkl",       "demo": "data/lok2_demo.csv", "demo_jam": "2026-05-25 13:00:00", "db": "dbpvwemonbaru",  "dist_min": 50,  "dist_max": 600},
}
def status_dari_distance(d, t_waspada, t_siaga):
    if d <= t_siaga:   return "SIAGA"
    elif d <= t_waspada: return "WASPADA"
    return "AMAN"
