const express = require('express');
const path = require('path');

const app = express();

// biar bisa baca JSON
app.use(express.json());

// serve folder public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// route default
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// dummy endpoint biar dashboard nggak loading
app.get('/sensor/latest', (req, res) => {
    res.json({
        suhu: 30,
        kelembapan: 70,
        lat: -7.25,
        lng: 112.75
    });
});

// dummy auth
app.get('/auth/me', (req, res) => {
    res.json({ role: 'user' });
});

app.listen(3000, () => {
    console.log('Server jalan di http://localhost:3000');
});