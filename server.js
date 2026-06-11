const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

const app = express();
const ML_DIR = path.join(__dirname, 'ml');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/sensor/latest', (req, res) => {
    res.json({ suhu: 30, kelembapan: 70, lat: -7.25, lng: 112.75 });
});

app.get('/auth/me', (req, res) => {
    res.json({ role: 'user' });
});

// ML Prediction: frontend lokasi → ML lokasi mapping
const ML_MAP = { 1: 1, 2: 1, 3: 2 };

app.get('/api/prediksi', (req, res) => {
    const feLokasi = parseInt(req.query.lokasi) || 3;
    const mLokasi = ML_MAP[feLokasi] || 1;
    const args = ['prediksi.py', '--lokasi', String(mLokasi), '--mode', 'demo'];

    execFile('python', args, { cwd: ML_DIR, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
            console.error('ML error:', err.message);
            return res.status(500).json({ success: false, message: 'Gagal prediksi' });
        }
        try {
            const data = JSON.parse(stdout);
            data.fe_lokasi = feLokasi;
            res.json(data);
        } catch {
            res.status(500).json({ success: false, message: 'Output ML tidak valid' });
        }
    });
});

// Perbandingan prediksi vs aktual historis
const BANDING_MAP = { 1: 1, 2: 1, 3: 2 };

app.get('/api/perbandingan', (req, res) => {
    const feLokasi = parseInt(req.query.lokasi) || 3;
    const mLokasi = BANDING_MAP[feLokasi] || 1;
    const maxPoints = parseInt(req.query.max) || 50;
    const args = ['banding.py', '--lokasi', String(mLokasi), '--max-points', String(maxPoints)];

    execFile('python', args, { cwd: ML_DIR, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
            console.error('Banding error:', err.message);
            return res.status(500).json({ success: false, message: 'Gagal perbandingan' });
        }
        try {
            const data = JSON.parse(stdout);
            data.fe_lokasi = feLokasi;
            res.json(data);
        } catch {
            res.status(500).json({ success: false, message: 'Output tidak valid' });
        }
    });
});

app.listen(3000, () => {
    console.log('Server jalan di http://localhost:3000');
});