// ================= MAP =================
let map = L.map("map").setView([-7.284980, 112.802923], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let marker = L.marker([-7.284980, 112.802923]).addTo(map);

function updateMap(lat, lng) {
  map.setView([lat, lng], 15);
  marker.setLatLng([lat, lng]);
}

let activeLocation = "lokasi3";
const locations = {
  lokasi1: {
    name: "Keputih",
    lat: -7.284980,
    lng: 112.802923,
    lokasi: 1
  },
  lokasi2: {
    name: "Hangtuah",
    lat: -7.290753,
    lng: 112.793255,
    lokasi: 2
  },
  lokasi3: {
    name: "Kalikobor",
    lat: -7.286943,
    lng: 112.755689,
    lokasi: 3
  }
};

function setLocation(key) {
  activeLocation = key;

  const loc = locations[key];

  // update map
  updateMap(loc.lat, loc.lng);

  // update UI text
  document.getElementById("active-location").innerText = loc.name;
  document.getElementById("lokasi-text").innerText = loc.name;

  // update active button
  document.querySelectorAll(".location-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.getElementById(key).classList.add("active");

  updateModeUI();
  fetchData();
  horizonAktif = "1";
  document.querySelectorAll(".horizon-btn").forEach((b) => b.classList.remove("active"));
  const h1 = document.querySelector('.horizon-btn[data-h="1"]');
  if (h1) h1.classList.add("active");
  loadAIPrediction();
}

document.getElementById("lokasi1").onclick = () => setLocation("lokasi1");
document.getElementById("lokasi2").onclick = () => setLocation("lokasi2");
document.getElementById("lokasi3").onclick = () => setLocation("lokasi3");

function getAPI() {
  const id = locations[activeLocation].lokasi;
  return `https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php?lokasi=${id}`;
}

// ================= CHART =================
const ctx = document.getElementById("rainChart");

const rainChart = new Chart(ctx, {
  type: "line",
data: {
  labels: [],
  datasets: [
    {
      label: "Tinggi muka Air (cm)",
      data: [],
      borderColor: "#00bcd4",
      backgroundColor: "transparent",
      tension: 0.3,
      pointRadius: 2
    }
  ]
},
options: {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: {
      display: false
    }
  },

  scales: {
    x: {
      ticks: {
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6,
        padding: 15
      }
    },
    y: {
      beginAtZero: true,
      grace: "10%"
      },
    },
  },
});

// ================= MODE SENSOR =================
function isWeatherMode() {
  return locations[activeLocation].lokasi === 2;
}

function updateModeUI() {
  const weather = isWeatherMode();
  const ws = document.getElementById("weatherSection");
  const wl = document.getElementById("waterLevelSection");
  if (ws) ws.style.display = weather ? "block" : "none";
  if (wl) wl.style.display = weather ? "none" : "block";
  const sb = document.querySelector(".status-bar");
  const sl = document.querySelector(".status-label");
  if (sb) sb.style.display = weather ? "none" : "block";
  if (sl) sl.style.display = weather ? "none" : "block";

  const ml1 = document.getElementById("miniLabel1");
  const ml2 = document.getElementById("miniLabel2");
  const ct = document.getElementById("chartTitle");
  if (weather) {
    if (ml1) ml1.innerText = "Suhu";
    if (ml2) ml2.innerText = "Kelembaban";
    if (ct) ct.innerText = "Grafik Suhu (°C)";
  } else {
    if (ml1) ml1.innerText = "Distance 1";
    if (ml2) ml2.innerText = "Distance 2";
    if (ct) ct.innerText = "Grafik Tinggi Muka Air (cm)";
  }
}

// ================= FORMAT TIME =================
function formatTimeLabel(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ================= UPDATE SUMMARY =================
function updateSummary(latest) {
  const indicator = document.getElementById("indicator");
  const badge = document.getElementById("status-badge");
  const weather = isWeatherMode();

  if (!latest) {
    indicator.style.display = "none";
    document.getElementById("current-time").innerText = "-";
    document.getElementById("current-distance").innerText = "-";
    document.getElementById("distance1-value").innerText = "-";
    document.getElementById("distance2-value").innerText = "-";

    if (weather) {
      ["temp","humi","windavg","windmax","windir","baro","rain1h","rain24h"].forEach(id => {
        const el = document.getElementById("weather-" + id);
        if (el) el.innerText = "-";
      });
    }

    badge.innerText = "NO DATA";
    badge.style.backgroundColor = "gray";
    return;
  }

  document.getElementById("current-time").innerText = latest.waktu;
  badge.style.display = "inline-block";

  if (weather) {
    const set = (id, val, unit) => {
      const el = document.getElementById("weather-" + id);
      if (el) el.innerText = val != null ? val + " " + unit : "-";
    };
    set("temp", latest.temp, "°C");
    set("humi", latest.humi, "%");
    set("windavg", latest.windavg, "m/s");
    set("windmax", latest.windmax, "m/s");
    set("windir", latest.windir, "°");
    set("baro", latest.baro, "hPa");
    set("rain1h", latest.curah_hujan, "mm");
    set("rain24h", latest.rain24h, "mm");

    document.getElementById("current-distance").innerHTML =
      (latest.curah_hujan != null ? latest.curah_hujan : "-") + ' <small>mm</small>';
    document.getElementById("distance1-value").innerText = latest.temp != null ? latest.temp + " °C" : "-";
    document.getElementById("distance2-value").innerText = latest.humi != null ? latest.humi + " %" : "-";

    const rain = parseFloat(latest.curah_hujan) || 0;
    const st = rain >= 3 ? "AWAS" : rain >= 1 ? "SIAGA" : "AMAN";

    badge.innerText = st;
    indicator.style.display = "none";
    badge.style.backgroundColor = st === "AMAN" ? "green" : st === "SIAGA" ? "orange" : "red";
  } else {
    indicator.style.display = "block";
    document.getElementById("current-distance").innerHTML = `${latest.distance1} <small>cm</small>`;
    document.getElementById("distance1-value").innerText = latest.distance1;
    document.getElementById("distance2-value").innerText = latest.distance2;

    let status = latest.status;
    if (!status || status === "undefined") {
      const v = parseFloat(latest.distance1);
      status = v >= 200 ? "AMAN" : v >= 100 ? "WASPADA" : "SIAGA";
    }

    badge.innerText = status;
    badge.style.backgroundColor = status === "AMAN" ? "green" : status === "WASPADA" ? "orange" : "red";
    indicator.style.left = status === "AMAN" ? "20%" : status === "WASPADA" ? "50%" : "80%";
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
    const weather = isWeatherMode();

    const labels = rows.map((r) => formatTimeLabel(r.waktu));
    const values = rows.map((r) =>
      weather ? parseFloat(r.temp) : parseFloat(r.distance1)
    );

    rainChart.data.labels = labels;
    rainChart.data.datasets[0].data = values;
    rainChart.data.datasets[0].label = weather ? "Suhu (°C)" : "Tinggi Muka Air (cm)";
    rainChart.update();

    const latest = rows[rows.length - 1];
    updateSummary(latest);

    if (latest.lat && latest.lng) {
      updateMap(latest.lat, latest.lng);
    }
  } catch (err) {
    console.error(err);
    updateSummary(null);
  }
}
fetchData();
setInterval(fetchData, 10000);

// ================= AUTH BUTTON CONTROL =================
const loginBtn = document.getElementById("loginBtn");
const uploadBtn = document.getElementById("uploadBtn");
const logoutBtn = document.getElementById("logoutBtn");

function renderAuth() {
  const isLogin = localStorage.getItem("isLogin");

  if (isLogin === "true") {
    loginBtn.style.display = "none";
    uploadBtn.style.display = "inline-block";
    logoutBtn.style.display = "inline-block";
  } else {
    loginBtn.style.display = "inline-block";
    uploadBtn.style.display = "none";
    logoutBtn.style.display = "none";
  }
}

// ================= EVENT =================
loginBtn.onclick = () => {
  window.location.href = "/login.html";
};

uploadBtn.onclick = () => {
  window.location.href = "/upload.html";
};

logoutBtn.onclick = logout;

// ================= LOGOUT ANIMATION =================
function logout() {
  document.body.style.transition = "opacity 0.6s ease";
  document.body.style.opacity = "0";

  setTimeout(() => {
    localStorage.removeItem("isLogin");
    window.location.href = "/login.html";
  }, 600);
}
// ================= INIT =================
renderAuth();

async function loadAIPrediction() {
  try {
    const feLokasi = locations[activeLocation].lokasi;
    const res = await fetch(`/api/prediksi?lokasi=${feLokasi}`);
    const data = await res.json();

    if (!data.success) return;

    const skrg = data.sekarang;
    const pred = data.prediksi;
    const warn = data.peringatan;

    // Status card
    document.getElementById("statusText").innerText = skrg.status;
    document.getElementById("confidenceText").innerText =
      skrg.confidence != null ? Math.round(skrg.confidence * 100) + "%" : "-";

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

    // Forecast status (1 jam ke depan)
    const p1 = pred["1"];
    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("forecastStatusText").innerText = p1.status;
      document.getElementById("forecastRainText").innerText =
        p1.tinggi_air_cm != null ? p1.tinggi_air_cm : "-";
      document.getElementById("forecastConfidenceText").innerText =
        p1.confidence != null ? Math.round(p1.confidence * 100) + "%" : "-";
    }

    // Warning alert
    const alertEl = document.getElementById("peringatanAlert");
    if (warn && warn.ada) {
      alertEl.style.display = "block";
      alertEl.className = "peringatan-alert peringatan-" + warn.status.toLowerCase();
      alertEl.innerHTML =
        '<span class="alert-icon">⚠️</span> ' +
        warn.pesan +
        ' <span class="alert-close" onclick="this.parentElement.style.display=\'none\'">✕</span>';
    } else {
      alertEl.style.display = "none";
    }

    // Keandalan badge
    const badgeEl = document.getElementById("prediksiKeandalan");
    if (data.tipe === "klasifikasi") {
      badgeEl.innerText = "klasifikasi";
      badgeEl.className = "keandalan-badge badge-tidak";
    } else if (p1) {
      badgeEl.innerText = p1.keandalan || "-";
      badgeEl.className = "keandalan-badge badge-" + (p1.keandalan || "tidak");
    }

  } catch (e) {
    console.error("AI prediksi error:", e);
  }
  loadPerbandingan();
}

// ================= PERBANDINGAN PREDIKSI VS AKTUAL =================
let horizonAktif = "1";

async function loadPerbandingan() {
  try {
    const feLokasi = locations[activeLocation].lokasi;
    const res = await fetch(`/api/perbandingan?lokasi=${feLokasi}&max=50`);
    const data = await res.json();

    if (!data.success) return;

    const hData = data[horizonAktif];
    if (!hData || !hData.waktu || hData.waktu.length === 0) return;

    const labels = hData.waktu.map((t) => {
      const d = new Date(t);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }) +
        " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    });

    const canvas = document.getElementById("prediksiChart");
    if (!canvas) return;
    if (window.prediksiChartInstance) window.prediksiChartInstance.destroy();

    window.prediksiChartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Hasil Prediksi",
            data: hData.prediksi,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,236,0.1)",
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
          },
          {
            label: "Data Asli",
            data: hData.aktual,
            borderColor: "#f97316",
            backgroundColor: "rgba(249,115,22,0.1)",
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + " cm";
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, font: { size: 10 }, maxTicksLimit: 10 },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Tinggi Air (cm)" },
          },
        },
      },
    });
  } catch (e) {
    console.error("Perbandingan error:", e);
  }
}

function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  document.getElementById("clock").innerText = `${date} | ${time}`;
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
