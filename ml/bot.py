#!/usr/bin/env python3
"""
bot.py - Bot Telegram SIGAP Banjir (aiogram v3, async).

Handler:
  /start    -> daftarkan user + preferensi default.
  /settings -> menu inline keyboard untuk toggle notifikasi per horizon.

Jalankan:
  cd ml && python bot.py     # butuh TELEGRAM_TOKEN di .env

Scheduler & pengiriman chart ditambahkan pada langkah berikutnya.
"""
import asyncio
import json
import logging
import os
import sys

import os.path as _osp

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import (
    BotCommand, BufferedInputFile, CallbackQuery, FSInputFile, InlineKeyboardButton,
    InlineKeyboardMarkup, KeyboardButton, Message, ReplyKeyboardMarkup,
)

import config
import crud
import grafik
import penjadwal
from db import init_db

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("sigap-bot")

TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
BASE = _osp.dirname(_osp.abspath(__file__))

# Label horizon untuk tampilan tombol.
LABEL = {"1h": "1 jam", "3h": "3 jam", "6h": "6 jam", "12h": "12 jam", "24h": "24 jam"}

# Teks tombol keyboard permanen (user cukup pencet, tidak perlu ngetik).
BTN_PREDIKSI = "\U0001F52E Prediksi Banjir"
BTN_SETTINGS = "⚙️ Pengaturan Notifikasi"
BTN_GRAFIK = "📊 Grafik Ringkasan"

# Info lokasi untuk tampilan bot: nama lengkap + koordinat + link Google Maps.
# Penomoran IKUT website/ML: 1=Pucanganom, 2=UHT, 3=Kalikobor.
LOKASI_INFO = {
    1: {
        "nama": "Rumah Pompa Pucanganom",
        "lat": -7.2869071, "lon": 112.7556923,
        "gmaps": "https://maps.app.goo.gl/FrhCdCKJsPzVRGR38?g_st=ipc",
    },
    2: {
        "nama": "Universitas Hang Tuah",
        "lat": -7.290778, "lon": 112.793278,
        "gmaps": "https://maps.app.goo.gl/sHC2Bc7cnS8ygF4r9?g_st=ipc",
    },
    3: {
        "nama": "Rumah Pompa Kalibokor",
        "lat": -7.285000, "lon": 112.802806,
        "gmaps": "https://maps.app.goo.gl/peVmaRBTupxcGgvK6?g_st=ipc",
    },
}
# Urutan tampil di menu: UHT (tervalidasi), Kalibokor, Pucanganom.
LOKASI_PREDIKSI = [2, 3, 1]
JAM_PILIHAN = [1, 3, 6, 12, 24]

dp = Dispatcher()


async def prediksi_realtime(lok: int) -> dict:
    """Jalankan prediksi.py mode db (data sensor asli, anchor=data terakhir)."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "prediksi.py", "--lokasi", str(lok),
        "--mode", "db", "--anchor", "latest", "--lookback", str(grafik.LOOKBACK_VIEW),
        cwd=BASE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        return json.loads(out.decode())
    except Exception:
        return {"success": False}


def menu_utama() -> ReplyKeyboardMarkup:
    """Keyboard permanen di bawah kolom chat. Selalu terlihat, tinggal dipencet."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=BTN_PREDIKSI)],
            [KeyboardButton(text=BTN_SETTINGS), KeyboardButton(text=BTN_GRAFIK)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Pilih menu di bawah \U0001F447",
    )


def keyboard_lokasi() -> InlineKeyboardMarkup:
    """Pilihan lokasi untuk fitur Prediksi Banjir."""
    baris = [[InlineKeyboardButton(
        text=LOKASI_INFO[lok]["nama"], callback_data=f"predlok:{lok}",
    )] for lok in LOKASI_PREDIKSI]
    return InlineKeyboardMarkup(inline_keyboard=baris)


def teks_lokasi(lok: int) -> str:
    """Detail lokasi: nama lengkap, koordinat, link Google Maps."""
    info = LOKASI_INFO[lok]
    return (
        f"\U0001F4CD {info['nama']}\n"
        f"Latitude: {info['lat']:.6f}\n"
        f"Longitude: {info['lon']:.6f}\n"
        f"\U0001F5FA️ {info['gmaps']}"
    )


