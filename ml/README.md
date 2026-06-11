# Paket ML SIGAP Banjir — Prediksi Status (3 Lokasi)

Modul Machine Learning untuk prediksi status banjir dari tinggi muka air.
Status (aman → bahaya): **AMAN → WASPADA → SIAGA**.

## Untuk Kenny (frontend) — yang perlu kamu tahu

**Cara panggil:** satu script, parameter `--lokasi`:
```bash
python prediksi.py --lokasi 1 --mode demo
python prediksi.py --lokasi 2 --mode demo
python prediksi.py --lokasi 3 --mode demo
```
Output = **JSON seragam** untuk ketiga lokasi (lihat skema di bawah).

**Wiring di server.js** (endpoint per-lokasi):
```js
const { execFile } = require("child_process");
const path = require("path");
const ML_DIR = path.join(__dirname, "ml");

app.get("/api/prediksi", (req, res) => {
  const lokasi = req.query.lokasi || "1";           // /api/prediksi?lokasi=2
  const args = ["prediksi.py", "--lokasi", String(lokasi), "--mode", "demo"];
  execFile("python", args, { cwd: ML_DIR, timeout: 30000 }, (err, stdout) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal prediksi" });
    try { res.json(JSON.parse(stdout)); }
    catch { res.status(500).json({ success: false, message: "Output tidak valid" }); }
  });
});
```
Dashboard tinggal fetch `/api/prediksi?lokasi=1` (atau 2, 3).

## Skema JSON (kontrak data)
```json
{
  "success": true,
  "lokasi": 1,
  "nama_lokasi": "UHT",
  "tipe": "forecast_hujan",
  "sekarang":  { "waktu_data": "...", "distance_cm": 347.3, "tinggi_air_cm": 118.7, "status": "WASPADA" },
  "prediksi":  {
    "1":  { "jam_ke_depan": 1, "tinggi_air_cm": 116.0, "status": "WASPADA", "confidence": 1.0, "keandalan": "andal" },
    "3":  { ... }, "6": { ... }, "12": { ... }, "24": { ... }
  },
  "peringatan": { "ada": true, "status": "WASPADA", "dalam_jam": 1, "pesan": "Diprediksi WASPADA dalam 1 jam ..." },
  "catatan": "..."
}
```
Field `keandalan` per prediksi: `andal` | `indikatif` | `tidak_tersedia`. **Tampilkan badge sesuai keandalan** (mis. yang `indikatif` dikasih label "indikatif").

## Keandalan per lokasi (PENTING — jangan disamakan)

| Lokasi | Tipe | Forecasting | Catatan |
|---|---|---|---|
| **1 — UHT** | `forecast_hujan` | **Andal** (recall bahaya 1j ≈ 93%) | Badan air alami, digerakkan hujan |
| **2 — Kalikobor** | `forecast_tren` | **Indikatif** (recall bahaya ≈ 27%) | Rumah pompa; pompa tak terobservasi |
| **3 — Pucanganom** | `klasifikasi` | **Tidak ada** | Data ~10 hari → hanya status saat ini |

## Mode realtime (DB) — langkah berikutnya
Saat ini hanya `--mode demo` (replay data historis) yang aktif — cukup untuk demo & wiring dashboard.
Mode `db` (tarik realtime dari MySQL) adalah integrasi lanjutan (bareng Bintang). Skema per lokasi:
loc1 = `dbpvwemon` (esp2+esp3), loc2 = `dbpvwemonbaru` (esp1), loc3 = `dbpvwemonbaru2` (esp1).

## Catatan kejujuran
- Threshold status diturunkan dari sebaran data (data-driven). **Perlu konfirmasi angka resmi dari Tim Sipil** (tinggi muka air banjir per lokasi) untuk validitas lebih tinggi.
- Latih ulang model: `python latih_model.py`.

## Isi paket
```
ml/
├── prediksi.py          <- interface utama (output JSON)
├── latih_model.py       <- latih ulang model lok1 & lok2
├── config.py            <- konfigurasi & threshold per lokasi
├── requirements.txt
├── model/               <- lok1.pkl, lok2.pkl, lok3_meta.json
└── data/                <- data demo per lokasi
```
