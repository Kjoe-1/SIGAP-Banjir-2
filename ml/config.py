import os

BASE = os.path.dirname(os.path.abspath(__file__))
# dotenv opsional: kalau belum terpasang, pakai env var sistem (tidak crash).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE, ".env"))
except ImportError:
    pass

STATUS_ORDER = ["AMAN", "WASPADA", "SIAGA"]

# Kredensial dibaca dari .env (lihat .env.example). Tidak ada nilai rahasia di source.
DB_HOST = os.environ.get("DB_HOST", "")
DB_USER = os.environ.get("DB_USER", "")
DB_PASS = os.environ.get("DB_PASS", "")
DB_PORT = int(os.environ.get("DB_PORT", "3306"))
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
    2: {"waspada": 250, "siaga": 285},  # UHT (sungai) - tervalidasi sipil
    3: {"waspada": 120, "siaga": 150},  # Kalikobor (rumah pompa) - indikatif, info operator
}


def status_dari_distance(d, t_waspada, t_siaga):
    if d <= t_siaga:   return "SIAGA"
    elif d <= t_waspada: return "WASPADA"
    return "AMAN"