def teks_ambang() -> str:
    """Penjelasan arti status + ambang tiap lokasi (dinamis dari config.AMBANG_TINGGI)."""
    baris = [
        "\U0001F4CA *Arti status:*",
        "🟢 *AMAN* — di bawah ambang waspada (normal)",
        "🟡 *WASPADA* — mendekati batas, mulai siaga",
        "🔴 *SIAGA* — capai ambang siaga, potensi banjir",
        "",
        "Ambang beda tiap lokasi (dimensi saluran beda):",
    ]
    for lok in LOKASI_PREDIKSI:
        amb = config.AMBANG_TINGGI.get(lok)
        if amb:
            baris.append(f"• {LOKASI_INFO[lok]['nama']}: WASPADA ≥{amb['waspada']} / SIAGA ≥{amb['siaga']} cm")
    return "\n".join(baris)


def keyboard_jam(lok: int) -> InlineKeyboardMarkup:
    """Pilihan horizon (jam) setelah lokasi dipilih."""
    tombol = [InlineKeyboardButton(text=f"{h} jam", callback_data=f"predjam:{lok}:{h}")
              for h in JAM_PILIHAN]
    # susun 2 tombol per baris biar rapi
    baris = [tombol[i:i + 2] for i in range(0, len(tombol), 2)]
    return InlineKeyboardMarkup(inline_keyboard=baris)


def format_status_saja(d: dict, lok: int) -> str:
    """Untuk lokasi klasifikasi (mis. Pucanganom): status sekarang tanpa prediksi."""
    s = d["sekarang"]
    ik = penjadwal.IKON
    return (
        f"\U0001F4CD {LOKASI_INFO[lok]['nama']}\n"
        f"{ik.get(s['status'], '')} Status sekarang: {s['status']}\n"
        f"\U0001F4A7 Tinggi air: {s['tinggi_air_cm']} cm\n"
        f"\U0001F552 Data sensor terakhir: {s['waktu_data']}\n"
        f"ℹ️ Lokasi ini hanya monitoring status (tanpa prediksi ke depan).\n"
        f"\U0001F5FA️ {LOKASI_INFO[lok]['gmaps']}"
    )


def format_prediksi(d: dict, horizon: int, lok: int) -> str:
    s = d["sekarang"]
    pr = (d.get("prediksi") or {}).get(str(horizon), {})
    ik = penjadwal.IKON
    nama = LOKASI_INFO[lok]["nama"]
    teks = (
        f"\U0001F4CD {nama}\n"
        f"{ik.get(s['status'], '')} Tinggi air sekarang: {s['tinggi_air_cm']} cm ({s['status']})\n"
    )
    if pr.get("tinggi_air_cm") is not None:
        lab = "" if pr.get("keandalan") == "andal" else " (indikatif)"
        teks += (f"\U0001F52E Prediksi {horizon} jam ke depan: "
                 f"{pr['tinggi_air_cm']} cm ({pr['status']}){lab}\n")
    teks += f"\U0001F552 Data sensor terakhir: {s['waktu_data']}\n"
    teks += f"\U0001F5FA️ {LOKASI_INFO[lok]['gmaps']}"
    return teks


def keyboard_settings(pref) -> InlineKeyboardMarkup:
    """Bangun inline keyboard dari objek Preference (1 tombol per horizon)."""
    baris = []
    for h in crud.HORIZON:
        aktif = getattr(pref, f"notif_{h}")
        tanda = "✅" if aktif else "❌"  # ✅ / ❌
        baris.append([InlineKeyboardButton(
            text=f"{tanda} {LABEL[h]}",
            callback_data=f"toggle:{h}",
        )])
    return InlineKeyboardMarkup(inline_keyboard=baris)


