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
  lokasi1: { name: "Pucanganom", lat: -7.28498, lng: 112.802923, lokasi: 1 },
  lokasi2: { name: "UHT", lat: -7.290753, lng: 112.793255, lokasi: 2 },
  lokasi3: { name: "Kalikobor", lat: -7.286943, lng: 112.755689, lokasi: 3 },
};

function setLocation(key) {
  activeLocation = key;
  const loc = locations[key];
  updateMap(loc.lat, loc.lng);
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.innerText = t; };
  setText("activeLocation", loc.name);
  setText("lokasiText", loc.name);
  setText("summaryLokasi", loc.name);

  // reset all sidebar buttons styling
  document.querySelectorAll("[id^=lokasi]").forEach((el) => {
    if (el.id === "lokasiText") return;
    el.className = "flex items-center gap-2 px-2 py-1 border-2 border-primary bg-surface text-on-surface brutal-shadow hover:bg-surface-container-highest active:scale-95 transition-transform cursor-pointer";
  });
  const activeEl = document.getElementById(key);
  if (activeEl) {
    activeEl.className = "flex items-center gap-2 px-2 py-1 border-2 border-primary bg-secondary text-on-secondary font-bold brutal-shadow active:scale-95 transition-transform cursor-pointer";
  }

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
  return `/api/sensor?lokasi=${id}`;
}

// ================= MODE SENSOR =================
function isWeatherMode() {
  return locations[activeLocation].lokasi === 2;
}
function isRainfallMode() {
  return locations[activeLocation].lokasi === 1;
}

function updateModeUI() {
  const w = isWeatherMode();
  const r = isRainfallMode();
  const g = (id) => document.getElementById(id);
  
  const weatherSec = g("weatherSection");
  if (weatherSec) weatherSec.style.display = w ? "block" : "none";
  
  const rainSec = g("rainfallSection");
  if (rainSec) rainSec.style.display = r ? "block" : "none";
  
  const sb = document.querySelector(".status-bar");
  if (sb) sb.style.display = "block";
  const sl = document.querySelector(".status-label");
  if (sl) sl.style.display = "block";

  const ct = g("chartTitle");
  if (ct) {
    ct.innerText = "Grafik Tinggi Muka Air (cm)";
  }
}

// ================= CHART =================
const ctx = document.getElementById("rainChart");
const rainChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Tinggi Muka Air (cm)",
        data: [],
        borderColor: "#00bcd4",
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          padding: 15,
        },
      },
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
const REF_HEIGHTS = {
  lokasi1: 366.01,
  lokasi2: 466.0,
  lokasi3: 545.0,
};

