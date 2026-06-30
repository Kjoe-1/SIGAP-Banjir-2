Chart.register(window["chartjs-plugin-annotation"]);

const HEIGHT_CONFIGS = {
  1: { bibir: 300, tengah: 150, pangkal: 0, waspada: 110, siaga: 130 },
  2: { bibir: 290, tengah: 145, pangkal: 0, waspada: 150, siaga: 190 },
  3: { bibir: 380, tengah: 190, pangkal: 0, waspada: 120, siaga: 150 },
};

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

  // Use only anchor tags to prevent styling inner text span elements
  document.querySelectorAll("a[id^=navLok]").forEach((el) => {
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
      labelAman.innerText = "AMAN (< 150 cm)";
      labelWaspada.innerText = "WASPADA (150-190 cm)";
      labelSiaga.innerText = "SIAGA (≥ 190 cm)";
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
  const hist = data.histori || [];

  const labels = ["-6 Jam", "-3 Jam", "-1 Jam", "now", "+1 Jam", "+3 Jam", "+6 Jam"];
  const predData = [];
  const pointColors = [];
  const statusColors = { AMAN: "#10b981", WASPADA: "#eab308", SIAGA: "#ef4444" };

  // -6 Jam (index length - 7)
  const h6 = hist.length >= 7 ? hist[hist.length - 7] : null;
  predData.push(h6 && h6.tinggi_air_cm != null ? h6.tinggi_air_cm : null);
  pointColors.push(h6 && h6.status ? (statusColors[h6.status] || "#1d70b8") : "#1d70b8");

  // -3 Jam (index length - 4)
  const h3 = hist.length >= 4 ? hist[hist.length - 4] : null;
  predData.push(h3 && h3.tinggi_air_cm != null ? h3.tinggi_air_cm : null);
  pointColors.push(h3 && h3.status ? (statusColors[h3.status] || "#1d70b8") : "#1d70b8");

  // -1 Jam (index length - 2)
  const h1 = hist.length >= 2 ? hist[hist.length - 2] : null;
  predData.push(h1 && h1.tinggi_air_cm != null ? h1.tinggi_air_cm : null);
  pointColors.push(h1 && h1.status ? (statusColors[h1.status] || "#1d70b8") : "#1d70b8");

  // now (current value)
  predData.push(skrg.tinggi_air_cm != null ? skrg.tinggi_air_cm : null);
  pointColors.push(skrg.status ? (statusColors[skrg.status] || "#1d70b8") : "#1d70b8");

  // +1 Jam
  const p1 = pred["1"];
  predData.push(p1 && p1.tinggi_air_cm != null ? p1.tinggi_air_cm : null);
  pointColors.push(p1 && p1.status ? (statusColors[p1.status] || "#e67e22") : "#e67e22");

  // +3 Jam
  const p3 = pred["3"];
  predData.push(p3 && p3.tinggi_air_cm != null ? p3.tinggi_air_cm : null);
  pointColors.push(p3 && p3.status ? (statusColors[p3.status] || "#e67e22") : "#e67e22");

  // +6 Jam
  const p6 = pred["6"];
  predData.push(p6 && p6.tinggi_air_cm != null ? p6.tinggi_air_cm : null);
  pointColors.push(p6 && p6.status ? (statusColors[p6.status] || "#e67e22") : "#e67e22");

  const cfg = HEIGHT_CONFIGS[activeLokasi];

  if (forecastChart) {
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = predData;
    forecastChart.data.datasets[0].pointBackgroundColor = pointColors;
    if (cfg && forecastChart.options.plugins && forecastChart.options.plugins.annotation) {
      forecastChart.options.plugins.annotation.annotations = {
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
      if (forecastChart.options.scales && forecastChart.options.scales.y) {
        forecastChart.options.scales.y.suggestedMax = cfg.bibir + 50;
      }
    }
    forecastChart.update();
  } else {
    // Set default font to match the brutalist styling
    Chart.defaults.font.family = "'Work Sans', sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.color = "#000000";

    const annotationOpts = cfg ? {
      annotations: {
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
      }
    } : {};

    forecastChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Tinggi Air (cm)",
            data: predData,
            borderColor: "#1d70b8",
            backgroundColor: "transparent",
            borderWidth: 3,
            tension: 0.2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: pointColors,
            pointBorderColor: "#000000",
            pointBorderWidth: 1.5,
            segment: {
              borderDash: (ctx) => (ctx.p1DataIndex > 3 ? [5, 5] : undefined),
              borderColor: (ctx) => (ctx.p1DataIndex > 3 ? "#e67e22" : "#1d70b8"),
            }
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
          },
          annotation: annotationOpts
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
            suggestedMax: cfg ? cfg.bibir + 50 : 300,
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
          borderColor: "#1d70b8",
          backgroundColor: "transparent",
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: "PREDIKSI",
          data: [],
          borderColor: "#000000",
          borderDash: [2, 3],
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
      const dateLabel = document.getElementById("bandingDateRange");
      if (dateLabel) {
        if (activeLokasi === 1) {
          dateLabel.innerText = "Tipe Klasifikasi (Tidak ada model forecasting untuk Pucanganom)";
        } else {
          dateLabel.innerText = data.message || "Gagal memuat data perbandingan";
        }
      }
      if (bandingChart) {
        bandingChart.data.labels = [];
        bandingChart.data.datasets[0].data = [];
        bandingChart.data.datasets[1].data = [];
        bandingChart.update();
      }
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

      if (bandingChart.options.plugins) {
        delete bandingChart.options.plugins.annotation;
      }
      if (bandingChart.options.scales && bandingChart.options.scales.y) {
        delete bandingChart.options.scales.y.suggestedMax;
      }

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
