#!/usr/bin/env python3
"""
grafik.py - Pembuatan chart prediksi SIGAP Banjir.

Chart dibuat SEKALI tiap jam oleh scheduler dan disimpan sebagai
current_prediction.png. Bot tidak pernah merender on-demand; saat user minta
grafik, bot cukup mengirim file statis ini.

matplotlib bersifat blocking, jadi rendering dijalankan di thread terpisah
(asyncio.to_thread) agar tidak memblokir event loop bot.
"""
import asyncio
import io
import json
import logging
import os
import sys

import matplotlib

matplotlib.use("Agg")  # backend tanpa layar (server)
import matplotlib.pyplot as plt

log = logging.getLogger("sigap-grafik")

BASE = os.path.dirname(os.path.abspath(__file__))
CHART_PATH = os.path.join(BASE, "current_prediction.png")

JAM_X = [0, 1, 3, 6]  # 0 = sekarang
HKUNCI = ["1", "3", "6"]
WARNA = {"AMAN": "#2ecc71", "WASPADA": "#f1c40f", "SIAGA": "#e74c3c"}


def _ambil_seri(d: dict):
    """Dari hasil prediksi.py satu lokasi -> (x, y, warna_titik) untuk plot."""
    sek = d.get("sekarang") or {}
    y = [sek.get("tinggi_air_cm")]
    warna = [WARNA.get(sek.get("status"), "#95a5a6")]
    prediksi = d.get("prediksi") or {}
    for k in HKUNCI:
        pr = prediksi.get(k) or {}
        y.append(pr.get("tinggi_air_cm"))
        warna.append(WARNA.get(pr.get("status"), "#95a5a6"))
    return JAM_X, y, warna


def _render(hasil: dict, stempel: str):
    """Render figure (blocking). hasil = {lokasi: dict_prediksi}."""
    fig, ax = plt.subplots(figsize=(9, 5))
    ada_data = False
    for lok, d in sorted(hasil.items()):
        if not d.get("success"):
            continue
        x, y, warna = _ambil_seri(d)
        # hanya plot bila ada minimal satu nilai prediksi (lok3 klasifikasi: skip garis)
        if all(v is None for v in y[1:]):
            continue
        ada_data = True
        nama = d.get("nama_lokasi", f"Lok {lok}")
        sek = d.get("sekarang") or {}
        st = sek.get("status", "")
        wkt = str(sek.get("waktu_data", ""))[5:16]  # MM-DD HH:MM
        ax.plot(x, y, marker="o", linewidth=2, label=f"{nama} — {st} (data {wkt})", zorder=2)
        ax.scatter(x, y, c=warna, s=60, zorder=3, edgecolors="white")

    ax.set_title(f"Prediksi Tinggi Air SIGAP Banjir\nDibuat: {stempel}")
    ax.set_xlabel("Jam ke depan (dari pembacaan sensor terakhir)")
    ax.set_ylabel("Tinggi air (cm)")
    ax.set_xticks(JAM_X)
    ax.set_xticklabels(["sekarang", "1j", "3j", "6j"])
    ax.grid(True, alpha=0.3)
    if ada_data:
        from matplotlib.patches import Patch
        status_leg = [Patch(color=WARNA["AMAN"], label="AMAN"),
                      Patch(color=WARNA["WASPADA"], label="WASPADA"),
                      Patch(color=WARNA["SIAGA"], label="SIAGA")]
        h_line, _ = ax.get_legend_handles_labels()
        ax.legend(handles=h_line + status_leg, fontsize=8, ncol=2)
    else:
        ax.text(0.5, 0.5, "Tidak ada data prediksi", ha="center", va="center",
                transform=ax.transAxes)
    fig.tight_layout()
    fig.savefig(CHART_PATH, dpi=110)
    plt.close(fig)


