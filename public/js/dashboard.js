// ================= MAP =================
let map = L.map("map").setView([-7.286943, 112.755689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
let marker = L.marker([-7.286943, 112.755689]).addTo(map);

function updateMap(lat, lng) {
  map.setView([lat, lng], 15);
  marker.setLatLng([lat, lng]);
}

// ================= LOKASI =================
let activeLocation = "lokasi3";
const locations = {
  lokasi1: { name: "Keputih", lat: -7.284980, lng: 112.802923, lokasi: 1 },
  lokasi2: { name: "Hangtuah", lat: -7.290753, lng: 112.793255, lokasi: 2 },
  lokasi3: { name: "Kalikobor", lat: -7.286943, lng: 112.755689, lokasi: 3 },
};

function setLocation(key) {
  activeLocation = key;
  const loc = locations[key];
  updateMap(loc.lat, loc.lng);
  document.getElementById("active-location").innerText = loc.name;
  document.getElementById("lokasi-text").innerText = loc.name;

  document.querySelectorAll(".location-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById(key).classList.add("active");

  updateModeUI();
  fetchData();
  loadAIPrediction();
}

document.getElementById("lokasi1").onclick = () => setLocation("lokasi1");
document.getElementById("lokasi2").onclick = () => setLocation("lokasi2");
document.getElementById("lokasi3").onclick = () => setLocation("lokasi3");

// ================= API =================
function getAPI() {
  const id = locations[activeLocation].lokasi;
  return `https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php?lokasi=${id}`;
}

// ================= MODE SENSOR =================
function isWeatherMode() {
  return locations[activeLocation].lokasi === 2;
}

function updateModeUI() {
  const w = isWeatherMode();
  const g = (id) => document.getElementById(id);
  const ws = g("weatherSection");
  const wl = g("waterLevelSection");
  if (ws) ws.style.display = w ? "block" : "none";
  if (wl) wl.style.display = w ? "none" : "block";
  const sb = document.querySelector(".status-bar");
  const sl = document.querySelector(".status-label");
  if (sb) sb.style.display = w ? "none" : "block";
  if (sl) sl.style.display = w ? "none" : "block";

  const ml1 = g("miniLabel1");
  const ml2 = g("miniLabel2");
  const ct = g("chartTitle");
  if (w) {
    if (ml1) ml1.innerText = "Suhu";
    if (ml2) ml2.innerText = "Kelembaban";
    if (ct) ct.innerText = "Grafik Suhu (°C)";
  } else {
    if (ml1) ml1.innerText = "Distance 1";
    if (ml2) ml2.innerText = "Distance 2";
    if (ct) ct.innerText = "Grafik Tinggi Muka Air (cm)";
  }
}

// ================= CHART =================
const ctx = document.getElementById("rainChart");
const rainChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Tinggi Muka Air (cm)",
      data: [],
      borderColor: "#00bcd4",
      backgroundColor: "transparent",
      tension: 0.3,
      pointRadius: 2,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, padding: 15 } },
      y: { beginAtZero: true, grace: "10%" },
    },
  },
});

