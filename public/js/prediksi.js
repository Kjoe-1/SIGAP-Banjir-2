let activeLokasi = 3;
const LOKASI_DATA = {
  1: { name: "Pucanganom", ml: 1 },
  2: { name: "UHT", ml: 2 },
  3: { name: "Kalikobor", ml: 3 },
};

function setLokasi(fe) {
  activeLokasi = fe;
  const d = LOKASI_DATA[fe];
  document.getElementById("headerLokasi").innerText = d.name;
  document.getElementById("forecastLokasiLabel").innerText = d.name;

  document.querySelectorAll("[id^=navLok]").forEach((el) => {
    el.className = "flex items-center gap-2 px-2 py-1 border border-primary bg-surface brutal-shadow hover:bg-surface-container-highest active:scale-95 transition-transform cursor-pointer";
  });
  const activeEl = document.getElementById("navLok" + fe);
  if (activeEl) {
    activeEl.className = "flex items-center gap-2 px-2 py-1 border-2 border-primary bg-secondary text-on-secondary font-bold brutal-shadow active:scale-95 transition-transform cursor-pointer";
  }

  resetHorizon("6");
  muatData();
}

document.getElementById("navLok1").onclick = () => setLokasi(1);
document.getElementById("navLok2").onclick = () => setLokasi(2);
document.getElementById("navLok3").onclick = () => setLokasi(3);

function resetHorizon(h) {
  document.querySelectorAll(".horizon-btn").forEach((b) => {
    b.className = "horizon-btn px-2 py-1 border-2 border-primary bg-surface text-primary font-label-caps hover:bg-primary/10 transition-colors cursor-pointer";
  });
  const btn = document.querySelector(`.horizon-btn[data-h="${h}"]`);
  if (btn) btn.className = "horizon-btn px-2 py-1 border-2 border-primary bg-primary text-on-primary font-label-caps pointer-events-none";
  window._horizon = h;
}

document.getElementById("horizonTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".horizon-btn");
  if (!btn || btn.dataset.h === window._horizon) return;
  resetHorizon(btn.dataset.h);
  muatBanding();
});

async function muatData() {
  await Promise.all([muatPrediksi(), muatBanding()]);
}

async function muatPrediksi() {
  try {
    const res = await fetch("/api/prediksi?lokasi=" + activeLokasi);
    const data = await res.json();
    if (!data.success) {
      document.getElementById("metricStatus").innerText = "OFFLINE";
      document.getElementById("metricStatusDesc").innerText = "Sensor offline — data realtime belum tersedia";
      document.getElementById("metricTinggi").innerText = "-";
      const p1el = document.getElementById("metricPred1");
      if (p1el) p1el.innerText = "-";
      return;
    }

    const skrg = data.sekarang;
    const pred = data.prediksi;
    const p1 = pred ? pred["1"] : null;

    document.getElementById("metricStatus").innerText = skrg.status;
    document.getElementById("metricStatusDesc").innerText = data.fallback_demo
      ? "⚠️ DATA DEMO (koneksi sensor gagal)"
      : (data.catatan || "Kondisi Normal");
    document.getElementById("metricTinggi").innerText = skrg.tinggi_air_cm != null ? skrg.tinggi_air_cm : "-";
    document.getElementById("metricTrend").innerText = (skrg.distance_cm != null ? "Jarak: " + skrg.distance_cm + " cm" : "-");

    const maxH = 300;
    const tinggi = skrg.tinggi_air_cm || 0;
    const gaugeNow = document.getElementById("gaugeNow");
    if (gaugeNow) gaugeNow.style.height = Math.min(tinggi / maxH * 100, 95) + "%";

    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("metricPred1").innerText = p1.tinggi_air_cm != null ? p1.tinggi_air_cm : "-";
      document.getElementById("metricPred1Label").innerText = p1.status + (p1.keandalan ? " (" + p1.keandalan + ")" : "");
      const gaugePred = document.getElementById("gaugePred");
      if (gaugePred) gaugePred.style.height = Math.min((p1.tinggi_air_cm || 0) / maxH * 100, 95) + "%";
    }

    const badgeEl = document.getElementById("sidebarKeandalan");
    if (badgeEl) badgeEl.innerText = data.tipe === "klasifikasi" ? "klasifikasi" : (p1 ? p1.keandalan || "-" : "-");

    // Forecast bars (7 history bars + 5 prediction bars)
    const barContainer = document.getElementById("forecastBars");
    if (barContainer && (pred || data.histori)) {
      const H = [1, 3, 6, 12, 24];
      const bars = barContainer.children;
      const barCount = bars.length;
      const history = data.histori || [];
      for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        let h = 10, cls = "bg-primary border border-primary", label = "-";

        if (i < barCount - H.length) {
          // Historical data (first 7 bars)
          const hIdx = i - (barCount - H.length - history.length); // align to right if history is shorter than 7
          const histPoint = hIdx >= 0 && hIdx < history.length ? history[hIdx] : null;
          if (histPoint && histPoint.tinggi_air_cm != null) {
            h = Math.min(histPoint.tinggi_air_cm / maxH * 100, 95);
            label = histPoint.tinggi_air_cm + "cm";
            cls = histPoint.status === "SIAGA"
              ? "bg-secondary-container halftone-pink border-2 border-primary shadow-[2px_0_0_0_#094e87] z-10"
              : histPoint.status === "WASPADA"
                ? "bg-surface-variant stripe-bg border border-primary border-dashed"
                : "bg-primary border border-primary";
          }
        } else {
          // Forecast data (last 5 bars)
          const idx = H[i - (barCount - H.length)];
          const p = pred ? pred[String(idx)] : null;
          if (p && p.tinggi_air_cm != null) {
            h = Math.min(p.tinggi_air_cm / maxH * 100, 95);
            label = p.tinggi_air_cm + "cm";
            cls = p.status === "SIAGA"
              ? "bg-secondary-container halftone-pink border-2 border-primary shadow-[2px_0_0_0_#094e87] z-10"
              : p.status === "WASPADA"
                ? "bg-surface-variant stripe-bg border border-primary border-dashed"
                : "bg-primary border border-primary";
          }
        }
        bar.style.height = h + "%";
        bar.className = "flex-1 " + cls + " relative group cursor-pointer transition-all duration-500";
        const tip = bar.querySelector("div");
        if (tip) tip.innerText = label;
      }
    }
  } catch (e) {
    console.error("Prediksi error:", e);
  }
}

