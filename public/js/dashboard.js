// ================= MAP =================
let map = L.map("map").setView([-7.284980, 112.802923], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let marker = L.marker([-7.284980, 112.802923]).addTo(map);

function updateMap(lat, lng) {
  map.setView([lat, lng], 15);
  marker.setLatLng([lat, lng]);
}

let activeLocation = "lokasi1";
const locations = {
  lokasi1: {
    name: "Keputih",
    lat: -7.284980,
    lng: 112.802923,
    device: 1
  },
  lokasi2: {
    name: "Hangtuah",
    lat: -7.290753,
    lng: 112.793255,
    device: 2
  },
  lokasi3: {
    name: "Kalikobor",
    lat: -7.286943,
    lng: 112.755689,
    device: 3
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

  // refresh data sensor
  fetchData();
}

document.getElementById("lokasi1").onclick = () => setLocation("lokasi1");
document.getElementById("lokasi2").onclick = () => setLocation("lokasi2");
document.getElementById("lokasi3").onclick = () => setLocation("lokasi3");

function getAPI() {
  const device = locations[activeLocation].device;
  return `https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php?device=${device}`;
}
// ================= API =================
const API_URL =
  "https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php";

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

  // ❌ NO DATA
  if (!latest || latest.distance1 == null) {
    indicator.style.display = "none";

    document.getElementById("current-time").innerText = "-";
    document.getElementById("current-distance").innerText = "- cm";
    document.getElementById("distance1-value").innerText = "-";
    document.getElementById("distance2-value").innerText = "-";

    badge.innerText = "NO DATA";
    badge.style.backgroundColor = "gray";

    return;
  }

  // ✅ ADA DATA
  indicator.style.display = "block";

  document.getElementById("current-time").innerText = latest.waktu;

  document.getElementById("current-distance").innerHTML =
    `${latest.distance1} <small>cm</small>`;

  document.getElementById("distance1-value").innerText = latest.distance1;
  document.getElementById("distance2-value").innerText = latest.distance2;

  // ================= STATUS FIX =================
  let status = latest.status;

  // 🔥 FIX: hindari undefined/null/empty
  if (!status || status === "undefined") {
    const value = parseFloat(latest.distance1);

    if (value >= 200) status = "AMAN";
    else if (value >= 100) status = "WASPADA";
    else status = "SIAGA";
  }

  badge.innerText = status;

  // ================= WARNA + POSISI =================
  if (status === "AMAN") {
    badge.style.backgroundColor = "green";
    indicator.style.left = "20%";
  } else if (status === "WASPADA") {
    badge.style.backgroundColor = "orange";
    indicator.style.left = "50%";
  } else {
    badge.style.backgroundColor = "red";
    indicator.style.left = "80%";
  }
}
  // ================= FETCH DATA =================
async function fetchData() {
  try {
    const device = locations[activeLocation].device;

    const res = await fetch(
      `${API_URL}?device=${device}`,
      {
        headers: { "ngrok-skip-browser-warning": "true" },
      }
    );

    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      updateSummary(null);
      return;
    }

    const rows = json.data.slice().reverse();

    const labels = rows.map((r) => formatTimeLabel(r.waktu));
    const values = rows.map((r) => parseFloat(r.distance1));

    rainChart.data.labels = labels;
    rainChart.data.datasets[0].data = values;
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
  const device = locations[activeLocation].device;
  const response = await fetch("/api/latest-prediction");
  const data = await response.json();

  if (data.success) {
    const pred = data.prediction.risk_prediction;
    const conf = data.prediction.confidence;
    const sensor = data.sensor;

    document.getElementById("statusText").innerText = pred;
    document.getElementById("confidenceText").innerText = conf;

    if (pred === "AWAS") {
      document.getElementById("statusIcon").innerText = "⚠";
      document.getElementById("statusDesc").innerText = "Risiko banjir tinggi";
    } else if (pred === "SIAGA") {
      document.getElementById("statusIcon").innerText = "!";
      document.getElementById("statusDesc").innerText = "Perlu pemantauan";
    } else {
      document.getElementById("statusIcon").innerText = "✔";
      document.getElementById("statusDesc").innerText = "Kondisi Normal";
    }
  }
  const forecastResponse = await fetch("/api/forecast-1hour");
  const forecastData = await forecastResponse.json();

  if (forecastData.success) {
    const forecast = forecastData.forecast;

    document.getElementById("forecastStatusText").innerText =
      forecast.status_next_1h;

    document.getElementById("forecastRainText").innerText =
      forecast.rainfall_next_1h;

    document.getElementById("forecastConfidenceText").innerText =
      forecast.confidence_next_1h;
    const forecastChartCanvas = document.getElementById("forecastRainChart");

    if (forecastChartCanvas) {
      if (window.forecastRainChartInstance) {
        window.forecastRainChartInstance.destroy();
      }
      window.forecastRainChartInstance = new Chart(forecastChartCanvas, {
        type: "line",
        data: {
          labels: ["Sekarang", "1 Jam ke Depan"],
          datasets: [
            {
              label: "Curah Hujan Aktual/Prediksi (mm)",
              data: [
                Number(forecastData.sensor.curah_hujan || 0),
                Number(forecast.rainfall_next_1h || 0),
              ],
              tension: 0.3,
            },
            {
              label: "Batas SIAGA (1 mm)",
              data: [1, 1],
              borderDash: [5, 5],
              pointRadius: 0,
            },
            {
              label: "Batas AWAS (3 mm)",
              data: [3, 3],
              borderDash: [5, 5],
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                afterLabel: function (context) {
                  const value = context.parsed.y;

                  if (value >= 3) return "Status: AWAS";
                  if (value >= 1) return "Status: SIAGA";
                  return "Status: AMAN";
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Curah Hujan (mm)",
              },
            },
          },
        },
      });
    }
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

setInterval(updateClock, 1000);
updateClock();

loadAIPrediction();