// ================= FORMAT TIME =================
function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ================= UPDATE SUMMARY =================
function updateSummary(latest) {
  const ind = document.getElementById("indicator");
  const badge = document.getElementById("status-badge");
  const w = isWeatherMode();

  if (!latest) {
    ind.style.display = "none";
    document.getElementById("current-time").innerText = "-";
    document.getElementById("current-distance").innerText = "-";
    document.getElementById("distance1-value").innerText = "-";
    document.getElementById("distance2-value").innerText = "-";
    if (w) ["temp","humi","windavg","windmax","windir","baro","rain1h","rain24h"].forEach(id => {
      const el = document.getElementById("weather-" + id);
      if (el) el.innerText = "-";
    });
    badge.innerText = "NO DATA";
    badge.style.backgroundColor = "gray";
    return;
  }

  document.getElementById("current-time").innerText = latest.waktu;
  badge.style.display = "inline-block";

  if (w) {
    const s = (id, v, u) => { const e = document.getElementById("weather-" + id); if (e) e.innerText = v != null ? v + " " + u : "-"; };
    s("temp", latest.temp, "°C");
    s("humi", latest.humi, "%");
    s("windavg", latest.windavg, "m/s");
    s("windmax", latest.windmax, "m/s");
    s("windir", latest.windir, "°");
    s("baro", latest.baro, "hPa");
    s("rain1h", latest.curah_hujan, "mm");
    s("rain24h", latest.rain24h, "mm");

    document.getElementById("current-distance").innerHTML = (latest.curah_hujan != null ? latest.curah_hujan : "-") + ' <small>mm</small>';
    document.getElementById("distance1-value").innerText = latest.temp != null ? latest.temp + " °C" : "-";
    document.getElementById("distance2-value").innerText = latest.humi != null ? latest.humi + " %" : "-";

    const r = parseFloat(latest.curah_hujan) || 0;
    const st = r >= 3 ? "AWAS" : r >= 1 ? "SIAGA" : "AMAN";
    badge.innerText = st;
    ind.style.display = "none";
    badge.style.backgroundColor = st === "AMAN" ? "green" : st === "SIAGA" ? "orange" : "red";
  } else {
    ind.style.display = "block";
    document.getElementById("current-distance").innerHTML = `${latest.distance1} <small>cm</small>`;
    document.getElementById("distance1-value").innerText = latest.distance1;
    document.getElementById("distance2-value").innerText = latest.distance2;

    let st = latest.status;
    if (!st || st === "undefined") {
      const v = parseFloat(latest.distance1);
      st = v >= 200 ? "AMAN" : v >= 100 ? "WASPADA" : "SIAGA";
    }
    badge.innerText = st;
    badge.style.backgroundColor = st === "AMAN" ? "green" : st === "WASPADA" ? "orange" : "red";
    ind.style.left = st === "AMAN" ? "20%" : st === "WASPADA" ? "50%" : "80%";
  }
}

// ================= FETCH DATA =================
async function fetchData() {
  try {
    const res = await fetch(getAPI(), {
      headers: { "ngrok-skip-browser-warning": "true" },
    });
    const json = await res.json();
    updateModeUI();

    if (!json.data || json.data.length === 0) {
      updateSummary(null);
      return;
    }

    const rows = json.data.slice().reverse();
    const w = isWeatherMode();
    const labels = rows.map((r) => formatTimeLabel(r.waktu));
    const values = rows.map((r) => (w ? parseFloat(r.temp) : parseFloat(r.distance1)));

    rainChart.data.labels = labels;
    rainChart.data.datasets[0].data = values;
    rainChart.data.datasets[0].label = w ? "Suhu (°C)" : "Tinggi Muka Air (cm)";
    rainChart.update();

    const latest = rows[rows.length - 1];
    updateSummary(latest);
    if (latest.lat && latest.lng) updateMap(latest.lat, latest.lng);
  } catch (err) {
    console.error(err);
    updateSummary(null);
  }
}

fetchData();
setInterval(fetchData, 10000);

// ================= AUTH =================
const loginBtn = document.getElementById("loginBtn");
const uploadBtn = document.getElementById("uploadBtn");
const logoutBtn = document.getElementById("logoutBtn");

function renderAuth() {
  const isLogin = localStorage.getItem("isLogin") === "true";
  loginBtn.style.display = isLogin ? "none" : "inline-block";
  uploadBtn.style.display = isLogin ? "inline-block" : "none";
  logoutBtn.style.display = isLogin ? "inline-block" : "none";
}

loginBtn.onclick = () => (window.location.href = "/login.html");
uploadBtn.onclick = () => (window.location.href = "/upload.html");
logoutBtn.onclick = () => {
  document.body.style.transition = "opacity 0.6s ease";
  document.body.style.opacity = "0";
  setTimeout(() => {
    localStorage.removeItem("isLogin");
    window.location.href = "/login.html";
  }, 600);
};

