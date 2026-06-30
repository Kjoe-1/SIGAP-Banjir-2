let activeLokasi = 3;
const LOKASI_DATA = {
  1: { name: "Pucanganom", ml: 1 },
  2: { name: "UHT", ml: 2 },
  3: { name: "kalibokor", ml: 3 },
};

function resetHorizon(h) {
  window._horizon = h;
  const container = document.getElementById("horizonTabs");
  if (!container) return;
  
  container.querySelectorAll(".horizon-btn").forEach((btn) => {
    btn.className = "horizon-btn px-2 py-1 border-2 border-primary bg-surface font-label-caps hover:bg-primary hover:text-on-primary transition-colors";
  });
  
  const activeBtn = container.querySelector(`[data-h="${h}"]`);
  if (activeBtn) {
    activeBtn.className = "horizon-btn px-2 py-1 border-2 border-primary bg-secondary text-on-secondary font-bold translate-y-[-2px] brutal-shadow";
  }
}

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

  // Update dynamic threshold labels in legend
  const labelAman = document.getElementById("legend-aman");
  const labelWaspada = document.getElementById("legend-waspada");
  const labelSiaga = document.getElementById("legend-siaga");

  if (labelAman && labelWaspada && labelSiaga) {
    if (fe === 1) {
      labelAman.innerText = "AMAN (< 110 cm)";
      labelWaspada.innerText = "WASPADA (110-130 cm)";
      labelSiaga.innerText = "SIAGA (≥ 130 cm)";
    } else if (fe === 2) {
      labelAman.innerText = "AMAN (< 250 cm)";
      labelWaspada.innerText = "WASPADA (250-285 cm)";
      labelSiaga.innerText = "SIAGA (≥ 285 cm)";
    } else if (fe === 3) {
      labelAman.innerText = "AMAN (< 120 cm)";
      labelWaspada.innerText = "WASPADA (120-150 cm)";
      labelSiaga.innerText = "SIAGA (≥ 150 cm)";
    }
  }

  resetHorizon("6");
  muatData();
}

document.getElementById("navLok1").onclick = () => setLokasi(1);
document.getElementById("navLok2").onclick = () => setLokasi(2);
document.getElementById("navLok3").onclick = () => setLokasi(3);

-

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

    const statusEl = document.getElementById("metricStatus");
    if (statusEl) {
      statusEl.innerText = skrg.status;
      if (skrg.status === "AMAN") {
        statusEl.style.color = "#10b981";
      } else if (skrg.status === "WASPADA") {
        statusEl.style.color = "#eab308";
      } else if (skrg.status === "SIAGA") {
        statusEl.style.color = "#ef4444";
      } else {
        statusEl.style.color = "";
      }
    }

    const statusDescEl = document.getElementById("metricStatusDesc");
    if (statusDescEl) {
      statusDescEl.innerText = data.fallback_demo
        ? "⚠️ DATA DEMO (koneksi sensor gagal)"
        : (data.catatan || "Kondisi Normal");
      if (skrg.status === "AMAN") {
        statusDescEl.style.color = "#10b981";
      } else if (skrg.status === "WASPADA") {
        statusDescEl.style.color = "#eab308";
      } else if (skrg.status === "SIAGA") {
        statusDescEl.style.color = "#ef4444";
      } else {
        statusDescEl.style.color = "";
      }
    }

    document.getElementById("metricTinggi").innerText = skrg.tinggi_air_cm != null ? skrg.tinggi_air_cm : "-";
    document.getElementById("metricTrend").innerText = (skrg.distance_cm != null ? "Jarak: " + skrg.distance_cm + " cm" : "-");

    const maxH = 300;
    const tinggi = skrg.tinggi_air_cm || 0;
    const gaugeNow = document.getElementById("gaugeNow");
    if (gaugeNow) {
      gaugeNow.style.height = Math.min(tinggi / maxH * 100, 95) + "%";
      gaugeNow.className = "absolute bottom-0 left-0 right-0 border-t-2 border-primary transition-all duration-1000 " +
        (skrg.status === "SIAGA" ? "bg-danger" : skrg.status === "WASPADA" ? "bg-warning" : "bg-success");
    }

    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("metricPred1").innerText = p1.tinggi_air_cm != null ? p1.tinggi_air_cm : "-";
      
      const predLabel = document.getElementById("metricPred1Label");
      if (predLabel) {
        predLabel.innerText = p1.status + (p1.keandalan ? " (" + p1.keandalan + ")" : "");
        if (p1.status === "AMAN") {
          predLabel.style.color = "#10b981";
        } else if (p1.status === "WASPADA") {
          predLabel.style.color = "#eab308";
        } else if (p1.status === "SIAGA") {
          predLabel.style.color = "#ef4444";
        } else {
          predLabel.style.color = "";
        }
      }

      const gaugePred = document.getElementById("gaugePred");
      if (gaugePred) {
        gaugePred.style.height = Math.min((p1.tinggi_air_cm || 0) / maxH * 100, 95) + "%";
        gaugePred.className = "absolute bottom-0 left-0 right-0 border-t-2 border-primary transition-all duration-1000 " +
          (p1.status === "SIAGA" ? "bg-danger" : p1.status === "WASPADA" ? "bg-warning" : "bg-success");
      }
    }

    const badgeEl = document.getElementById("sidebarKeandalan");
    if (badgeEl) badgeEl.innerText = data.tipe === "klasifikasi" ? "klasifikasi" : (p1 ? p1.keandalan || "-" : "-");

    // Update forecast line chart
    updateForecastChart(data);
  } catch (e) {
    console.error("Prediksi error:", e);
  }
}

