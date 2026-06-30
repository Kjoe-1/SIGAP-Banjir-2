// ================= MAP =================
function updateMap(lat, lng) {
  const iframe = document.getElementById("mapIframe");
  if (iframe) {
    iframe.src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  }
}

// ================= LOKASI =================
let activeLocation = "lokasi3";
const locations = {
  lokasi1: { name: "Pucanganom", lat: -7.28498, lng: 112.802923, lokasi: 1, image: "pucanganom.png" },
  lokasi2: { name: "UHT", lat: -7.290753, lng: 112.793255, lokasi: 2, image: "uht.png" },
  lokasi3: { name: "kalibokor", lat: -7.286943, lng: 112.755689, lokasi: 3, image: "kalibokor.png" },
};

function setLocation(key) {
  activeLocation = key;
  const loc = locations[key];
  updateMap(loc.lat, loc.lng);
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.innerText = t; };
  setText("activeLocation", loc.name);
  setText("lokasiText", loc.name);
  setText("summaryLokasi", loc.name);

  // update photo
  const photoEl = document.getElementById("lokasiPhoto");
  if (photoEl && loc.image) {
    photoEl.src = loc.image;
    photoEl.alt = "Foto Lokasi " + loc.name;
  }

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
Chart.register(
    ChartDataLabels,
    window["chartjs-plugin-annotation"]
);

const ctx = document.getElementById("rainChart");
const rainChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Tinggi Muka Air (cm)",
        data: [],
        borderColor: "#1d70b8",
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  },
  options:{

    responsive:true,
    maintainAspectRatio:false,

    plugins:{

        legend:{
            display:true,
            position:"top"
        },

        tooltip:{
            enabled:true
        },

        datalabels:{
            color:"#333",
            align:"top",
            anchor:"end",
            font:{
                weight:"bold",
                size:10
            },
            formatter:(v)=>v.toFixed(1)
        },

        annotation:{
            annotations:{

                dasar:{
                    type:"line",
                    yMin:0,
                    yMax:0,
                    borderColor:"#2d3748",
                    borderWidth:2,
                    label:{
                        display:true,
                        content:"PANGKAL SUNGAI"
                    }
                },

                waspada:{
                    type:"line",
                    yMin:120,
                    yMax:120,
                    borderColor:"#d69e2e",
                    borderDash:[8,5],
                    borderWidth:2,
                    label:{
                        display:true,
                        content:"WASPADA"
                    }
                },

                siaga:{
                    type:"line",
                    yMin:150,
                    yMax:150,
                    borderColor:"#e53e3e",
                    borderDash:[8,5],
                    borderWidth:2,
                    label:{
                        display:true,
                        content:"SIAGA"
                    }
                },

                bibir:{
                    type:"line",
                    yMin:370,
                    yMax:370,
                    borderColor:"#6b4f1d",
                    borderWidth:2,
                    label:{
                        display:true,
                        content:"BIBIR SUNGAI 370 cm"
                    }
                },

                area:{
                    type:"box",
                    yMin:370,
                    yMax:450,
                    backgroundColor:"rgba(255,0,0,0.08)",
                    borderWidth:0
                }

            }
        }

    },

    scales:{

        y:{
            beginAtZero:true,
            suggestedMax:400
        },

        x:{}

    }

}
});

// ================= FORMAT TIME =================
function formatTimeLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ================= UPDATE SUMMARY =================
const REF_HEIGHTS = {
  lokasi1: 300.01,
  lokasi2: 466.0,
  lokasi3: 545.0,
};

