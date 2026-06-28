#!/usr/bin/env python3
"""
umumkan.py - Kirim SATU pengumuman ke semua user terdaftar (sekali jalan).

Pakai untuk broadcast manual (mis. info sensor sedang offline).
Jalankan DI SERVER (tempat database bot/user berada):

    cd ~/sigap/ml && ../.venv/bin/python umumkan.py

Aman dijalankan walau bot sedang aktif (hanya kirim pesan, bukan polling).
Edit variabel PESAN di bawah sesuai kebutuhan.
"""
import asyncio
import os

from aiogram import Bot

import crud

PESAN = (
    "⚠️ *Pemberitahuan — Sensor sedang OFFLINE*\n\n"
    "Saat ini sensor IoT di lapangan sedang tidak mengirim data. Jadi prediksi "
    "di bot menampilkan *data terakhir yang tersedia*, bukan kondisi realtime.\n\n"
    "Notifikasi peringatan banjir otomatis akan *aktif kembali* begitu sensor "
    "online lagi. Kamu juga akan otomatis diberi tahu saat sensor sudah pulih.\n\n"
    "Terima kasih sudah mencoba bot SIGAP Banjir! \U0001F64F"
)


async def main():
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    if not token:
        raise SystemExit("TELEGRAM_TOKEN belum diisi di .env")
    bot = Bot(token)
    ids = await crud.semua_chat_ids()
    ok = 0
    for cid in ids:
        try:
            await bot.send_message(cid, PESAN, parse_mode="Markdown")
            ok += 1
        except Exception as e:
            print(f"  gagal kirim ke {cid}: {e}")
    print(f"Pengumuman terkirim ke {ok}/{len(ids)} user.")
    await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