let forecastChart = null;

function updateForecastChart(data) {
  const ctx = document.getElementById("forecastChart");
  if (!ctx) return;

  const skrg = data.sekarang || {};
  const pred = data.prediksi || {};
  const thresholds = data.ambang || { waspada: 120, siaga: 150 };

  const labels = [];
  const predData = [];

  // Add 1h, 3h, 6h predictions
  const H = [1, 3, 6];
  H.forEach((hVal) => {
    labels.push("+" + hVal + " Jam");
    const p = pred[String(hVal)];
    predData.push(p && p.tinggi_air_cm != null ? p.tinggi_air_cm : null);
  });

  const totalPoints = labels.length;
  const waspadaLine = Array(totalPoints).fill(thresholds.waspada);
  const siagaLine = Array(totalPoints).fill(thresholds.siaga);

  if (forecastChart) {
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = predData;
    forecastChart.data.datasets[1].data = waspadaLine;
    forecastChart.data.datasets[2].data = siagaLine;
    forecastChart.update();
  } else {
    // Set default font to match the brutalist styling
    Chart.defaults.font.family = "'Work Sans', sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.color = "#000000";

    forecastChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "PREDIKSI ML",
            data: predData,
            borderColor: "#1d70b8",
            backgroundColor: "transparent",
            borderWidth: 3,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#1d70b8",
          },
          {
            label: "AMBANG WASPADA",
            data: waspadaLine,
            borderColor: "#eab308",
            borderDash: [3, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
          {
            label: "AMBANG SIAGA",
            data: siagaLine,
            borderColor: "#ef4444",
            borderDash: [3, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                family: "'Courier Prime', monospace",
                weight: 'bold'
              }
            }
          },
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
              color: "rgba(9, 78, 135, 0.05)"
            },
            ticks: {
              font: {
                family: "'Courier Prime', monospace",
                weight: 'bold'
              }
            }
          },
          y: {
            grid: {
              color: "rgba(9, 78, 135, 0.08)"
            },
            beginAtZero: true,
            grace: "10%",
            ticks: {
              font: {
                family: "'Courier Prime', monospace",
                weight: 'bold'
              },
              callback: function(value) {
                return value + " cm";
              }
            }
          }
        }
      }
    });
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
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;   // MAE (cm)

    // Ketepatan = persentase prediksi yang meleset <= toleransi (metrik bermakna,
    // menggantikan rumus lama "100 - MAE*2" yang tidak punya arti statistik).
    const TOLERANSI_CM = 15;
    const tepat = diffs.filter((d) => d <= TOLERANSI_CM).length;
    const ketepatan = (tepat / diffs.length) * 100;

    document.getElementById("bandingAkurasi").innerText = ketepatan.toFixed(0) + "%";
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



setLokasi(3);