// ================= UPDATE GAUGES =================
function updateGauges(latest, tinggiAir, distance) {
  const row = document.getElementById("gaugeRow");
  if (!row) return;
  row.innerHTML = "";

  if (!latest) return;

  const locId = locations[activeLocation].lokasi;
  let gauges = [];

  if (locId === 2) {
    // UHT (Weather): temp, humi, rain1h, baro
    const tempVal = parseFloat(latest.temp) || 0;
    const humiVal = parseFloat(latest.humi) || 0;
    const rainVal = parseFloat(latest.curah_hujan) || 0;
    const baroVal = parseFloat(latest.baro) || 0;

    gauges = [
      { value: tempVal.toFixed(1) + " °C", label: "Suhu", percent: Math.min((tempVal / 50) * 100, 100), fillClass: "bg-secondary-container halftone-pink" },
      { value: humiVal.toFixed(1) + " %", label: "Kelembaban", percent: humiVal, fillClass: "bg-tertiary-fixed-dim halftone-cyan" },
      { value: rainVal.toFixed(1) + " mm", label: "Hujan (1h)", percent: Math.min((rainVal / 30) * 100, 100), fillClass: "bg-secondary-fixed stripe-bg" },
      { value: baroVal > 0 ? baroVal.toFixed(0) + " hPa" : "-", label: "Tekanan", percent: baroVal > 0 ? Math.min(((baroVal - 950) / 100) * 100, 100) : 0, fillClass: "bg-surface-variant" }
    ];
  } else if (locId === 1) {
    // Pucanganom (Rainfall): curah_hujan_1h, jumlah_tip, distance1, distance2
    const rainVal = parseFloat(latest.curah_hujan_1h) || 0;
    const tipVal = parseInt(latest.jumlah_tip) || 0;
    const d1 = parseFloat(latest.distance1) || 0;
    const d2 = parseFloat(latest.distance2) || 0;

    gauges = [
      { value: rainVal.toFixed(1) + " mm", label: "Hujan (1h)", percent: Math.min((rainVal / 30) * 100, 100), fillClass: "bg-tertiary-fixed-dim halftone-cyan" },
      { value: tipVal, label: "Jumlah Tip", percent: Math.min((tipVal / 50) * 100, 100), fillClass: "bg-secondary-container halftone-pink" },
      { value: d1 > 0 ? d1.toFixed(0) + " cm" : "-", label: "Jarak 1", percent: d1 > 0 ? Math.min((d1 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" },
      { value: d2 > 0 ? d2.toFixed(0) + " cm" : "-", label: "Jarak 2", percent: d2 > 0 ? Math.min((d2 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" }
    ];
  } else {
    // Kalikobor (Water level): distance1, distance2
    const d1 = parseFloat(latest.distance1) || 0;
    const d2 = parseFloat(latest.distance2) || 0;

    gauges = [
      { value: d1 > 0 ? d1.toFixed(0) + " cm" : "OFFLINE", label: "Sensor 1 (Jarak)", percent: d1 > 0 ? Math.min((d1 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" },
      { value: d2 > 0 ? d2.toFixed(0) + " cm" : "OFFLINE", label: "Sensor 2 (Jarak)", percent: d2 > 0 ? Math.min((d2 / 600) * 100, 100) : 0, fillClass: "bg-secondary-container halftone-pink" }
    ];
  }

  gauges.forEach((g) => {
    const div = document.createElement("div");
    div.className = "gauge";
    div.innerHTML = `
      <div class="gfill ${g.fillClass}" style="height: ${g.percent}%"></div>
      <div class="gtxt">${g.value} <small>${g.label}</small></div>
    `;
    row.appendChild(div);
  });
}

function updateSummary(latest) {
  const ind = document.getElementById("indicator");
  const badge = document.getElementById("status-badge");
  const statStatus = document.getElementById("statStatus");
  const statTinggi = document.getElementById("statTinggi");
  const statDist1 = document.getElementById("statDist1");
  const statDist2 = document.getElementById("statDist2");

  const setElText = (el, text) => { if (el) el.innerText = text; };

  if (!latest) {
    if (ind) ind.style.display = "none";
    setElText(document.getElementById("current-time"), "-");
    setElText(document.getElementById("current-distance"), "-");
    setElText(statStatus, "NO DATA");
    setElText(statTinggi, "-");
    setElText(statDist1, "-");
    setElText(statDist2, "-");
    if (badge) {
      badge.innerText = "NO DATA";
      badge.style.backgroundColor = "gray";
    }
    updateGauges(null);
    return;
  }

  setElText(document.getElementById("current-time"), latest.waktu);

  // Parse raw distance values
  const d1 = parseFloat(latest.distance1);
  const d2 = parseFloat(latest.distance2);

  // Show raw distance values in stats row (with fallback to '-' if invalid or 0)
  setElText(statDist1, d1 > 0 ? d1.toFixed(1) + " cm" : "-");
  setElText(statDist2, d2 > 0 ? d2.toFixed(1) + " cm" : "-");

  // Determine valid distance with fallback and glitch protection
  const ref = REF_HEIGHTS[activeLocation];
  let distance = null;

  if (activeLocation === "lokasi3") {
    // Kalikobor: distance1 is known broken (flat 0), fallback to distance2
    const d1Valid = d1 > 10 && d1 < 600;
    const d2Valid = d2 > 10 && d2 < 600;
    if (d2Valid) {
      distance = d2;
    } else if (d1Valid) {
      distance = d1;
    }
  } else {
    // Pucanganom & UHT: use distance1 if valid, else distance2
    const d1Valid = d1 > 10 && d1 < 600;
    const d2Valid = d2 > 10 && d2 < 600;
    if (d1Valid) {
      distance = d1;
    } else if (d2Valid) {
      distance = d2;
    }
  }

  // Render extra panels for weather & rain
  const w = isWeatherMode();
  const r = isRainfallMode();
  if (w) {
    const s = (id, v, u) => {
      const e = document.getElementById("weather-" + id);
      if (e) e.innerText = v != null ? v + " " + u : "-";
    };
    s("temp", latest.temp, "°C");
    s("humi", latest.humi, "%");
    s("windavg", latest.windavg, "m/s");
    s("windmax", latest.windmax, "m/s");
    s("windir", latest.windir, "°");
    s("baro", latest.baro, "hPa");
    s("rain1h", latest.curah_hujan, "mm");
    s("rain24h", latest.rain24h, "mm");
  } else if (r) {
    setElText(document.getElementById("rainfall-curah"), latest.curah_hujan_1h != null ? latest.curah_hujan_1h + " mm" : "-");
    setElText(document.getElementById("rainfall-tip"), latest.jumlah_tip != null ? latest.jumlah_tip : "-");
  }

  if (distance === null) {
    // Glitch/Offline state
    if (ind) ind.style.display = "none";
    document.getElementById("current-distance").innerHTML = "OFFLINE";
    setElText(statTinggi, "-");
    setElText(statStatus, "GLITCH");
    
    if (badge) {
      badge.innerText = "GLITCH";
      badge.style.backgroundColor = "orange";
    }
    updateGauges(latest);
    return;
  }

  // Calculate water level (tinggi air = ref - distance)
  const tinggiAir = ref - distance;
  const tinggiAirFixed = Math.max(0, tinggiAir).toFixed(1);
  
  document.getElementById("current-distance").innerHTML = `${tinggiAirFixed} <small>cm</small>`;
  setElText(statTinggi, tinggiAirFixed);

  // Get status thresholds (official thresholds from config.py)
  const thresholds = {
    lokasi1: { waspada: 110, siaga: 130 },
    lokasi2: { waspada: 250, siaga: 285 },
    lokasi3: { waspada: 120, siaga: 150 },
  }[activeLocation];

  let st = "AMAN";
  if (tinggiAir >= thresholds.siaga) {
    st = "SIAGA";
  } else if (tinggiAir >= thresholds.waspada) {
    st = "WASPADA";
  }

  setElText(statStatus, st);
  if (badge) {
    badge.innerText = st;
    badge.style.backgroundColor =
      st === "AMAN" ? "green" : st === "WASPADA" ? "orange" : "red";
  }

  if (ind) {
    ind.style.display = "block";
    ind.style.left = st === "AMAN" ? "20%" : st === "WASPADA" ? "50%" : "80%";
  }

  updateGauges(latest, tinggiAir, distance);
}

// ================= FETCH DATA =================
async function fetchData() {
  try {
    const res = await fetch(getAPI());
    const json = await res.json();
    updateModeUI();

    if (!json.data || json.data.length === 0) {
      updateSummary(null);
      return;
    }

    const rows = json.data.slice().reverse();
    const labels = rows.map((rv) => formatTimeLabel(rv.waktu));
    
    // Always plot Tinggi Muka Air (cm) on the main chart
    const ref = REF_HEIGHTS[activeLocation];
    const values = rows.map((rv) => {
      const d1 = parseFloat(rv.distance1) || 0;
      const d2 = parseFloat(rv.distance2) || 0;
      let distance = null;
      
      if (activeLocation === "lokasi3") {
        if (d2 > 10 && d2 < 600) distance = d2;
        else if (d1 > 10 && d1 < 600) distance = d1;
      } else {
        if (d1 > 10 && d1 < 600) distance = d1;
        else if (d2 > 10 && d2 < 600) distance = d2;
      }
      
      if (distance === null) return 0;
      return Math.max(0, ref - distance);
    });

    rainChart.data.labels = labels;
    rainChart.data.datasets[0].data = values;
    rainChart.data.datasets[0].label = "Tinggi Muka Air (cm)";
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
if (logoutBtn) {
  logoutBtn.onclick = () => {
    document.body.style.transition = "opacity 0.6s ease";
    document.body.style.opacity = "0";
    setTimeout(() => {
      localStorage.removeItem("isLogin");
      window.location.href = "/login.html";
    }, 600);
  };
}

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
    document.getElementById("confidenceText").innerText =
      skrg.confidence != null
        ? Math.round(skrg.confidence * 100) + "% pohon setuju"
        : "-";

    const statusDesc = document.getElementById("statusDesc");
    const statusIcon = document.getElementById("statusIcon");
    if (statusIcon) {
      if (skrg.status === "SIAGA") statusIcon.innerText = "!";
      else if (skrg.status === "WASPADA") statusIcon.innerText = "⚠";
      else statusIcon.innerText = "✔";
    }

    if (statusDesc) {
      if (skrg.status === "SIAGA") {
        statusDesc.innerText = "Perlu pemantauan";
      } else if (skrg.status === "WASPADA") {
        statusDesc.innerText = "Waspada banjir";
      } else {
        statusDesc.innerText = "Kondisi Normal";
      }
    }

    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("forecastStatusText").innerText = p1.status;
      document.getElementById("forecastRainText").innerText =
        p1.tinggi_air_cm != null ? p1.tinggi_air_cm + " cm" : "-";
      document.getElementById("forecastConfidenceText").innerText =
        p1.confidence != null
          ? Math.round(p1.confidence * 100) + "% pohon setuju"
          : "-";
    }

    const alertEl = document.getElementById("peringatanAlert");
    if (alertEl) {
      if (warn && warn.ada) {
        alertEl.style.display = "block";
        alertEl.className =
          "peringatan-alert peringatan-" + warn.status.toLowerCase();
        alertEl.innerHTML =
          '<span class="alert-icon">⚠️</span> ' +
          warn.pesan +
          ' <span class="alert-close" onclick="this.parentElement.style.display=\'none\'">✕</span>';
      } else {
        alertEl.style.display = "none";
      }
    }

    const badgeEl = document.getElementById("prediksiKeandalan");
    if (badgeEl) {
      if (data.tipe === "klasifikasi") {
        badgeEl.innerText = "klasifikasi";
        badgeEl.className = "keandalan-badge badge-tidak";
      } else if (p1) {
        badgeEl.innerText = p1.keandalan || "-";
        badgeEl.className = "keandalan-badge badge-" + (p1.keandalan || "tidak");
      }
    }
  } catch (e) {
    console.error("ML prediksi error:", e);
  }
}

// ================= CLOCK =================
function updateClock() {
  const now = new Date();
  document.getElementById("clock").innerText =
    now.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
    " | " +
    now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
}



setInterval(updateClock, 1000);
updateClock();
loadAIPrediction();