async def perbarui_chart(hasil: dict | None = None):
    """
    Buat ulang current_prediction.png. Bila `hasil` None, ambil sendiri prediksi
    untuk semua lokasi (dipakai saat startup). Dipanggil scheduler tiap jam.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo

    import penjadwal  # impor lokal untuk hindari circular import

    if hasil is None:
        hasil = {lok: await penjadwal.jalankan_prediksi(lok) for lok in penjadwal.LOKASI}
    # Pakai WIB (Asia/Jakarta) agar cocok dgn data sensor, bukan zona server (UTC).
    stempel = datetime.now(ZoneInfo("Asia/Jakarta")).strftime("%Y-%m-%d %H:%M:%S WIB")
    await asyncio.to_thread(_render, hasil, stempel)
    log.info("[grafik] %s diperbarui (%s).", os.path.basename(CHART_PATH), stempel)


# ---------------------------------------------------------------------------
# Chart on-demand: perbandingan data historis (aktual) vs prediksi per horizon.
# Dipakai fitur interaktif "Prediksi Banjir" di bot. Dirender ke bytes (RAM),
# tidak ditulis ke disk, agar tidak bentrok antar-permintaan user.
# ---------------------------------------------------------------------------
def _render_banding(data: dict, horizon: int, seri: dict) -> bytes:
    waktu, aktual, pred = seri["waktu"], seri["aktual"], seri["prediksi"]
    x = list(range(len(waktu)))
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.plot(x, aktual, marker="o", ms=3, lw=2, color="#2980b9", label="Aktual (historis)")
    ax.plot(x, pred, marker="x", ms=5, lw=2, color="#e67e22", label=f"Prediksi {horizon} jam")

    # Garis ambang status (tinggi air = ref - jarak_ambang).
    ref, tw, ts = data.get("ref"), data.get("t_waspada"), data.get("t_siaga")
    if ref and tw:
        ax.axhline(ref - tw, color="#f1c40f", ls="--", lw=1, label="Ambang WASPADA")
    if ref and ts:
        ax.axhline(ref - ts, color="#e74c3c", ls="--", lw=1, label="Ambang SIAGA")

    n = len(x)
    if n:
        idx = sorted(set(int(i * (n - 1) / 5) for i in range(6)))
        ax.set_xticks(idx)
        ax.set_xticklabels([waktu[i][5:16] for i in idx], rotation=30, ha="right", fontsize=8)
    ax.set_title(f"{data.get('nama_lokasi')} — Aktual vs Prediksi {horizon} jam ke depan")
    ax.set_xlabel("Waktu (data historis)")
    ax.set_ylabel("Tinggi air (cm)")
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=8)
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    return buf.getvalue()


async def chart_banding(lok: int, horizon: int) -> bytes | None:
    """Render chart aktual-vs-prediksi (data demo historis) untuk satu lokasi & horizon."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "banding.py", "--lokasi", str(lok), "--max-points", "48",
        cwd=BASE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        data = json.loads(out.decode())
    except Exception:
        return None
    if not data.get("success"):
        return None
    seri = data.get(str(horizon))
    if not seri or not seri.get("waktu"):
        return None
    return await asyncio.to_thread(_render_banding, data, horizon, seri)


# Lookback (jam) untuk view realtime; cukup besar agar menangkap data sehat terakhir
# meski sensor sempat offline. Saat sensor live, "latest" = waktu sekarang.
LOOKBACK_VIEW = 336  # 14 hari


