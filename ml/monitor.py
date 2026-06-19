#!/usr/bin/env python3
"""
monitor.py - Pemantau realtime SIGAP Banjir.
Loop tiap interval, cek status tiap lokasi via prediksi.py, kirim notif
Telegram HANYA saat status BERUBAH (naik/turun) -- anti-spam.

Pakai:
  python monitor.py --mode db --interval 3600     # produksi: tiap jam
  python monitor.py --mode demo --interval 10      # demo: tiap 10 detik
  python monitor.py --mode demo --interval 10 --dry  # uji tanpa kirim
"""
import argparse, json, os, sys, subprocess, time
import urllib.request, urllib.parse

TOKEN   = os.environ.get("TELEGRAM_TOKEN",   "ISI")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "ISI")
BASE = os.path.dirname(os.path.abspath(__file__))
URUTAN = {"AMAN": 0, "WASPADA": 1, "SIAGA": 2}

def prediksi(lok, mode):
    r = subprocess.run([sys.executable, "prediksi.py", "--lokasi", str(lok), "--mode", mode],
                       capture_output=True, text=True, cwd=BASE)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"success": False, "message": (r.stdout or r.stderr or "tidak ada output").strip()}

def kirim_telegram(teks):
    url = "https://api.telegram.org/bot%s/sendMessage" % TOKEN
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": teks}).encode()
    with urllib.request.urlopen(url, data=data, timeout=15) as resp:
        return json.loads(resp.read().decode())

def pesan_naik(d):
    s = d["sekarang"]; st = s["status"]
    ikon = {"SIAGA": "\U0001F534", "WASPADA": "\U0001F7E1", "AMAN": "\U0001F7E2"}
    tanda = "\U0001F6A8" if st == "SIAGA" else "\u26A0\uFE0F"
    baris = ["%s PERINGATAN BANJIR - %s" % (tanda, d["nama_lokasi"]),
             "%s Tinggi air sekarang: %s cm (%s)" % (ikon.get(st, ""), s["tinggi_air_cm"], st)]
    if d.get("tipe") != "klasifikasi" and d.get("prediksi"):
        baris.append("")
        baris.append("\U0001F4CA Prediksi ke depan:")
        for h in ["1", "3", "6", "12", "24"]:
            pr = d["prediksi"].get(h, {})
            tinggi = pr.get("tinggi_air_cm")
            if tinggi is None:
                continue
            ic = ikon.get(pr.get("status"), "")
            label = "" if pr.get("keandalan") == "andal" else " *indikatif"
            baris.append("  %s %2s jam: %s cm (%s)%s" % (ic, h, tinggi, pr.get("status"), label))
        baris.append("")
        baris.append("* prediksi >3 jam bersifat indikatif")
    baris.append("\U0001F552 Waktu data: %s" % s["waktu_data"])
    return "\n".join(baris)

def pesan_turun(d, status_lama):
    s = d["sekarang"]; st = s["status"]
    ikon = {"SIAGA": "\U0001F534", "WASPADA": "\U0001F7E1", "AMAN": "\U0001F7E2"}
    return ("\u2705 STATUS MEREDA - %s\n%s Dari %s menjadi %s\n"
            "Tinggi air sekarang: %s cm\n\U0001F552 Waktu data: %s" % (
        d["nama_lokasi"], ikon.get(st, ""), status_lama, st, s["tinggi_air_cm"], s["waktu_data"]))

def cek_sekali(lokasi, mode, dry, terakhir):
    for lok in lokasi:
        d = prediksi(lok, mode)
        if not d.get("success"):
            print("  [lok %s] skip: %s" % (lok, d.get("message", "tidak ada data")))
            continue
        st = d["sekarang"]["status"]; nama = d["nama_lokasi"]; lama = terakhir.get(lok)
        if lama is None:
            terakhir[lok] = st
            print("  [lok %s] %s: baseline %s (tidak kirim)" % (lok, nama, st))
            continue
        if st == lama:
            print("  [lok %s] %s: tetap %s" % (lok, nama, st))
            continue
        naik = URUTAN.get(st, 0) > URUTAN.get(lama, 0)
        pesan = pesan_naik(d) if naik else pesan_turun(d, lama)
        arah = "NAIK" if naik else "TURUN"
        if dry:
            print("  [lok %s] %s: %s %s -> %s | AKAN DIKIRIM:\n%s\n" % (lok, nama, arah, lama, st, pesan))
        else:
            try:
                kirim_telegram(pesan)
                print("  [lok %s] %s: %s %s -> %s | terkirim" % (lok, nama, arah, lama, st))
            except Exception as e:
                print("  [lok %s] %s: gagal kirim: %s" % (lok, nama, e))
        terakhir[lok] = st

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="db", choices=["db", "demo"])
    ap.add_argument("--interval", type=int, default=3600)
    ap.add_argument("--lokasi", type=int, default=None, choices=[1, 2, 3])
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    lokasi = [a.lokasi] if a.lokasi else [1, 2, 3]
    print("=== SIGAP monitor START === mode=%s interval=%ss lokasi=%s dry=%s" % (a.mode, a.interval, lokasi, a.dry))
    print("(Ctrl+C untuk berhenti)\n")
    terakhir = {}
    try:
        while True:
            print("[%s] cek..." % time.strftime("%Y-%m-%d %H:%M:%S"))
            cek_sekali(lokasi, a.mode, a.dry, terakhir)
            time.sleep(a.interval)
    except KeyboardInterrupt:
        print("\n=== monitor dihentikan ===")

if __name__ == "__main__":
    main()
