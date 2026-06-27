#!/usr/bin/env python3
"""
penjadwal.py - Scheduler latar belakang untuk bot SIGAP Banjir (APScheduler).

Job tiap jam:
  1. Jalankan prediksi.py per lokasi (drop-in untuk data IoT realtime).
  2. Untuk tiap horizon (1/3/6/12/24 jam) yang diprediksi WASPADA/SIAGA,
     ambil chat_id yang mengaktifkan notif horizon itu (crud.chat_ids_aktif),
     lalu broadcast peringatan.
  3. Anti-spam: kirim HANYA saat status horizon itu NAIK (transisi), bukan
     tiap jam selama masih berbahaya.

Chart (current_prediction.png) ditambahkan pada langkah berikutnya.
"""
import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

import crud
import grafik

log = logging.getLogger("sigap-penjadwal")

BASE = os.path.dirname(os.path.abspath(__file__))
LOKASI = [1, 2, 3]
MODE = os.environ.get("MODE_PREDIKSI", "demo")  # 'demo' (CSV) atau 'db' (MySQL realtime)
# Interval cek (menit). Default 60. Turunkan saat testing, mis. 15.
INTERVAL_MENIT = int(os.environ.get("INTERVAL_MENIT", "60"))
# Notifikasi hanya dikirim bila data sensor lebih baru dari sekian jam (anti
# alarm-palsu saat sensor offline). Chart tetap tampil data terakhir.
MAX_UMUR_NOTIF_JAM = int(os.environ.get("MAX_UMUR_NOTIF_JAM", "6"))

STATUS_URUT = {"AMAN": 0, "WASPADA": 1, "SIAGA": 2}
IKON = {"SIAGA": "\U0001F534", "WASPADA": "\U0001F7E1", "AMAN": "\U0001F7E2"}
# horizon bot ('3h') -> kunci di JSON prediksi.py ('3')
HJAM = {"1h": "1", "3h": "3", "6h": "6", "12h": "12", "24h": "24"}

# Anti-spam: status terakhir yang sudah di-broadcast, per (lokasi, horizon).
_status_terakhir: dict[tuple[int, str], str] = {}


async def jalankan_prediksi(lok: int) -> dict:
    """Panggil prediksi.py secara async (tidak memblokir event loop)."""
    args = [sys.executable, "prediksi.py", "--lokasi", str(lok), "--mode", MODE]
    if MODE == "db":
        # Ambil data ASLI terbaru yang tersedia (bukan demo 2025).
        args += ["--anchor", "latest", "--lookback", str(grafik.LOOKBACK_VIEW)]
    proc = await asyncio.create_subprocess_exec(
        *args, cwd=BASE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    try:
        return json.loads(out.decode())
    except Exception:
        return {"success": False, "message": (out or err).decode(errors="replace").strip()}


def pesan_peringatan(d: dict, horizon: str, pr: dict) -> str:
    nama = d.get("nama_lokasi", "?")
    st = pr.get("status")
    tanda = "\U0001F6A8" if st == "SIAGA" else "⚠️"
    label = "" if pr.get("keandalan") == "andal" else " (indikatif)"
    jam = HJAM[horizon]
    return (
        f"{tanda} PERINGATAN BANJIR - {nama}\n"
        f"{IKON.get(st, '')} Prediksi {jam} jam ke depan: "
        f"{pr.get('tinggi_air_cm')} cm ({st}){label}\n"
        f"\U0001F552 Berdasarkan data: {d.get('sekarang', {}).get('waktu_data', '-')}"
    )


def _data_segar(d: dict) -> bool:
    """True bila data sensor masih baru (< MAX_UMUR_NOTIF_JAM). Cegah alarm palsu."""
    w = (d.get("sekarang") or {}).get("waktu_data")
    if not w:
        return False
    try:
        t = datetime.strptime(str(w)[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return False
    # "Sekarang" dalam WIB (cocok dgn data sensor), bukan zona server (UTC).
    now = datetime.now(ZoneInfo("Asia/Jakarta")).replace(tzinfo=None)
    umur_jam = (now - t).total_seconds() / 3600
    return 0 <= umur_jam <= MAX_UMUR_NOTIF_JAM


async def _broadcast(bot, chat_ids: list[int], teks: str):
    for cid in chat_ids:
        try:
            await bot.send_message(cid, teks)
        except Exception as e:  # user blokir bot / chat tak ditemukan, dll.
            log.warning("gagal kirim ke %s: %s", cid, e)


async def cek_dan_broadcast(bot):
    """Job utama: dipanggil scheduler tiap jam."""
    log.info("[penjadwal] mulai cek prediksi (mode=%s)...", MODE)
    hasil: dict[int, dict] = {}
    for lok in LOKASI:
        d = await jalankan_prediksi(lok)
        hasil[lok] = d
        if not d.get("success"):
            log.info("  [lok %s] skip: %s", lok, d.get("message", "tidak ada data"))
            continue
        # Notifikasi hanya untuk data segar (sensor aktif). Chart tetap dibuat
        # dari data terakhir di bawah, apa pun umur datanya.
        if not _data_segar(d):
            log.info("  [lok %s] data lama (%s) -> chart saja, tidak notif",
                     lok, (d.get("sekarang") or {}).get("waktu_data"))
            continue
        prediksi = d.get("prediksi") or {}
        for horizon in crud.HORIZON:
            pr = prediksi.get(HJAM[horizon]) or {}
            st = pr.get("status")
            if st is None:
                continue  # lok3/klasifikasi: tidak ada prediksi horizon
            kunci = (lok, horizon)
            lama = _status_terakhir.get(kunci)
            naik = STATUS_URUT.get(st, 0) > STATUS_URUT.get(lama or "AMAN", 0)
            _status_terakhir[kunci] = st
            # Broadcast hanya saat NAIK ke WASPADA/SIAGA (anti-spam transisi).
            if st in ("WASPADA", "SIAGA") and naik:
                chat_ids = await crud.chat_ids_aktif(horizon)
                if chat_ids:
                    await _broadcast(bot, chat_ids, pesan_peringatan(d, horizon, pr))
                    log.info("  [lok %s] %s -> broadcast %s ke %d user",
                             lok, horizon, st, len(chat_ids))
    # Chart dibuat sekali per putaran job (pakai ulang data di atas, tanpa fetch ulang).
    await grafik.perbarui_chart(hasil)


def pasang_penjadwal(bot, interval_menit: int | None = None) -> AsyncIOScheduler:
    """Buat & start scheduler di event loop yang sedang berjalan."""
    menit = interval_menit or INTERVAL_MENIT
    sched = AsyncIOScheduler()
    # Tanpa next_run_time=None (itu malah membuat job PAUSED/tak pernah jalan).
    # Trigger interval otomatis menjadwalkan run pertama = sekarang + interval.
    sched.add_job(cek_dan_broadcast, "interval", minutes=menit,
                  args=[bot], id="cek_banjir")
    sched.start()
    log.info("[penjadwal] aktif, cek tiap %d menit (mode=%s).", menit, MODE)
    return sched