let bandingChart = null;

function initBandingChart() {
  const ctx = document.getElementById("bandingChart");
  if (!ctx) return;

  // Set default font to match the brutalist styling
  Chart.defaults.font.family = "'Work Sans', sans-serif";
  Chart.defaults.font.size = 10;
  Chart.defaults.color = "#000000";

  bandingChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "DATA ASLI",
          data: [],
          borderColor: "#000000",
          backgroundColor: "transparent",
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: "PREDIKSI",
          data: [],
          borderColor: "#1d70b8",
          backgroundColor: "transparent",
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          mode: "index",
          intersect: false,
          backgroundColor: "#FFFDF0",
          titleColor: "#000000",
          bodyColor: "#000000",
          borderColor: "#000000",
          borderWidth: 2,
          cornerRadius: 0,
          titleFont: { weight: 'bold' },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += context.parsed.y + ' cm';
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(0, 0, 0, 0.05)"
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 5,
            padding: 8,
          }
        },
        y: {
          grid: {
            color: "rgba(0, 0, 0, 0.08)"
          },
          beginAtZero: true,
          grace: "10%",
          ticks: {
            padding: 8,
            callback: function(value) {
              return value + " cm";
            }
          }
        }
      }
    }
  });
}

async function muatBanding() {
  const container = document.getElementById("bandingChartContainer");
  if (container) container.style.opacity = "0.5";
  try {
    const res = await fetch("/api/perbandingan?lokasi=" + activeLokasi + "&max=50");
    const data = await res.json();
    if (container) container.style.opacity = "1.0";
    if (!data.success) {
      document.getElementById("bandingAkurasi").innerText = "-";
      document.getElementById("bandingDeviasi").innerText = "-";
      return;
    }

    const h = window._horizon || "6";
    const hData = data[h];
    if (!hData || !hData.waktu || hData.waktu.length < 2) {
      document.getElementById("bandingAkurasi").innerText = "Data tidak cukup";
      document.getElementById("bandingDeviasi").innerText = "-";
      return;
    }

    // Stats
    const diffs = hData.prediksi.map((p, i) => Math.abs(p - hData.aktual[i]));
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const accuracy = Math.max(0, Math.min(100, 100 - avgDiff * 2));
    document.getElementById("bandingAkurasi").innerText = accuracy.toFixed(1) + "%";
    document.getElementById("bandingDeviasi").innerText = "± " + avgDiff.toFixed(1) + " cm";

    // Format dates nicely for labels
    const labels = hData.waktu.map((w) => {
      const d = new Date(w);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    });

    if (!bandingChart) {
      initBandingChart();
    }

    if (bandingChart) {
      bandingChart.data.labels = labels;
      bandingChart.data.datasets[0].data = hData.aktual;
      bandingChart.data.datasets[1].data = hData.prediksi;
      bandingChart.update();
    }

    // Update date label: show range of data
    const firstDate = new Date(hData.waktu[0]);
    const lastDate = new Date(hData.waktu[hData.waktu.length - 1]);
    const fmt = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const dateLabel = document.getElementById("bandingDateRange");
    if (dateLabel) dateLabel.innerText = fmt(firstDate) + " — " + fmt(lastDate);

  } catch (e) {
    if (container) container.style.opacity = "1.0";
    console.error("Banding error:", e);
  }
}

muatData();