@dp.message(Command("start"))
async def handle_start(message: Message):
    chat_id = message.chat.id
    username = message.from_user.username if message.from_user else None
    baru = await crud.daftar_user(chat_id, username)
    sambutan = (
        "\U0001F30A *SIGAP Banjir* — Sistem prediksi banjir di Surabaya.\n\n"
        "Bot ini memantau *tinggi muka air (cm)* dari sensor IoT, lalu memprediksi "
        "potensi banjir di lokasi berikut:\n"
        "\U0001F4CD Universitas Hang Tuah — sungai\n"
        "\U0001F4CD Rumah Pompa Kalibokor — saluran/rumah pompa\n"
        "\U0001F4CD Rumah Pompa Pucanganom — saluran/rumah pompa\n\n"
        + teks_ambang() + "\n\n"
        "Yang bisa kamu lakukan:\n"
        "\U0001F52E *Prediksi Banjir* — pilih lokasi & rentang waktu (1–24 jam), "
        "lihat tinggi air sekarang + grafik prediksi.\n"
        "⚙️ *Pengaturan Notifikasi* — atur peringatan otomatis yang ingin diterima.\n"
        "\U0001F4CA *Grafik Ringkasan* — ringkasan prediksi semua lokasi.\n\n"
    )
    if baru:
        teks = sambutan + (
            "Kamu sudah terdaftar dan akan menerima peringatan banjir otomatis. "
            "Pencet tombol di bawah \U0001F447 untuk mulai."
        )
    else:
        teks = sambutan + (
            "Selamat datang kembali \U0001F44B Pencet tombol di bawah \U0001F447 untuk mulai."
        )
    await message.answer(teks, reply_markup=menu_utama(), parse_mode="Markdown")


async def _kirim_settings(message: Message):
    """Logika menu pengaturan, dipakai oleh /settings dan tombol keyboard."""
    chat_id = message.chat.id
    pref = await crud.ambil_preferensi(chat_id)
    if pref is None:
        # User belum /start -> daftarkan dulu.
        await crud.daftar_user(chat_id, message.from_user.username if message.from_user else None)
        pref = await crud.ambil_preferensi(chat_id)
    await message.answer(
        "\U0001F514 Pengaturan Notifikasi\n"
        "Ketuk horizon untuk mengaktifkan/menonaktifkan:",
        reply_markup=keyboard_settings(pref),
    )


async def _kirim_grafik(message: Message):
    """Kirim file chart statis. Dipakai oleh /grafik dan tombol keyboard."""
    if not _osp.exists(grafik.CHART_PATH):
        await message.answer("Grafik belum tersedia, coba lagi sebentar lagi. ⏳")
        return
    await message.answer_photo(
        FSInputFile(grafik.CHART_PATH),
        caption="\U0001F4CA Prediksi tinggi air terbaru (diperbarui tiap jam).",
    )


@dp.message(Command("settings"))
async def handle_settings(message: Message):
    await _kirim_settings(message)


@dp.message(Command("grafik"))
async def handle_grafik(message: Message):
    await _kirim_grafik(message)


@dp.message(Command("test_notif"))
async def handle_test_notif(message: Message):
    """Kirim contoh notifikasi (untuk demo/seminar saat sensor offline)."""
    contoh = (
        "\U0001F6A8 [CONTOH] PERINGATAN BANJIR - Universitas Hang Tuah\n"
        "\U0001F534 Prediksi 3 jam ke depan: 290 cm (SIAGA)\n"
        "\U0001F552 Berdasarkan data: (contoh)\n\n"
        "ℹ️ Ini notifikasi contoh. Notifikasi asli dikirim OTOMATIS "
        "saat sensor mendeteksi air naik ke WASPADA/SIAGA."
    )
    await message.answer(contoh)


async def _mulai_prediksi(message: Message):
    """Langkah 1 fitur prediksi: minta user pilih lokasi."""
    await message.answer(
        "\U0001F52E Prediksi Banjir\nPilih lokasi yang ingin kamu lihat:",
        reply_markup=keyboard_lokasi(),
    )


@dp.message(Command("prediksi"))
async def handle_prediksi(message: Message):
    await _mulai_prediksi(message)


# Tombol keyboard permanen -> jalankan aksi yang sama dengan perintahnya.
@dp.message(F.text == BTN_PREDIKSI)
async def handle_btn_prediksi(message: Message):
    await _mulai_prediksi(message)