def _render_realtime(lok: int, horizon: int, pred_out: dict) -> bytes | None:
    """Bar perbandingan: tinggi air sekarang vs prediksi tiap horizon, diwarnai status."""
    from matplotlib.patches import Patch

    s = pred_out.get("sekarang") or {}
    pr = pred_out.get("prediksi") or {}
    amb = pred_out.get("ambang") or {}

    # Waktu acuan = data terakhir; tiap horizon ditampilkan beserta JAM AKTUALnya
    # (saran user: "+12 jam" langsung kelihatan jam berapa).
    from datetime import datetime, timedelta
    try:
        base_t = datetime.strptime(str(s.get("waktu_data"))[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        base_t = None

    def _lbl(prefix, off):
        return prefix if base_t is None else f"{prefix}\n{(base_t + timedelta(hours=off)):%H:%M}"

    # Urutan bar: histori lampau (aktual) -> Sekarang -> prediksi ke depan.
    histori = pred_out.get("histori") or []
    lampau = histori[:-1] if len(histori) > 1 else []  # entri terakhir = "sekarang"

    kat, nilai, status, jenis = [], [], [], []
    for hh in lampau:
        v = hh.get("tinggi_air_cm")
        if v is None:
            continue
        kat.append(str(hh.get("jam"))[11:16])  # HH:MM
        nilai.append(v)
        status.append(hh.get("status"))
        jenis.append("lampau")

    kat.append(_lbl("Sekarang", 0))
    nilai.append(s.get("tinggi_air_cm"))
    status.append(s.get("status"))
    jenis.append("sekarang")
    idx_now = len(kat) - 1

    sel_idx = None
    for h in (1, 3, 6):
        v = (pr.get(str(h)) or {}).get("tinggi_air_cm")
        if v is not None:
            kat.append(_lbl(f"+{h}j", h))
            nilai.append(v)
            status.append((pr.get(str(h)) or {}).get("status"))
            jenis.append("prediksi")
            if h == horizon:
                sel_idx = len(kat) - 1
    if nilai[idx_now] is None or sum(1 for n in nilai if n is not None) <= 1:
        return None

    warna = [WARNA.get(st, "#95a5a6") for st in status]
    fig, ax = plt.subplots(figsize=(11, 5))
    x = list(range(len(kat)))
    bars = ax.bar(x, nilai, color=warna, edgecolor="white", zorder=2)

    for i, (b, jn) in enumerate(zip(bars, jenis)):
        if jn == "lampau":            # aktual lampau: hatched + agak transparan
            b.set_alpha(0.55)
            b.set_hatch("//")
        if i == sel_idx:              # horizon yang dipilih: border tebal
            b.set_edgecolor("#2c3e50")
            b.set_linewidth(3)
    for b, v in zip(bars, nilai):
        if v is not None:
            ax.text(b.get_x() + b.get_width() / 2, v, f"{v:g}",
                    ha="center", va="bottom", fontsize=8)

    # Garis pemisah "lampau | prediksi" (tepat setelah Sekarang).
    ax.axvline(idx_now + 0.5, color="#7f8c8d", ls=":", lw=1.2)

    hw, hs = amb.get("waspada"), amb.get("siaga")
    if hw is not None:
        ax.axhline(hw, color="#f1c40f", ls="--", lw=1.2, label=f"Ambang WASPADA ({hw:g} cm)")
    if hs is not None:
        ax.axhline(hs, color="#e74c3c", ls="--", lw=1.2, label=f"Ambang SIAGA ({hs:g} cm)")

    ax.set_xticks(x)
    ax.set_xticklabels(kat, fontsize=8)
    ax.set_title(f"{pred_out.get('nama_lokasi', '')} — Tren & Prediksi Tinggi Air")
    ax.set_ylabel("Tinggi air (cm)")
    ax.set_xlabel("← aktual (lampau)   |   Sekarang   |   prediksi →")
    ymax = max([v for v in nilai if v is not None] + [hw or 0, hs or 0]) * 1.18
    ax.set_ylim(0, ymax)
    ax.grid(True, axis="y", alpha=0.3)

    leg = [Patch(color=WARNA["AMAN"], label="AMAN"),
           Patch(color=WARNA["WASPADA"], label="WASPADA"),
           Patch(color=WARNA["SIAGA"], label="SIAGA"),
           Patch(facecolor="#bbbbbb", hatch="//", alpha=0.55, label="Aktual (lampau)")]
    h_line, _ = ax.get_legend_handles_labels()
    ax.legend(handles=leg + h_line, fontsize=8, ncol=2)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    return buf.getvalue()


async def chart_realtime(lok: int, horizon: int, pred_out: dict) -> bytes | None:
    """Versi async dari chart realtime (rendering di thread terpisah)."""
    return await asyncio.to_thread(_render_realtime, lok, horizon, pred_out)
