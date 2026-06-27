#!/usr/bin/env python3
"""
crud.py - Operasi database async untuk bot SIGAP Banjir.

Dipakai bersama oleh bot.py (handler Telegram) dan scheduler (broadcast).
Semua fungsi memakai session dari db.Session.
"""
from sqlalchemy import select

from db import Session
from models import Preference, User

# Horizon prediksi yang didukung -> nama kolom di tabel preferences.
HORIZON = ["1h", "3h", "6h", "12h", "24h"]


def _kolom(horizon: str) -> str:
    """Ubah '3h' menjadi nama kolom 'notif_3h'. Lempar error bila tak valid."""
    if horizon not in HORIZON:
        raise ValueError(f"horizon tidak valid: {horizon}")
    return f"notif_{horizon}"


async def daftar_user(chat_id: int, username: str | None) -> bool:
    """
    Daftarkan user + preferensi default (semua True). Idempotent:
    aman dipanggil berkali-kali. Kembalikan True bila user baru dibuat.
    """
    async with Session() as s:
        ada = await s.scalar(select(User).where(User.chat_id == chat_id))
        if ada:
            # Perbarui username bila berubah.
            if username and ada.username != username:
                ada.username = username
                await s.commit()
            return False
        s.add(User(chat_id=chat_id, username=username))
        s.add(Preference(chat_id=chat_id))  # semua notif_* default True
        await s.commit()
        return True


async def ambil_preferensi(chat_id: int) -> Preference | None:
    async with Session() as s:
        return await s.scalar(select(Preference).where(Preference.chat_id == chat_id))


async def toggle_preferensi(chat_id: int, horizon: str) -> bool:
    """Balik nilai satu horizon, simpan, kembalikan nilai baru (True/False)."""
    kolom = _kolom(horizon)
    async with Session() as s:
        pref = await s.scalar(select(Preference).where(Preference.chat_id == chat_id))
        if pref is None:
            raise ValueError(f"preferensi untuk chat_id {chat_id} belum ada")
        baru = not getattr(pref, kolom)
        setattr(pref, kolom, baru)
        await s.commit()
        return baru


async def chat_ids_aktif(horizon: str) -> list[int]:
    """chat_id yang mengaktifkan notifikasi untuk horizon tertentu."""
    kolom = _kolom(horizon)
    async with Session() as s:
        rows = await s.scalars(
            select(Preference.chat_id).where(getattr(Preference, kolom).is_(True))
        )
        return list(rows)
