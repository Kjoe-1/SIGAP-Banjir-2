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
import penjadwal


async def susun_pesan() -> str:
    """Bangun pesan status sensor PER LOKASI (cek realtime tiap lokasi)."""
    baris = []
    for lok in penjadwal.LOKASI:
        d = await penjadwal.jalankan_prediksi(lok)
        st = penjadwal._sensor_status(d)
        ikon, ket = ("🟢", "aktif") if st == "online" else ("🔴", "offline")
        baris.append(f"{ikon} {penjadwal.NAMA_LOKASI.get(lok, f'Lok {lok}')} — {ket}")
    return (
        "⚠️ *Pemberitahuan Status Sensor — SIGAP Banjir*\n\n"
        "Status sensor saat ini:\n" + "\n".join(baris) + "\n\n"
        "Untuk lokasi yang *offline*, prediksi menampilkan *data terakhir* "
        "(bukan kondisi realtime). Data & notifikasi otomatis pulih begitu sensor "
        "online lagi — kamu juga akan diberi tahu otomatis saat itu.\n\n"
        "Terima kasih sudah mencoba bot SIGAP Banjir! \U0001F64F"
    )


async def main():
    token = os.environ.get("TELEGRAM_TOKEN", "").strip()
    if not token:
        raise SystemExit("TELEGRAM_TOKEN belum diisi di .env")
    bot = Bot(token)
    PESAN = await susun_pesan()
    print("Pesan yang akan dikirim:\n" + PESAN + "\n" + "-" * 40)
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
