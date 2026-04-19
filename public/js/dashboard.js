// ================= MAP =================
let map = L.map('map').setView([-7.25, 112.75], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

let marker = L.marker([-7.25, 112.75]).addTo(map);

function updateMap(lat, lng) {
    map.setView([lat, lng], 15);
    marker.setLatLng([lat, lng]);
}

// ================= STATUS =================
const statusText = document.getElementById("statusText");
const statusCard = document.getElementById("statusCard");

// ================= CHART =================
let chart;
const ctx = document.getElementById('chart');

chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Suhu',
            data: [],
            borderColor: 'lime'
        }]
    }
});

// ================= ROLE =================
fetch('/auth/me')
.then(res => res.json())
.then(user => {
    if (user.role === 'admin') {
        document.getElementById("uploadBtn").style.display = "none";
    } else {
        document.getElementById("adminBtn").style.display = "none";
    }
});

// ================= REALTIME =================
async function loadData() {
    const res = await fetch('/sensor/latest');
    const data = await res.json();

    if (!data) return;

    // TEXT
    document.getElementById("tempText").innerText = data.suhu + "°C";
    document.getElementById("humidityText").innerText = data.kelembapan + "%";

    // GAUGE
    const max = 314;

    document.getElementById("humCircle").style.strokeDashoffset =
        max - (data.kelembapan / 100) * max;

    document.getElementById("tempCircle").style.strokeDashoffset =
        max - (data.suhu / 50) * max;

    // STATUS
    if (data.kelembapan > 80) {
        statusText.innerText = "AWAS";
        statusCard.classList.add("awas");
        document.querySelector(".icon").innerText = "!";
    } else {
        statusText.innerText = "AMAN";
    }

    // MAP
    updateMap(data.lat, data.lng);

    // CHART
    chart.data.labels.push(new Date().toLocaleTimeString());
    chart.data.datasets[0].data.push(data.suhu);

    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update();
}

// PINDAH KE PAGE UPLOAD
document.getElementById("uploadBtn").addEventListener("click", () => {
    window.location.href = "/upload.html";
});

// REFRESH
setInterval(loadData, 3000);
loadData();

// ================= LOGOUT =================
function logout() {
    window.location.href = "/auth/logout";
}