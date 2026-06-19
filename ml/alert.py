#!/usr/bin/env python3
import argparse, json, os, sys, subprocess
import urllib.request, urllib.parse
TOKEN   = os.environ.get("TELEGRAM_TOKEN",   "ISI")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "ISI")
BASE = os.path.dirname(os.path.abspath(__file__))
def prediksi(lok, mode):
    r = subprocess.run([sys.executable, "prediksi.py", "--lokasi", str(lok), "--mode", mode],
                       capture_output=True, text=True, cwd=BASE)
    try: return json.loads(r.stdout)
    except Exception: return {"success": False, "message": r.stdout or r.stderr}
def kirim_telegram(teks):
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": teks, "parse_mode": "HTML"}).encode()
    with urllib.request.urlopen(url, data=data, timeout=15) as resp:
        return json.loads(resp.read().decode())
def susun_pesan(d):
    p = d["peringatan"]; s = d["sekarang"]
    ikon = {"SIAGA": "🔴", "WASPADA": "🟡", "AMAN": "🟢"}
    tanda = "🚨" if p["status"] == "SIAGA" else "⚠️"
    em = ikon.get(s["status"], "")
    baris = ["%s PERINGATAN BANJIR - %s" % (tanda, d["nama_lokasi"]),
             "%s Tinggi air sekarang: %s cm (%s)" % (em, s["tinggi_air_cm"], s["status"])]
    if d["tipe"] != "klasifikasi":
        baris.append("")
        baris.append("📊 Prediksi ke depan:")
        for h in ["1", "3", "6", "12", "24"]:
            pr = d["prediksi"].get(h, {})
            tinggi = pr.get("tinggi_air_cm")
            if tinggi is None:
                continue
            ic = ikon.get(pr.get("status"), "")
            label = "" if pr.get("keandalan") == "andal" else " *indikatif"
            baris.append("  %s %2s jam: %s cm (%s)%s" % (ic, h, tinggi, pr.get("status"), label))
        baris.append("")
        baris.append("ℹ️ prediksi >3 jam bersifat indikatif")
    baris.append("🕒 Waktu data: %s" % s["waktu_data"])
    return "\n".join(baris)
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="db", choices=["db", "demo"])
    ap.add_argument("--lokasi", type=int, default=None, choices=[1,2,3])
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    lokasi = [a.lokasi] if a.lokasi else [1,2,3]
    for lok in lokasi:
        d = prediksi(lok, a.mode)
        if not d.get("success"):
            print(f"[lok {lok}] skip: {d.get('message','tidak ada data')}"); continue
        if d["peringatan"]["ada"]:
            pesan = susun_pesan(d)
            if a.dry: print(f"--- [lok {lok}] AKAN DIKIRIM ---\n{pesan}\n")
            else:
                try: kirim_telegram(pesan); print(f"[lok {lok}] alert terkirim ke Telegram")
                except Exception as e: print(f"[lok {lok}] gagal kirim: {e}")
        else:
            print(f"[lok {lok}] aman, tidak ada peringatan")
if __name__ == "__main__":
    main()
