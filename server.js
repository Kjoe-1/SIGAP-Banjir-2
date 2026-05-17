const { execFile } = require("child_process");
const express = require("express");
const path = require("path");

const app = express();

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

app.listen(3000, () => {
  console.log("Server jalan di http://localhost:3000");
});
