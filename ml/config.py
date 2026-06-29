import os

BASE = os.path.dirname(os.path.abspath(__file__))
# dotenv opsional: kalau belum terpasang, pakai env var sistem (tidak crash).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE, ".env"))
except ImportError:
    pass

STATUS_ORDER = ["AMAN", "WASPADA", "SIAGA"]

# Kredensial dibaca dari env (lihat .env.example). Tidak ada nilai rahasia di source.
# Terima DB_* (bot) maupun SENSOR_DB_* (dipakai server.js website) agar 1 set env
# var cukup untuk dua-duanya (mis. di Railway).
DB_HOST = os.environ.get("DB_HOST") or os.environ.get("SENSOR_DB_HOST") or "31.97.66.191"
# IP lama/typo (197.66.1.91) sempat ter-set di env Railway -> koreksi ke yang benar.
if DB_HOST.strip() in ("197.66.1.91", ""):
    DB_HOST = "31.97.66.191"
DB_USER = os.environ.get("DB_USER") or os.environ.get("SENSOR_DB_USER") or "Joko"
DB_PASS = os.environ.get("DB_PASS") or os.environ.get("SENSOR_DB_PASS") or "Joko12345"
DB_PORT = int(os.environ.get("DB_PORT") or os.environ.get("SENSOR_DB_PORT") or "3306")
JAM_HISTORI = 48
LOKASI = {
    1: {"nama": "Pucanganom", "tipe": "klasifikasi",    "meta":  "model/lok3_meta.json", "demo": "data/lok3_demo.csv", "demo_jam": None,                 "db": "dbpvwemonbaru2", "dist_min": 50,  "dist_max": 600},
    2: {"nama": "UHT",        "tipe": "forecast_hujan", "model": "model/lok1.pkl",       "demo": "data/lok1_demo.csv", "demo_jam": "2025-11-01 04:00:00", "db": "dbpvwemon",      "dist_min": 100, "dist_max": 600},
    3: {"nama": "Kalikobor",  "tipe": "forecast_tren",  "model": "model/lok2.pkl",       "demo": "data/lok2_demo.csv", "demo_jam": "2026-05-25 13:00:00", "db": "dbpvwemonbaru",  "dist_min": 50,  "dist_max": 600},
}

# Ambang tinggi air resmi (cm) per lokasi. Bila ada, MENGGANTI ambang data-driven
# dari model (.pkl). AMAN < waspada ; WASPADA = waspada..siaga ; SIAGA >= siaga
# Penomoran ikut LOKASI di atas: 1=Pucanganom, 2=UHT, 3=Kalikobor.
AMBANG_TINGGI = {
    1: {"waspada": 110, "siaga": 130},  # Pucanganom (rumah pompa) - indikatif, info operator
    2: {"waspada": 180, "siaga": 190},  # UHT (sungai) - acuan Bu Kamilia (Teknik Sipil)
    3: {"waspada": 120, "siaga": 150},  # Kalikobor (rumah pompa) - indikatif, info operator
}


def status_dari_distance(d, t_waspada, t_siaga):
    if d <= t_siaga:   return "SIAGA"
    elif d <= t_waspada: return "WASPADA"
    return "AMAN"
