let activeLokasi = 3;
const LOKASI_DATA = {
  1: { name: "Pucanganom", ml: 1 },
  2: { name: "UHT", ml: 1 },
  3: { name: "Kalikobor", ml: 2 },
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
    b.className = "px-2 py-1 border border-primary bg-surface font-label-caps hover:bg-primary hover:text-on-primary transition-colors cursor-pointer";
  });
  const btn = document.querySelector(`.horizon-btn[data-h="${h}"]`);
  if (btn) btn.className = "px-2 py-1 border-2 border-primary bg-secondary text-on-secondary font-label-caps translate-y-[-2px] brutal-shadow cursor-pointer";
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
    if (!data.success) return;

    const skrg = data.sekarang;
    const pred = data.prediksi;
    const p1 = pred ? pred["1"] : null;

    document.getElementById("metricStatus").innerText = skrg.status;
    document.getElementById("metricStatusDesc").innerText = data.catatan || "Kondisi Normal";
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

    // Forecast bars
    const barContainer = document.getElementById("forecastBars");
    if (barContainer && pred) {
      const H = [1, 3, 6, 12, 24];
      const bars = barContainer.children;
      const barCount = bars.length;
      for (let i = 0; i < barCount; i++) {
        const bar = bars[i];
        const idx = i < barCount - H.length ? 0 : H[i - (barCount - H.length)];
        const p = idx > 0 ? pred[String(idx)] : null;
        let h = 10, cls = "bg-primary border border-primary", label = "-";
        if (p && p.tinggi_air_cm != null) {
          h = Math.min(p.tinggi_air_cm / maxH * 100, 95);
          label = p.tinggi_air_cm + "cm";
          cls = p.status === "SIAGA"
            ? "bg-secondary-container halftone-pink border-2 border-primary shadow-[2px_0_0_0_#000] z-10"
            : p.status === "WASPADA"
              ? "bg-surface-variant stripe-bg border border-primary border-dashed"
              : "bg-primary border border-primary";
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

async function muatBanding() {
  try {
    const res = await fetch("/api/perbandingan?lokasi=" + activeLokasi + "&max=50");
    const data = await res.json();
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

    // Sample points for SVG
    const step = Math.max(1, Math.floor(hData.waktu.length / 20));
    const pts = [];
    for (let i = 0; i < hData.waktu.length; i += step) {
      pts.push({ a: hData.aktual[i], p: hData.prediksi[i] });
    }
    if (pts.length < 2) return;

    const allVals = pts.flatMap((d) => [d.a, d.p]);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const aktualPts = pts.map((d, i) => ((i / (pts.length - 1)) * 100) + "," + (90 - ((d.a - minV) / range) * 75)).join(" ");
    const predPts = pts.map((d, i) => ((i / (pts.length - 1)) * 100) + "," + (90 - ((d.p - minV) / range) * 75)).join(" ");

    const lineA = document.getElementById("bandingLineAktual");
    const lineP = document.getElementById("bandingLinePrediksi");
    if (lineA) lineA.setAttribute("points", aktualPts);
    if (lineP) lineP.setAttribute("points", predPts);

    // Update date label: show range of data
    const firstDate = new Date(hData.waktu[0]);
    const lastDate = new Date(hData.waktu[hData.waktu.length - 1]);
    const fmt = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const dateLabel = document.getElementById("bandingDateRange");
    if (dateLabel) dateLabel.innerText = fmt(firstDate) + " — " + fmt(lastDate);

  } catch (e) {
    console.error("Banding error:", e);
  }
}

muatData();