renderAuth();

// ================= ML PREDICTION =================
async function loadAIPrediction() {
  const feLokasi = locations[activeLocation].lokasi;

  // Load prediksi utama (cepet)
  try {
    const res = await fetch("/api/prediksi?lokasi=" + feLokasi);
    const data = await res.json();

    if (!data.success) return;

    const skrg = data.sekarang;
    const warn = data.peringatan;
    const p1 = data.prediksi ? data.prediksi["1"] : null;

    document.getElementById("statusText").innerText = skrg.status;
    document.getElementById("confidenceText").innerText = skrg.confidence != null ? Math.round(skrg.confidence * 100) + "%" : "-";

    if (skrg.status === "SIAGA") {
      document.getElementById("statusIcon").innerText = "!";
      document.getElementById("statusDesc").innerText = "Perlu pemantauan";
    } else if (skrg.status === "WASPADA") {
      document.getElementById("statusIcon").innerText = "⚠";
      document.getElementById("statusDesc").innerText = "Waspada banjir";
    } else {
      document.getElementById("statusIcon").innerText = "✔";
      document.getElementById("statusDesc").innerText = "Kondisi Normal";
    }

    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("forecastStatusText").innerText = p1.status;
      document.getElementById("forecastRainText").innerText = p1.tinggi_air_cm != null ? p1.tinggi_air_cm + " cm" : "-";
      document.getElementById("forecastConfidenceText").innerText = p1.confidence != null ? Math.round(p1.confidence * 100) + "%" : "-";
    }

    const alertEl = document.getElementById("peringatanAlert");
    if (warn && warn.ada) {
      alertEl.style.display = "block";
      alertEl.className = "peringatan-alert peringatan-" + warn.status.toLowerCase();
      alertEl.innerHTML = '<span class="alert-icon">⚠️</span> ' + warn.pesan + ' <span class="alert-close" onclick="this.parentElement.style.display=\'none\'">✕</span>';
    } else {
      alertEl.style.display = "none";
    }

    const badgeEl = document.getElementById("prediksiKeandalan");
    if (data.tipe === "klasifikasi") {
      badgeEl.innerText = "klasifikasi";
      badgeEl.className = "keandalan-badge badge-tidak";
    } else if (p1) {
      badgeEl.innerText = p1.keandalan || "-";
      badgeEl.className = "keandalan-badge badge-" + (p1.keandalan || "tidak");
    }
  } catch (e) {
    console.error("ML prediksi error:", e);
  }

  // Load forecast 1 jam (terpisah, biar gak ngeblock)
  try {
    const res = await fetch("/api/forecast-1hour");
    const fcData = await res.json();
    if (fcData.success && fcData.forecast) {
      document.getElementById("forecastStatusText").innerText = fcData.forecast.status_next_1h || document.getElementById("forecastStatusText").innerText;
      document.getElementById("forecastRainText").innerText = fcData.forecast.rainfall_next_1h != null ? fcData.forecast.rainfall_next_1h + " mm" : document.getElementById("forecastRainText").innerText;
      document.getElementById("forecastConfidenceText").innerText = fcData.forecast.confidence_next_1h != null ? Math.round(fcData.forecast.confidence_next_1h * 100) + "%" : document.getElementById("forecastConfidenceText").innerText;
    }
  } catch (e) {
    console.error("Forecast error:", e);
  }
}

// ================= CLOCK =================
function updateClock() {
  const now = new Date();
  document.getElementById("clock").innerText =
    now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) +
    " | " +
    now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Horizon tabs
document.querySelectorAll(".horizon-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".horizon-btn").forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    horizonAktif = this.dataset.h;
    loadPerbandingan();
  });
});

setInterval(updateClock, 1000);
updateClock();
loadAIPrediction();
