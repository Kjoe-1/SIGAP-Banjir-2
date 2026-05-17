// ================= MAP =================
let map = L.map("map").setView([-7.25, 112.75], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let marker = L.marker([-7.25, 112.75]).addTo(map);

function updateMap(lat, lng) {
  map.setView([lat, lng], 15);
  marker.setLatLng([lat, lng]);
}

// ================= API =================
const API_URL =
  "https://self-carrousel-culprit.ngrok-free.dev/api/get_ultrasonic.php";

// ================= CHART =================
const ctx = document.getElementById("rainChart");

const rainChart = new Chart(ctx, {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      {
        label: "Tinggi muka Air (cm)",
        data: [],
        backgroundColor: "rgba(54, 162, 235, 0.7)",
        barThickness: 20,
        maxBarThickness: 25,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,

    layout: {
      padding: {
        top: 10,
        bottom: 40, // 🔥 ruang buat label X
        left: 10,
        right: 10,
      },
    },

    plugins: {
      legend: {
        display: false,
      },
    },

    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
          padding: 15, // 🔥 dorong label X masuk
        },
      },
      y: {
        ticks: {
          padding: 5,
        },
        grace: "10%", // 🔥 chart naik sedikit
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
    const res = await fetch(API_URL, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    const json = await res.json();

    // ❌ kalau data kosong
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

// ================= FETCH DATA =================
async function fetchData() {
  try {
    const res = await fetch(API_URL, {
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    const json = await res.json();
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
  const response = await fetch("/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      distance_cm: 40.1,
      rainfall_mm: 3.3,
      tip_count: 11,
    }),
  });

  const data = await response.json();

  if (data.success) {
    const pred = data.prediction.risk_prediction;
    const conf = data.prediction.confidence;

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
}

loadAIPrediction();
