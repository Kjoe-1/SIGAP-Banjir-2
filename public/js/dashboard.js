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

const API_BASE = "https://self-carrousel-culprit.ngrok-free.dev";

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

function getAPI() {
  return `${API_BASE}/api/get_ultrasonic.php?lokasi=${locations[activeLocation].lokasi}`;
}

// ================= MODE SENSOR =================
function isWeatherMode() { return locations[activeLocation].lokasi === 2; }

function updateModeUI() {
  const w = isWeatherMode();
  const ws = document.getElementById("weatherSection");
  const wl = document.getElementById("waterLevelSection");
  if (ws) ws.style.display = w ? "block" : "none";
  if (wl) wl.style.display = w ? "none" : "block";
  const sb = document.querySelector(".status-bar");
  const sl = document.querySelector(".status-label");
  if (sb) sb.style.display = w ? "none" : "block";
  if (sl) sl.style.display = w ? "none" : "block";

  const ml1 = document.getElementById("miniLabel1");
  const ml2 = document.getElementById("miniLabel2");
  const ct = document.getElementById("chartTitle");
  if (w) {
    if (ml1) ml1.innerText = "Suhu";
    if (ml2) ml2.innerText = "Kelembaban";
    if (ct) ct.innerText = "Suhu (°C)";
  } else {
    if (ml1) ml1.innerText = "Distance 1";
    if (ml2) ml2.innerText = "Distance 2";
    if (ct) ct.innerText = "Tinggi Muka Air (cm)";
  }
}

// ================= NOTIFICATION =================
function notif(type, title, msg) {
  const cl = document.getElementById("notif-container");
  if (!cl) return;
  const el = document.createElement("div");
  const icons = { danger: "🔴", warn: "🟡", info: "🔵" };
  el.className = "notif " + type;
  el.innerHTML = `<span class="nicon">${icons[type] || "ℹ️"}</span><div class="nbody"><div class="ntitle">${title}</div><div class="nmsg">${msg}</div></div><button class="nclose" onclick="this.parentElement.remove()">✕</button>`;
  cl.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove(); }, 8000);
}

// ================= CHART =================
const ctx = document.getElementById("rainChart");
const rainChart = new Chart(ctx, {
  type: "line",
  data: { labels: [], datasets: [{ label: "Tinggi Muka Air (cm)", data: [], borderColor: "#1F6C9F", backgroundColor: "rgba(31,108,159,0.06)", tension: 0.3, pointRadius: 2 }] },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, padding: 15, color: "#787774", font: { size: 10 } } },
      y: { beginAtZero: true, grace: "10%", ticks: { color: "#787774", font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.04)" } },
    },
  },
});

function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ================= GAUGE =================
function renderGauges(distance1, distance2) {
  const row = document.getElementById("gaugeRow");
  if (!row) return;

  if (isWeatherMode()) { row.innerHTML = ""; return; }

  const d1 = parseFloat(distance1) || 0;
  const d2 = parseFloat(distance2) || 0;
  const maxDepth = 400;
  const tma1 = Math.max(0, maxDepth - d1);
  const tma2 = Math.max(0, maxDepth - d2);
  const pct1 = Math.min(tma1 / maxDepth * 100, 100);
  const pct2 = Math.min(tma2 / maxDepth * 100, 100);

  const c1 = pct1 > 66 ? "#FDEBEC" : pct1 > 33 ? "#FBF3DB" : "#EDF3EC";
  const c2 = pct2 > 66 ? "#FDEBEC" : pct2 > 33 ? "#FBF3DB" : "#EDF3EC";

  row.innerHTML = `
    <div class="gauge"><div class="gfill" style="height:${pct1}%;background:${c1}"></div><div class="gtxt">${tma1.toFixed(0)}<small>Sensor 1</small></div></div>
    <div class="gauge"><div class="gfill" style="height:${pct2}%;background:${c2}"></div><div class="gtxt">${tma2.toFixed(0)}<small>Sensor 2</small></div></div>
  `;
}

