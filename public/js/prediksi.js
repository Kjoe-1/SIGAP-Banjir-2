let activeLokasi = 3;
const FE2ML = { 1: 1, 2: 1, 3: 2 };
const LOKASI_NAMES = { 1: "Keputih", 2: "Hangtuah", 3: "Kalikobor" };

function setLokasi(fe) {
  activeLokasi = fe;
  document.getElementById("lokasi-text").innerText = LOKASI_NAMES[fe];
  document.getElementById("active-location").innerText = LOKASI_NAMES[fe];

  document.querySelectorAll(".location-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("lok" + fe);
  if (btn) btn.classList.add("active");

  document.querySelectorAll(".horizon-btn").forEach((b) => b.classList.remove("active"));
  const h1 = document.querySelector('.horizon-btn[data-h="1"]');
  if (h1) h1.classList.add("active");
  horizonAktif = "1";

  muatData();
}

document.getElementById("lok1").onclick = () => setLokasi(1);
document.getElementById("lok2").onclick = () => setLokasi(2);
document.getElementById("lok3").onclick = () => setLokasi(3);

let horizonAktif = "1";

document.querySelectorAll(".horizon-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".horizon-btn").forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    horizonAktif = this.dataset.h;
    muatBanding();
  });
});

async function muatData() {
  await Promise.all([muatPrediksi(), muatBanding()]);
}

// ==================== FORECAST 24 JAM ====================
async function muatPrediksi() {
  try {
    const res = await fetch("/api/prediksi?lokasi=" + activeLokasi);
    const data = await res.json();
    if (!data.success) return;

    const skrg = data.sekarang;
    const pred = data.prediksi;
    const warn = data.peringatan;

    // Ringkasan
    document.getElementById("ringkasanStatus").innerText = skrg.status;
    document.getElementById("ringkasanTinggi").innerHTML = (skrg.tinggi_air_cm != null ? skrg.tinggi_air_cm : "-") + ' <small style="font-size:14px;color:#666">cm</small>';
    document.getElementById("ringkasanConf").innerText = skrg.confidence != null ? Math.round(skrg.confidence * 100) + "%" : "-";

    const p1 = pred["1"];
    if (p1 && p1.status !== "tidak_tersedia") {
      document.getElementById("ringkasanPred1").innerHTML = (p1.tinggi_air_cm != null ? p1.tinggi_air_cm : "-") + ' <small style="font-size:14px;color:#666">cm</small>';
      document.getElementById("ringkasanConf1").innerText = p1.confidence != null ? Math.round(p1.confidence * 100) + "%" : "-";
    }

    // Alert
    const alertEl = document.getElementById("peringatanAlert");
    if (warn && warn.ada) {
      alertEl.style.display = "flex";
      alertEl.className = "peringatan-alert peringatan-" + warn.status.toLowerCase();
      alertEl.innerHTML = '<span class="alert-icon">⚠️</span> ' + warn.pesan;
    } else {
      alertEl.style.display = "none";
    }

    // Badge keandalan
    const badgeEl = document.getElementById("keandalanBadge");
    if (data.tipe === "klasifikasi") {
      badgeEl.innerText = "klasifikasi";
      badgeEl.className = "keandalan-badge badge-tidak";
    } else if (p1) {
      badgeEl.innerText = p1.keandalan || "-";
      badgeEl.className = "keandalan-badge badge-" + (p1.keandalan || "tidak");
    }

    // Tipe catatan
    document.getElementById("catatanTipe").innerText = data.catatan || "";
    document.getElementById("sensorTipe").innerText = "Tipe: " + data.tipe;

    // Chart forecast 24 jam
    const canvas = document.getElementById("forecastChart");
    if (!canvas) return;
    if (window.forecastChartInst) window.forecastChartInst.destroy();

    const H = [0, 1, 3, 6, 12, 24];
    const L = ["Sekarang"];
    for (let i = 1; i < H.length; i++) L.push("+" + H[i] + "jam");

    const V = [skrg.tinggi_air_cm != null ? skrg.tinggi_air_cm : null];
    const C = [skrg.status || "AMAN"];
    for (let i = 1; i < H.length; i++) {
      const p = pred[String(H[i])];
      if (p && p.tinggi_air_cm != null) {
        V.push(p.tinggi_air_cm);
        C.push(p.status);
      } else {
        V.push(null);
        C.push("tidak");
      }
    }

    const colors = { AMAN: "#22c55e", WASPADA: "#f59e0b", SIAGA: "#ef4444", tidak: "#94a3b8" };
    const pointColors = V.map((_, i) => colors[C[i]] || "#94a3b8");
    const hasData = V.some((v) => v != null);

    window.forecastChartInst = new Chart(canvas, {
      type: "line",
      data: {
        labels: L,
        datasets: [
          {
            label: "Tinggi Air (cm)",
            data: V,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,236,0.1)",
            tension: 0.3,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: 7,
            pointHoverRadius: 9,
            fill: hasData,
            spanGaps: false,
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
                const idx = ctx.dataIndex;
                return (C[idx] || "-") + ": " + (ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + " cm" : "N/A");
              },
            },
          },
        },
        scales: {
          x: { ticks: { font: { size: 12 } } },
          y: { beginAtZero: true, title: { display: true, text: "Tinggi Air (cm)" } },
        },
      },
    });
  } catch (e) {
    console.error("muatPrediksi error:", e);
  }
}

// ==================== PERBANDINGAN ====================
async function muatBanding() {
  try {
    const res = await fetch("/api/perbandingan?lokasi=" + activeLokasi + "&max=50");
    const data = await res.json();
    if (!data.success) return;

    const hData = data[horizonAktif];
    if (!hData || !hData.waktu || hData.waktu.length === 0) return;

    const labels = hData.waktu.map((t) => {
      const d = new Date(t);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    });

    const canvas = document.getElementById("bandingChart");
    if (!canvas) return;
    if (window.bandingChartInst) window.bandingChartInst.destroy();

    window.bandingChartInst = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Hasil Prediksi", data: hData.prediksi, borderColor: "#3b82f6", backgroundColor: "rgba(59,130,236,0.1)", tension: 0.3, pointRadius: 3, pointHoverRadius: 5, fill: false },
          { label: "Data Asli", data: hData.aktual, borderColor: "#f97316", backgroundColor: "rgba(249,115,22,0.1)", tension: 0.3, pointRadius: 3, pointHoverRadius: 5, fill: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + " cm" } },
        },
        scales: {
          x: { ticks: { maxRotation: 45, font: { size: 10 }, maxTicksLimit: 10 } },
          y: { beginAtZero: true, title: { display: true, text: "Tinggi Air (cm)" } },
        },
      },
    });
  } catch (e) {
    console.error("muatBanding error:", e);
  }
}

muatData();