const HEIGHT_CONFIGS = {
  lokasi1: { bibir: 300, tengah: 150, pangkal: 0, waspada: 110, siaga: 130 },
  lokasi2: { bibir: 290, tengah: 145, pangkal: 0, waspada: 150, siaga: 190 },
  lokasi3: { bibir: 380, tengah: 190, pangkal: 0, waspada: 120, siaga: 150 },
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
      { value: tempVal.toFixed(1) + " °C", label: "Suhu", percent: Math.min((tempVal / 50) * 100, 100), fillClass: "" },
      { value: humiVal.toFixed(1) + " %", label: "Kelembaban", percent: humiVal, fillClass: "" },
      { value: rainVal.toFixed(1) + " mm", label: "Hujan (1h)", percent: Math.min((rainVal / 30) * 100, 100), fillClass: "" },
      { value: baroVal > 0 ? baroVal.toFixed(0) + " hPa" : "-", label: "Tekanan", percent: baroVal > 0 ? Math.min(((baroVal - 950) / 100) * 100, 100) : 0, fillClass: "" }
    ];
  } else if (locId === 1) {
    // Pucanganom (Rainfall): curah_hujan_1h, jumlah_tip, distance1, distance2
    const rainVal = parseFloat(latest.curah_hujan_1h) || 0;
    const tipVal = parseInt(latest.jumlah_tip) || 0;
    const d1 = parseFloat(latest.distance1) || 0;
    const d2 = parseFloat(latest.distance2) || 0;

    gauges = [
      { value: rainVal.toFixed(1) + " mm", label: "Hujan (1h)", percent: Math.min((rainVal / 30) * 100, 100), fillClass: "" },
      { value: tipVal, label: "Jumlah Tip", percent: Math.min((tipVal / 50) * 100, 100), fillClass: "" },
      { value: d1 > 0 ? d1.toFixed(0) + " cm" : "-", label: "Jarak 1", percent: d1 > 0 ? Math.min((d1 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" },
      { value: d2 > 0 ? d2.toFixed(0) + " cm" : "-", label: "Jarak 2", percent: d2 > 0 ? Math.min((d2 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" }
    ];
  } else {
    // Kalibokor (Water level): distance1, distance2
    const d1 = parseFloat(latest.distance1) || 0;
    const d2 = parseFloat(latest.distance2) || 0;

    gauges = [
      { value: d1 > 0 ? d1.toFixed(0) + " cm" : "OFFLINE", label: "Sensor 1 (Jarak)", percent: d1 > 0 ? Math.min((d1 / 600) * 100, 100) : 0, fillClass: "bg-surface-variant" },
      { value: d2 > 0 ? d2.toFixed(0) + " cm" : "OFFLINE", label: "Sensor 2 (Jarak)", percent: d2 > 0 ? Math.min((d2 / 600) * 100, 100) : 0, fillClass: "" }
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
      badge.style.color = "white";
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
    // Kalibokor: distance1 is known broken (flat 0), fallback to distance2
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
    // Offline state
    if (ind) ind.style.display = "none";
    document.getElementById("current-distance").innerHTML = "OFFLINE";
    setElText(statTinggi, "-");
    setElText(statStatus, "OFFLINE");
    
    if (badge) {
      badge.innerText = "OFFLINE";
      badge.style.backgroundColor = "gray";
      badge.style.color = "white";
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
    lokasi2: { waspada: 150, siaga: 190 },
    lokasi3: { waspada: 120, siaga: 150 },
  }[activeLocation];

  let st = "AMAN";
  if (tinggiAir >= thresholds.siaga) {
    st = "SIAGA";
  } else if (tinggiAir >= thresholds.waspada) {
    st = "WASPADA";
  }

  setElText(statStatus, st);
  if (statStatus) {
    if (st === "AMAN") {
      statStatus.style.color = "#10b981"; // green
    } else if (st === "WASPADA") {
      statStatus.style.color = "#eab308"; // yellow
    } else if (st === "SIAGA") {
      statStatus.style.color = "#ef4444"; // red
    } else {
      statStatus.style.color = "";
    }
  }

  if (badge) {
    badge.innerText = st;
    badge.style.backgroundColor =
      st === "AMAN" ? "#10b981" : st === "WASPADA" ? "#eab308" : "#ef4444";
    badge.style.color = "white";
  }

  if (ind) {
    ind.style.display = "block";
    ind.style.left = st === "AMAN" ? "20%" : st === "WASPADA" ? "50%" : "80%";
  }

  // Update dynamic threshold labels
  const labelAman = document.getElementById("threshold-aman");
  const labelWaspada = document.getElementById("threshold-waspada");
  const labelSiaga = document.getElementById("threshold-siaga");

  if (labelAman && labelWaspada && labelSiaga) {
    if (activeLocation === "lokasi1") {
      labelAman.innerText = "AMAN (< 110 cm)";
      labelWaspada.innerText = "WASPADA (110-130 cm)";
      labelSiaga.innerText = "SIAGA (≥ 130 cm)";
    } else if (activeLocation === "lokasi2") {
      labelAman.innerText = "AMAN (< 150 cm)";
      labelWaspada.innerText = "WASPADA (150-190 cm)";
      labelSiaga.innerText = "SIAGA (≥ 190 cm)";
    } else if (activeLocation === "lokasi3") {
      labelAman.innerText = "AMAN (< 120 cm)";
      labelWaspada.innerText = "WASPADA (120-150 cm)";
      labelSiaga.innerText = "SIAGA (≥ 150 cm)";
    }
  }

  updateGauges(latest, tinggiAir, distance);
}

// ================= UPDATE HISTORY TABLE =================
function updateHistoryTable(rows) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-outline">TIDAK ADA DATA</td></tr>`;
    return;
  }

  const ref = REF_HEIGHTS[activeLocation];
  const thresholds = {
    lokasi1: { waspada: 110, siaga: 130 },
    lokasi2: { waspada: 150, siaga: 190 },
    lokasi3: { waspada: 120, siaga: 150 },
  }[activeLocation];

  rows.forEach((r) => {
    const d1 = parseFloat(r.distance1);
    const d2 = parseFloat(r.distance2);

    let distance = null;
    if (activeLocation === "lokasi3") {
      const d1Valid = d1 > 10 && d1 < 600;
      const d2Valid = d2 > 10 && d2 < 600;
      if (d2Valid) distance = d2;
      else if (d1Valid) distance = d1;
    } else {
      const d1Valid = d1 > 10 && d1 < 600;
      const d2Valid = d2 > 10 && d2 < 600;
      if (d1Valid) distance = d1;
      else if (d2Valid) distance = d2;
    }

    let tinggiAirStr = "-";
    let statusStr = "AMAN";
    let statusClass = "bg-primary border-primary text-on-primary";

    if (distance === null) {
      statusStr = "OFFLINE";
      statusClass = "bg-surface-container border border-primary px-2 py-0.5 rounded text-outline";
    } else {
      const tinggiAir = ref - distance;
      tinggiAirStr = Math.max(0, tinggiAir).toFixed(1) + " cm";

      if (tinggiAir >= thresholds.siaga) {
        statusStr = "SIAGA";
        statusClass = "bg-danger text-white border border-primary px-2 py-0.5 rounded";
      } else if (tinggiAir >= thresholds.waspada) {
        statusStr = "WASPADA";
        statusClass = "bg-warning text-black border border-primary px-2 py-0.5 rounded";
      } else {
        statusClass = "bg-success text-white border border-primary px-2 py-0.5 rounded";
      }
    }

    // format time string nicely
    const date = new Date(r.waktu || r.time);
    const timeStr = date.toLocaleString("id-ID", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const tr = document.createElement("tr");
    tr.className = "border-b border-primary hover:bg-surface-container-highest transition-colors";
    tr.innerHTML = `
      <td class="p-3 border-r-2 border-primary">${timeStr}</td>
      <td class="p-3 border-r-2 border-primary">${d1 > 0 ? d1.toFixed(1) + " cm" : "-"}</td>
      <td class="p-3 border-r-2 border-primary">${d2 > 0 ? d2.toFixed(1) + " cm" : "-"}</td>
      <td class="p-3 border-r-2 border-primary font-bold">${tinggiAirStr}</td>
      <td class="p-3"><span class="font-bold font-label-caps text-xs ${statusClass}">${statusStr}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ================= FETCH DATA =================
async function fetchData() {
  try {
    const res = await fetch(getAPI());
    const json = await res.json();
    updateModeUI();

    if (!json.data || json.data.length === 0) {
      updateSummary(null);
      updateHistoryTable(null);
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

    // Update dynamic annotations and scales to match configuration
    const cfg = HEIGHT_CONFIGS[activeLocation];
    if (cfg && rainChart.options.plugins && rainChart.options.plugins.annotation) {
      rainChart.options.plugins.annotation.annotations = {
        dasar: {
          type: "line",
          yMin: cfg.pangkal,
          yMax: cfg.pangkal,
          borderColor: "#2d3748",
          borderWidth: 2,
          label: {
            display: true,
            content: "PANGKAL SUNGAI " + cfg.pangkal + " cm (dasar)",
            position: "start",
            backgroundColor: "#1a202c",
            color: "#ffffff",
            font: { weight: "bold", size: 10 },
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
            borderRadius: 4
          }
        },
        tengah: {
          type: "line",
          yMin: cfg.tengah,
          yMax: cfg.tengah,
          borderColor: "#4a5568",
          borderDash: [5, 5],
          borderWidth: 2,
          label: {
            display: true,
            content: "TENGAH SUNGAI " + cfg.tengah + " cm",
            position: "start",
            backgroundColor: "#4a5568",
            color: "#ffffff",
            font: { weight: "bold", size: 10 },
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
            borderRadius: 4
          }
        },
        bibir: {
          type: "line",
          yMin: cfg.bibir,
          yMax: cfg.bibir,
          borderColor: "#6b4f1d",
          borderWidth: 2.5,
          label: {
            display: true,
            content: "BIBIR SUNGAI " + cfg.bibir + " cm (titik meluap)",
            position: "start",
            backgroundColor: "#6b4f1d",
            color: "#ffffff",
            font: { weight: "bold", size: 10 },
            padding: { top: 4, bottom: 4, left: 6, right: 6 },
            borderRadius: 4
          }
        },
        waspada: {
          type: "line",
          yMin: cfg.waspada,
          yMax: cfg.waspada,
          borderColor: "#d69e2e",
          borderDash: [8, 5],
          borderWidth: 2,
          label: {
            display: true,
            content: "WASPADA " + cfg.waspada,
            position: "end",
            backgroundColor: "transparent",
            color: "#d69e2e",
            font: { weight: "bold", size: 10 }
          }
        },
        siaga: {
          type: "line",
          yMin: cfg.siaga,
          yMax: cfg.siaga,
          borderColor: "#e53e3e",
          borderDash: [8, 5],
          borderWidth: 2,
          label: {
            display: true,
            content: "SIAGA " + cfg.siaga,
            position: "end",
            backgroundColor: "transparent",
            color: "#e53e3e",
            font: { weight: "bold", size: 10 }
          }
        },
        area: {
          type: "box",
          yMin: cfg.bibir,
          yMax: cfg.bibir + 100,
          backgroundColor: "rgba(255, 0, 0, 0.05)",
          borderWidth: 0
        }
      };
      if (rainChart.options.scales && rainChart.options.scales.y) {
        rainChart.options.scales.y.suggestedMax = cfg.bibir + 50;
      }
    }
    rainChart.update();

    // Populate history table
    updateHistoryTable(json.data);

    const latest = rows[rows.length - 1];
    updateSummary(latest);
    if (latest.lat && latest.lng) updateMap(latest.lat, latest.lng);
  } catch (err) {
    console.error(err);
    updateSummary(null);
    updateHistoryTable(null);
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

    const statusTextEl = document.getElementById("statusText");
    if (statusTextEl) {
      statusTextEl.innerText = skrg.status;
      if (skrg.status === "AMAN") {
        statusTextEl.style.color = "#10b981"; // green
      } else if (skrg.status === "WASPADA") {
        statusTextEl.style.color = "#eab308"; // yellow
      } else if (skrg.status === "SIAGA") {
        statusTextEl.style.color = "#ef4444"; // red
      } else {
        statusTextEl.style.color = "";
      }
    }

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
        statusDesc.style.color = "#ef4444";
      } else if (skrg.status === "WASPADA") {
        statusDesc.innerText = "Waspada banjir";
        statusDesc.style.color = "#eab308";
      } else {
        statusDesc.innerText = "Kondisi Normal";
        statusDesc.style.color = "#10b981";
      }
    }

    if (p1 && p1.status !== "tidak_tersedia") {
      const forecastStatusTextEl = document.getElementById("forecastStatusText");
      if (forecastStatusTextEl) {
        forecastStatusTextEl.innerText = p1.status;
        if (p1.status === "AMAN") {
          forecastStatusTextEl.style.color = "#10b981";
        } else if (p1.status === "WASPADA") {
          forecastStatusTextEl.style.color = "#eab308";
        } else if (p1.status === "SIAGA") {
          forecastStatusTextEl.style.color = "#ef4444";
        } else {
          forecastStatusTextEl.style.color = "";
        }
      }

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



// ================= LIGHTBOX MODAL =================
window.openPhotoModal = function(src, caption) {
  const modal = document.getElementById("photoModal");
  const img = document.getElementById("modalPhotoImg");
  const cap = document.getElementById("modalPhotoCaption");
  if (modal && img) {
    img.src = src;
    if (cap) cap.innerText = caption || "Detail Lokasi";
    modal.classList.remove("hidden");
    // Force layout reflow
    modal.offsetWidth;
    modal.classList.add("opacity-100");
  }
};

window.closePhotoModal = function() {
  const modal = document.getElementById("photoModal");
  if (modal) {
    modal.classList.remove("opacity-100");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }
};

setInterval(updateClock, 1000);
updateClock();
loadAIPrediction();