// ================= UPDATE SUMMARY =================
function updateSummary(latest) {
  const ind = document.getElementById("indicator");
  const badge = document.getElementById("status-badge");
  const w = isWeatherMode();

  if (!latest) {
    if (ind) ind.style.display = "none";
    document.getElementById("current-time").innerText = "-";
    document.getElementById("current-distance").innerText = "-";
    document.getElementById("distance1-value").innerText = "-";
    document.getElementById("distance2-value").innerText = "-";
    document.getElementById("statStatus").innerText = "-";
    document.getElementById("statTinggi").innerText = "-";
    document.getElementById("statWaktu").innerText = "-";
    if (w) ["temp","humi","windavg","windmax","windir","baro","rain1h","rain24h"].forEach(id => {
      const el = document.getElementById("weather-" + id);
      if (el) el.innerText = "-";
    });
    badge.innerText = "NO DATA";
    badge.style.backgroundColor = "#787774";
    renderGauges(0, 0);
    return;
  }

  document.getElementById("current-time").innerText = latest.waktu;
  document.getElementById("statWaktu").innerText = latest.waktu;
  if (badge) badge.style.display = "inline-block";

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

    const rain = (latest.curah_hujan != null ? latest.curah_hujan : "-");
    document.getElementById("current-distance").innerHTML = rain + ' <small>mm</small>';
    document.getElementById("distance1-value").innerText = latest.temp != null ? latest.temp + " °C" : "-";
    document.getElementById("distance2-value").innerText = latest.humi != null ? latest.humi + " %" : "-";
    document.getElementById("statTinggi").innerHTML = rain + '<small style="font-size:12px;color:#787774;display:block">mm</small>';
    document.getElementById("statStatus").innerText = "CUACA";

    const rv = parseFloat(latest.curah_hujan) || 0;
    const st = rv >= 3 ? "AWAS" : rv >= 1 ? "SIAGA" : "AMAN";
    badge.innerText = st;
    if (ind) ind.style.display = "none";
    badge.style.backgroundColor = st === "AMAN" ? "#346538" : st === "SIAGA" ? "#956400" : "#9F2F2D";
    renderGauges(0, 0);
  } else {
    if (ind) ind.style.display = "block";
    document.getElementById("current-distance").innerHTML = `${latest.distance1} <small>cm</small>`;
    document.getElementById("distance1-value").innerText = latest.distance1;
    document.getElementById("distance2-value").innerText = latest.distance2;
    document.getElementById("statTinggi").innerHTML = latest.distance1 + '<small style="font-size:12px;color:#787774;display:block">cm</small>';
    document.getElementById("statStatus").innerText = latest.distance1 > 200 ? "AMAN" : latest.distance1 > 100 ? "WASPADA" : "SIAGA";

    let st = latest.status;
    if (!st || st === "undefined") {
      const v = parseFloat(latest.distance1);
      st = v >= 200 ? "AMAN" : v >= 100 ? "WASPADA" : "SIAGA";
    }
    badge.innerText = st;
    badge.style.backgroundColor = st === "AMAN" ? "#346538" : st === "WASPADA" ? "#956400" : "#9F2F2D";
    if (ind) ind.style.left = st === "AMAN" ? "20%" : st === "WASPADA" ? "50%" : "80%";
    renderGauges(latest.distance1, latest.distance2);
  }
}

// ================= FETCH DATA =================
async function fetchData() {
  try {
    const res = await fetch(getAPI(), { headers: { "ngrok-skip-browser-warning": "true" } });
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
  if (loginBtn) loginBtn.style.display = isLogin ? "none" : "inline-block";
  if (uploadBtn) uploadBtn.style.display = isLogin ? "inline-block" : "none";
  if (logoutBtn) logoutBtn.style.display = isLogin ? "inline-block" : "none";
}

if (loginBtn) loginBtn.onclick = () => (window.location.href = "/login.html");
if (uploadBtn) uploadBtn.onclick = () => (window.location.href = "/upload.html");
if (logoutBtn) logoutBtn.onclick = () => {
  document.body.style.transition = "opacity 0.6s ease";
  document.body.style.opacity = "0";
  setTimeout(() => { localStorage.removeItem("isLogin"); window.location.href = "/login.html"; }, 600);
};

renderAuth();

// ================= ML PREDICTION =================
async function loadAIPrediction() {
  const feLokasi = locations[activeLocation].lokasi;
  try {
    const res = await fetch("/api/prediksi?lokasi=" + feLokasi);
    const data = await res.json();
    if (!data.success) return;

    const skrg = data.sekarang;
    const warn = data.peringatan;

    document.getElementById("statusText").innerText = skrg.status;
    document.getElementById("confidenceText").innerText = skrg.confidence != null ? Math.round(skrg.confidence * 100) + "%" : "-";

    const icon = document.getElementById("statusIcon");
    const desc = document.getElementById("statusDesc");
    if (skrg.status === "SIAGA") {
      if (icon) icon.innerText = "!";
      if (desc) desc.innerText = "Perlu pemantauan";
    } else if (skrg.status === "WASPADA") {
      if (icon) icon.innerText = "⚠";
      if (desc) desc.innerText = "Waspada banjir";
    } else {
      if (icon) icon.innerText = "✔";
      if (desc) desc.innerText = "Kondisi Normal";
    }

    const p1 = data.prediksi ? data.prediksi["1"] : null;
    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("forecastStatusText").innerText = p1.status;
      document.getElementById("forecastRainText").innerHTML = (p1.tinggi_air_cm != null ? p1.tinggi_air_cm : "-") + ' <small style="font-weight:400;color:#787774">cm</small>';
      document.getElementById("forecastConfidenceText").innerText = p1.confidence != null ? Math.round(p1.confidence * 100) + "%" : "-";
    }

    if (warn && warn.ada) {
      notif(warn.status === "SIAGA" ? "danger" : "warn", "Peringatan " + warn.status, warn.pesan);
    }
  } catch (e) {
    console.error("ML error:", e);
  }
}

// ================= CLOCK =================
function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  el.innerText = new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + " | " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

setInterval(updateClock, 1000);
updateClock();
loadAIPrediction();
