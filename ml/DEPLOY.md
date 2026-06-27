# Deploy Bot Telegram SIGAP Banjir (venv + systemd)

Panduan deploy bot 24/7 di server Linux. Bot ini TERPISAH dari website Node.js
(proses sendiri), hanya berbagi `prediksi.py` (read-only).

> Ganti `/path/ke/SIGAP-Banjir-2` dan `GANTI_USER` sesuai server-mu.

## 1. Salin project ke server

```bash
# contoh via git atau scp; pastikan folder ml/ ikut
cd /path/ke/SIGAP-Banjir-2
```

## 2. Buat virtual environment + install dependensi

```bash
cd /path/ke/SIGAP-Banjir-2
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r ml/requirements.txt
# cek path python venv (untuk service file):
which python      # -> /path/ke/SIGAP-Banjir-2/.venv/bin/python
```

## 3. Konfigurasi .env

```bash
cp ml/.env.example ml/.env
nano ml/.env
```
Isi minimal:
- `TELEGRAM_TOKEN` — token dari @BotFather
- `DB_HOST` — `localhost` bila bot satu server dgn MySQL, atau `31.97.66.191`
- `DB_USER`, `DB_PASS`, `DB_PORT`
- `BOT_DB_URL` — biarkan SQLite (default) atau set MySQL
- `MODE_PREDIKSI` — `demo` dulu, `db` saat sensor live
- `INTERVAL_MENIT` — 60 (atau lebih kecil saat uji)

## 4. Uji manual dulu

```bash
cd /path/ke/SIGAP-Banjir-2/ml
../.venv/bin/python bot.py
# harus muncul "Bot SIGAP Banjir mulai polling..." -> tes /start di Telegram
# Ctrl+C untuk berhenti
```

## 5. Pasang sebagai service systemd

Edit `ml/sigap-bot.service` — ganti `GANTI_USER`, `WorkingDirectory`, dan
`ExecStart` (path python venv dari langkah 2). Lalu:

```bash
sudo cp ml/sigap-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sigap-bot
```

## 6. Operasional harian

```bash
sudo systemctl status sigap-bot     # cek hidup/mati
sudo systemctl restart sigap-bot    # setelah ubah kode
sudo systemctl stop sigap-bot       # matikan
sudo journalctl -u sigap-bot -f     # lihat log realtime
```

## Catatan
- Bila bot di server BERBEDA dari MySQL: pastikan port 3306 di `31.97.66.191`
  meng-whitelist IP server bot (firewall), kalau tidak fitur prediksi `db` gagal.
- Butuh RAM ~1GB (model .pkl ~90MB di-load saat prediksi).
- `.env` dan `*.db` sudah di-.gitignore — jangan commit rahasia.
