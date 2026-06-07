const { execFile } = require("child_process");
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const fetch = require("node-fetch");

const app = express();
const dbConfig = {
  host: "197.66.1.91",
  user: "Joko",
  password: "Joko12345",
  database: "dbpvwemonbaru",
  port: 3306,
};

// biar bisa baca JSON
app.use(express.json());

// serve folder public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// route default
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// dummy endpoint biar dashboard nggak loading
app.get("/sensor/latest", (req, res) => {
  res.json({
    suhu: 30,
    kelembapan: 70,
    lat: -7.25,
    lng: 112.75,
  });
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
  try {
    const apiUrl =
      "https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php";

    const apiResponse = await fetch(apiUrl, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    const apiData = await apiResponse.json();

    if (!apiData.data || apiData.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data sensor dari API tidak ditemukan",
      });
    }

    const latest = apiData.data[0];

    const payload = JSON.stringify({
      distance_cm: latest.distance1 || latest.distance2 || 0,
      rainfall_mm: latest.curah_hujan || latest.curah_hujan_1h || 0,
      tip_count: latest.jumlah_tip || 0,
    });

    execFile("python", ["predict_ml.py", payload], (error, stdout, stderr) => {
      if (error) {
        console.error("ML error:", error);
        console.error("stderr:", stderr);
        return res.status(500).json({
          success: false,
          message: "Gagal menjalankan model ML",
        });
      }

      const prediction = JSON.parse(stdout);

      res.json({
        success: true,
        sensor: latest,
        prediction: prediction,
      });
    });
  } catch (error) {
    console.error("API realtime error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data realtime dari API",
    });
  }
});

app.get("/api/forecast-1hour", async (req, res) => {
  try {
    const apiUrl =
      "https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php";

    const apiResponse = await fetch(apiUrl, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    const apiData = await apiResponse.json();

    if (!apiData.data || apiData.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data sensor dari API tidak ditemukan",
      });
    }

    const latest = apiData.data[0];

    const payload = JSON.stringify({
      distance1: latest.distance1 || 0,
      distance2: latest.distance2 || 0,
      curah_hujan: latest.curah_hujan || 0,
      curah_hujan_1h: latest.curah_hujan_1h || 0,
      jumlah_tip: latest.jumlah_tip || 0,
    });

    execFile(
      "python",
      ["predict_1hour.py", payload],
      (error, stdout, stderr) => {
        if (error) {
          console.error("Forecast ML error:", error);
          console.error("stderr:", stderr);
          return res.status(500).json({
            success: false,
            message: "Gagal menjalankan model forecast 1 jam",
          });
        }

        const forecast = JSON.parse(stdout);

        res.json({
          success: true,
          sensor: latest,
          forecast: forecast,
        });
      },
    );
  } catch (error) {
    console.error("API forecast error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil forecast 1 jam",
    });
  }
});

app.listen(3000, () => {
  console.log("Server jalan di http://localhost:3000");
});
