const { execFile } = require("child_process");
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();

const DB = {
  host: process.env.SENSOR_DB_HOST || "31.97.66.191",
  user: process.env.SENSOR_DB_USER || "Joko",
  password: process.env.SENSOR_DB_PASS || "Joko12345",
  port: parseInt(process.env.SENSOR_DB_PORT) || 3306,
};
const SENSOR_CFG = {
  1: { database: "dbpvwemonbaru2", table: "esp1", order: "waktu" },
  2: { database: "dbpvwemon",   table: "esp2", order: "time"  },
  3: { database: "dbpvwemonbaru", table: "esp1", order: "waktu" },
};
async function sensorDb(lokasi) {
  const cfg = SENSOR_CFG[lokasi];
  if (!cfg) return null;
  return mysql.createConnection({ ...DB, database: cfg.database });
}

// biar bisa baca JSON (ditingkatkan limitnya untuk foto base64)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// serve folder public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// route default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ambil data sensor dari database langsung (ganti ngrok)
app.get("/api/sensor", async (req, res) => {
  const lokasi = parseInt(req.query.lokasi) || 3;
  let conn;
  try {
    conn = await sensorDb(lokasi);
    if (!conn) return res.json({ status: "ok", lokasi, data: [] });

    const cfg = SENSOR_CFG[lokasi];
    let queryStr = `SELECT *, DATE_FORMAT(\`${cfg.order}\`, '%Y-%m-%dT%H:%i:%s') AS waktu_str FROM \`${cfg.table}\` ORDER BY \`${cfg.order}\` DESC LIMIT 12`;
    if (lokasi === 2) {
      queryStr = `SELECT *, DATE_FORMAT(time, '%Y-%m-%dT%H:%i:%s') AS waktu_str, (SELECT distance FROM esp3 WHERE esp3.time <= esp2.time ORDER BY esp3.time DESC LIMIT 1) AS distance FROM esp2 ORDER BY time DESC LIMIT 12`;
    }
    const [rows] = await conn.query(queryStr);

    const data = rows.reverse().map((r) => {
      if (lokasi === 2) {
        return {
          waktu: r.waktu_str,
          temp: r.temp,
          humi: r.humi,
          curah_hujan: r.rain1h,
          rain24h: r.rain24h,
          windavg: r.windavg,
          windmax: r.windmax,
          windir: r.windir,
          baro: r.baro,
          distance1: r.distance !== undefined && r.distance !== null ? r.distance : 0,
          distance2: r.distance !== undefined && r.distance !== null ? r.distance : 0,
        };
      }
      return {
        id: r.id,
        waktu: r.waktu_str,
        distance1: r.distance1,
        distance2: r.distance2,
        curah_hujan: r.curah_hujan,
        curah_hujan_1h: r.curah_hujan_1h,
        jumlah_tip: r.jumlah_tip,
      };
    });

    res.json({ status: "ok", lokasi, data });
  } catch (err) {
    console.error("Sensor DB error:", err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

// dummy auth
app.get("/auth/me", (req, res) => {
  res.json({ role: "user" });
});

const ML_API_URL = process.env.ML_API_URL || null;

async function runMLPrediction(payload) {
  if (ML_API_URL) {
    const res = await fetch(`${ML_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ML API HTTP error: ${res.statusText}`);
    return await res.json();
  }
  return new Promise((resolve, reject) => {
    execFile("python", ["predict_ml.py", JSON.stringify(payload)], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(e); }
    });
  });
}

async function run1HourForecast(payload) {
  if (ML_API_URL) {
    const res = await fetch(`${ML_API_URL}/predict_1hour`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`ML API HTTP error: ${res.statusText}`);
    return await res.json();
  }
  return new Promise((resolve, reject) => {
    execFile("python", ["predict_1hour.py", JSON.stringify(payload)], (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(e); }
    });
  });
}

async function runPrediksiScript(mLokasi) {
  if (ML_API_URL) {
    const res = await fetch(`${ML_API_URL}/prediksi?lokasi=${mLokasi}&mode=db&anchor=latest&lookback=336`);
    if (!res.ok) throw new Error(`ML API HTTP error: ${res.statusText}`);
    return await res.json();
  }
  const ML_DIR = path.join(__dirname, "ml");
  const args = ["prediksi.py", "--lokasi", String(mLokasi), "--mode", "db", "--anchor", "latest", "--lookback", "336"];
  return new Promise((resolve, reject) => {
    execFile("python", args, { cwd: ML_DIR, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(e); }
    });
  });
}

