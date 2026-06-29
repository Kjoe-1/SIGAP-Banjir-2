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

// biar bisa baca JSON
app.use(express.json());

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
    let queryStr = `SELECT * FROM \`${cfg.table}\` ORDER BY \`${cfg.order}\` DESC LIMIT 12`;
    if (lokasi === 2) {
      queryStr = `SELECT *, (SELECT distance FROM esp3 WHERE esp3.time <= esp2.time ORDER BY esp3.time DESC LIMIT 1) AS distance FROM esp2 ORDER BY time DESC LIMIT 12`;
    }
    const [rows] = await conn.query(queryStr);

    const data = rows.reverse().map((r) => {
      if (lokasi === 2) {
        return {
          waktu: r.time,
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
        waktu: r.waktu,
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

app.post("/api/predict", (req, res) => {
  const payload = JSON.stringify(req.body);

  execFile("python", ["predict_ml.py", payload], (error, stdout, stderr) => {
    if (error) {
      console.error("ML error:", error);
      console.error("stderr:", stderr);
      return res.status(500).json({
        success: false,
        message: "Gagal menjalankan model ML",
      });
    }

    try {
      const result = JSON.parse(stdout);
      res.json({
        success: true,
        input: req.body,
        prediction: result,
      });
    } catch (parseError) {
      res.status(500).json({
        success: false,
        message: "Output ML tidak valid",
        raw: stdout,
      });
    }
  });
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

    execFile("python", ["predict_ml.py", JSON.stringify(s)], (error, stdout, stderr) => {
      if (error) return res.status(500).json({ success: false, message: "Gagal ML", stderr });
      try { res.json({ success: true, sensor: latest, prediction: JSON.parse(stdout) }); }
      catch { res.status(500).json({ success: false, message: "Output ML tidak valid", raw: stdout }); }
    });
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
    const payload = JSON.stringify({
      distance1: lokasi === 2 ? (latest.distance || 0) : (latest.distance1 || 0),
      distance2: lokasi === 2 ? (latest.distance || 0) : (latest.distance2 || 0),
      curah_hujan: latest.curah_hujan || latest.rain1h || 0,
      curah_hujan_1h: latest.curah_hujan_1h || latest.rain1h || 0,
      jumlah_tip: latest.jumlah_tip || 0,
    });

    execFile("python", ["predict_1hour.py", payload], (error, stdout, stderr) => {
      if (error) return res.status(500).json({ success: false, message: "Gagal forecast", stderr });
      try { res.json({ success: true, sensor: latest, forecast: JSON.parse(stdout) }); }
      catch { res.status(500).json({ success: false, message: "Output tidak valid", raw: stdout }); }
    });
  } catch (error) {
    console.error("Forecast error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

// Endpoint prediksi multi-horizon (dari ml/prediksi.py)
const ML_DIR = path.join(__dirname, "ml");
const FE2ML_MAP = { 1: 1, 2: 2, 3: 3 };

app.get("/api/prediksi", (req, res) => {
  const feLokasi = parseInt(req.query.lokasi) || 3;
  const mLokasi = FE2ML_MAP[feLokasi] || 1;
  const args = ["prediksi.py", "--lokasi", String(mLokasi), "--mode", "db", "--anchor", "latest", "--lookback", "336"];
  execFile("python", args, { cwd: ML_DIR, timeout: 30000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal prediksi", stderr: stderr });
    try { const d = JSON.parse(stdout); d.fe_lokasi = feLokasi; res.json(d); }
    catch { res.status(500).json({ success: false, message: "Output tidak valid", stdout }); }
  });
});

// Endpoint perbandingan prediksi vs aktual historis
const BANDING_MAP = { 1: 1, 2: 2, 3: 3 };

app.get("/api/perbandingan", (req, res) => {
  const feLokasi = parseInt(req.query.lokasi) || 3;
  const mLokasi = BANDING_MAP[feLokasi] || 1;
  const maxPoints = parseInt(req.query.max) || 50;
  const args = ["banding.py", "--lokasi", String(mLokasi), "--max-points", String(maxPoints)];
  execFile("python", args, { cwd: ML_DIR, timeout: 30000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal perbandingan", stderr: stderr });
    try { const d = JSON.parse(stdout); d.fe_lokasi = feLokasi; res.json(d); }
    catch { res.status(500).json({ success: false, message: "Output tidak valid", stdout }); }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
