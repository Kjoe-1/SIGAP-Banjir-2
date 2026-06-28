#!/usr/bin/env python3
"""
uji_sensor.py - Uji fitur notif sensor mati/hidup (kirim pesan ASLI ke ADMIN saja).

Mensimulasikan transisi sensor online -> offline -> online dan memanggil
fungsi NOTIF ASLI (penjadwal._cek_transisi_sensor). Pesan hanya dikirim ke
admin (TELEGRAM_CHAT_ID di .env), jadi user lain tidak terganggu.

Jalankan di server:
    cd ~/sigap/ml && ../.venv/bin/python uji_sensor.py

Lalu cek Telegram admin: harus ada 2 pesan (⚠️ offline + ✅ aktif kembali).
Ini membuktikan jalur notif otomatis berfungsi end-to-end.
"""
import asyncio
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from aiogram import Bot

import crud
import penjadwal

ADMIN = int((os.environ.get("TELEGRAM_CHAT_ID", "0") or "0").strip())


async def main():
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    if not token or not ADMIN:
        raise SystemExit("TELEGRAM_TOKEN / TELEGRAM_CHAT_ID belum diisi di .env")

    bot = Bot(token)

    # Batasi broadcast HANYA ke admin selama uji (override sementara).
    async def hanya_admin():
        return [ADMIN]
    crud.semua_chat_ids = hanya_admin

    penjadwal._sensor_state.clear()
    now = datetime.now(ZoneInfo("Asia/Jakarta")).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")
    online = {"success": True, "sekarang": {"waktu_data": now}}
    offline = {"success": False}

    print("1) baseline online (harus DIAM)...")
    await penjadwal._cek_transisi_sensor(bot, 2, online)
    print("2) online -> OFFLINE (harus KIRIM ⚠️)...")
    await penjadwal._cek_transisi_sensor(bot, 2, offline)
    print("3) OFFLINE -> online (harus KIRIM ✅)...")
    await penjadwal._cek_transisi_sensor(bot, 2, online)

    await bot.session.close()
    print(f"\nSelesai. Cek Telegram admin ({ADMIN}) — harus ada 2 pesan: offline + aktif kembali.")


if __name__ == "__main__":
    asyncio.run(main())