async function runBandingScript(mLokasi, maxPoints) {
  if (ML_API_URL) {
    const res = await fetch(`${ML_API_URL}/perbandingan?lokasi=${mLokasi}&mode=db&max=${maxPoints}`);
    if (!res.ok) throw new Error(`ML API HTTP error: ${res.statusText}`);
    return await res.json();
  }
  const ML_DIR = path.join(__dirname, "ml");
  const args = ["banding.py", "--lokasi", String(mLokasi), "--mode", "db", "--max-points", String(maxPoints)];
  return new Promise((resolve, reject) => {
    execFile("python", args, { cwd: ML_DIR, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(e); }
    });
  });
}

app.post("/api/predict", async (req, res) => {
  try {
    const result = await runMLPrediction(req.body);
    res.json({
      success: true,
      input: req.body,
      prediction: result,
    });
  } catch (error) {
    console.error("ML error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menjalankan model ML",
      error: error.message,
    });
  }
});

app.get("/api/latest-prediction", async (req, res) => {
  const lokasi = parseInt(req.query.lokasi) || 3;
  let conn;
  try {
    conn = await sensorDb(lokasi);
    if (!conn) return res.json({ success: false, message: "Lokasi tidak punya sensor" });

    const cfg = SENSOR_CFG[lokasi];
    let queryStr = `SELECT * FROM \`${cfg.table}\` ORDER BY \`${cfg.order}\` DESC LIMIT 1`;
    if (lokasi === 2) {
      queryStr = `SELECT *, (SELECT distance FROM esp3 WHERE esp3.time <= esp2.time ORDER BY esp3.time DESC LIMIT 1) AS distance FROM esp2 ORDER BY time DESC LIMIT 1`;
    }
    const [rows] = await conn.query(queryStr);
    if (!rows.length) return res.json({ success: false, message: "Tidak ada data sensor" });

    const latest = rows[0];
    const s = lokasi === 2
      ? { distance_cm: latest.distance || 0, rainfall_mm: latest.rain1h || 0, tip_count: 0 }
      : { distance_cm: latest.distance1 || latest.distance2 || 0, rainfall_mm: latest.curah_hujan || latest.curah_hujan_1h || 0, tip_count: latest.jumlah_tip || 0 };

    const prediction = await runMLPrediction(s);

    res.json({ success: true, sensor: latest, prediction });
  } catch (error) {
    console.error("Realtime error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

app.get("/api/forecast-1hour", async (req, res) => {
  const lokasi = parseInt(req.query.lokasi) || 3;
  let conn;
  try {
    conn = await sensorDb(lokasi);
    if (!conn) return res.json({ success: false, message: "Lokasi tidak punya sensor" });

    const cfg = SENSOR_CFG[lokasi];
    let queryStr = `SELECT * FROM \`${cfg.table}\` ORDER BY \`${cfg.order}\` DESC LIMIT 1`;
    if (lokasi === 2) {
      queryStr = `SELECT *, (SELECT distance FROM esp3 WHERE esp3.time <= esp2.time ORDER BY esp3.time DESC LIMIT 1) AS distance FROM esp2 ORDER BY time DESC LIMIT 1`;
    }
    const [rows] = await conn.query(queryStr);
    if (!rows.length) return res.json({ success: false, message: "Tidak ada data sensor" });

    const latest = rows[0];
    const payload = {
      distance1: lokasi === 2 ? (latest.distance || 0) : (latest.distance1 || 0),
      distance2: lokasi === 2 ? (latest.distance || 0) : (latest.distance2 || 0),
      curah_hujan: latest.curah_hujan || latest.rain1h || 0,
      curah_hujan_1h: latest.curah_hujan_1h || latest.rain1h || 0,
      jumlah_tip: latest.jumlah_tip || 0,
    };

    const forecast = await run1HourForecast(payload);

    res.json({ success: true, sensor: latest, forecast });
  } catch (error) {
    console.error("Forecast error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

// Endpoint prediksi multi-horizon
const FE2ML_MAP = { 1: 1, 2: 2, 3: 3 };

app.get("/api/prediksi", async (req, res) => {
  const feLokasi = parseInt(req.query.lokasi) || 3;
  const mLokasi = FE2ML_MAP[feLokasi] || 1;
  try {
    const data = await runPrediksiScript(mLokasi);
    data.fe_lokasi = feLokasi;
    res.json(data);
  } catch (error) {
    console.error("Gagal prediksi:", error);
    res.status(500).json({ success: false, message: "Gagal prediksi", error: error.message });
  }
});

// Endpoint perbandingan prediksi vs aktual historis
const BANDING_MAP = { 1: 1, 2: 2, 3: 3 };

app.get("/api/perbandingan", async (req, res) => {
  const feLokasi = parseInt(req.query.lokasi) || 3;
  const mLokasi = BANDING_MAP[feLokasi] || 1;
  const maxPoints = parseInt(req.query.max) || 50;
  try {
    const data = await runBandingScript(mLokasi, maxPoints);
    data.fe_lokasi = feLokasi;
    res.json(data);
  } catch (error) {
    console.error("Gagal perbandingan:", error);
    res.status(500).json({ success: false, message: "Gagal perbandingan", error: error.message });
  }
});

// Setup Table Laporan Banjir di database 'dbpvwemonbaru' (Lokasi 3)
const fs = require("fs");

async function setupLaporanTable() {
  let conn;
  try {
    conn = await mysql.createConnection({ ...DB, database: "dbpvwemonbaru" });
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`laporan_banjir\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`waktu\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`latitude\` DOUBLE NOT NULL,
        \`longitude\` DOUBLE NOT NULL,
        \`catatan\` TEXT NOT NULL,
        \`foto_url\` VARCHAR(255)
      );
    `;
    await conn.query(createTableQuery);
    console.log("Database: Tabel laporan_banjir siap.");
  } catch (err) {
    console.error("Gagal inisialisasi tabel laporan_banjir:", err);
  } finally {
    if (conn) await conn.end();
  }
}
setupLaporanTable();

// Ensure public/uploads folder exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Endpoint untuk handle upload laporan warga (Base64)
app.post("/api/laporan", async (req, res) => {
  const { lat, lng, catatan, fotoBase64 } = req.body;
  if (!lat || !lng || !catatan) {
    return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
  }

  let filename = null;
  if (fotoBase64) {
    filename = `lapor_${Date.now()}.jpg`;
    // Clean base64 prefix if exists
    const base64Data = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
    try {
      fs.writeFileSync(path.join(uploadsDir, filename), base64Data, "base64");
    } catch (e) {
      console.error("Gagal menyimpan file gambar:", e);
      return res.status(500).json({ status: "error", message: "Gagal menyimpan file gambar" });
    }
  }

  let conn;
  try {
    conn = await mysql.createConnection({ ...DB, database: "dbpvwemonbaru" });
    const fotoUrl = filename ? `/uploads/${filename}` : null;
    const query = "INSERT INTO laporan_banjir (latitude, longitude, catatan, foto_url) VALUES (?, ?, ?, ?)";
    await conn.query(query, [lat, lng, catatan, fotoUrl]);
    res.json({ status: "ok", message: "Laporan berhasil disimpan", fotoUrl });
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).json({ status: "error", message: "Gagal menyimpan ke database" });
  } finally {
    if (conn) await conn.end();
  }
});

// Endpoint untuk mengambil semua laporan warga
app.get("/api/laporan", async (req, res) => {
  let conn;
  try {
    conn = await mysql.createConnection({ ...DB, database: "dbpvwemonbaru" });
    const [rows] = await conn.query("SELECT *, DATE_FORMAT(waktu, '%Y-%m-%dT%H:%i:%s') AS waktu_str FROM laporan_banjir ORDER BY waktu DESC");
    const data = rows.map((r) => ({
      id: r.id,
      waktu: r.waktu_str,
      latitude: r.latitude,
      longitude: r.longitude,
      catatan: r.catatan,
      foto_url: r.foto_url,
    }));
    res.json({ status: "ok", data });
  } catch (err) {
    console.error("Fetch reports error:", err);
    res.status(500).json({ status: "error", message: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

// Serve folder uploads secara statis
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}/dashboard.html`);
});