@dp.message(F.text == BTN_SETTINGS)
async def handle_btn_settings(message: Message):
    await _kirim_settings(message)


@dp.message(F.text == BTN_GRAFIK)
async def handle_btn_grafik(message: Message):
    await _kirim_grafik(message)


@dp.callback_query(F.data.startswith("predlok:"))
async def handle_pilih_lokasi(cq: CallbackQuery):
    """Langkah 2: lokasi dipilih. Klasifikasi -> status saja; lainnya -> pilih horizon."""
    lok = int(cq.data.split(":", 1)[1])
    if config.LOKASI[lok]["tipe"] == "klasifikasi":
        # Lok3/Pucanganom: tidak ada forecast -> tampilkan status sekarang saja.
        await cq.answer("Mengambil status... ⏳")
        d = await prediksi_realtime(lok)
        if not d.get("success"):
            await cq.message.answer(
                f"{teks_lokasi(lok)}\n\n"
                "⚠️ Sensor sedang offline, status terkini belum tersedia."
            )
            return
        await cq.message.answer(format_status_saja(d, lok))
        return
    await cq.message.edit_text(
        f"{teks_lokasi(lok)}\n\nMau prediksi banjir berapa jam ke depan?",
        reply_markup=keyboard_jam(lok),
    )
    await cq.answer()


@dp.callback_query(F.data.startswith("predjam:"))
async def handle_pilih_jam(cq: CallbackQuery):
    """Langkah 3: horizon dipilih -> kirim teks + grafik realtime (data sensor asli)."""
    _, lok, h = cq.data.split(":")
    lok, h = int(lok), int(h)
    await cq.answer("Menyiapkan prediksi... ⏳")
    d = await prediksi_realtime(lok)
    if not d.get("success"):
        await cq.message.answer(
            f"Maaf, data sensor {LOKASI_INFO[lok]['nama']} sedang tidak tersedia "
            "(sensor kemungkinan offline). Coba lokasi lain atau cek lagi nanti."
        )
        return
    teks = format_prediksi(d, h, lok)
    d["nama_lokasi"] = LOKASI_INFO[lok]["nama"]  # nama lengkap utk judul chart
    png = await grafik.chart_realtime(lok, h, d)
    if png:
        await cq.message.answer_photo(
            BufferedInputFile(png, filename="prediksi.png"), caption=teks,
        )
    else:
        await cq.message.answer(teks)


@dp.callback_query(F.data.startswith("toggle:"))
async def handle_toggle(cq: CallbackQuery):
    horizon = cq.data.split(":", 1)[1]
    chat_id = cq.message.chat.id
    try:
        baru = await crud.toggle_preferensi(chat_id, horizon)
    except ValueError:
        await cq.answer("Terjadi kesalahan, coba /start lagi.", show_alert=True)
        return
    pref = await crud.ambil_preferensi(chat_id)
    await cq.message.edit_reply_markup(reply_markup=keyboard_settings(pref))
    status = "diaktifkan" if baru else "dimatikan"
    await cq.answer(f"Notifikasi {LABEL[horizon]} {status}.")


async def main():
    if not TOKEN or TOKEN == "ISI_TOKEN_BOT_DISINI":
        raise SystemExit(
            "TELEGRAM_TOKEN belum diisi di .env. Isi token bot dari @BotFather dulu."
        )
    await init_db()
    bot = Bot(TOKEN)
    # Daftar perintah -> muncul di tombol "menu" (/) Telegram, lengkap dgn deskripsi.
    await bot.set_my_commands([
        BotCommand(command="start", description="Mulai & daftar notifikasi"),
        BotCommand(command="prediksi", description="Lihat prediksi banjir + grafik"),
        BotCommand(command="settings", description="Atur horizon notifikasi"),
        BotCommand(command="grafik", description="Grafik ringkasan terbaru"),
    ])
    await grafik.perbarui_chart()  # chart awal agar /grafik langsung tersedia
    penjadwal.pasang_penjadwal(bot)  # interval dari .env (INTERVAL_MENIT), default 60
    log.info("Bot SIGAP Banjir mulai polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
