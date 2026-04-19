const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const Sensor = require('./models/Sensor');

const app = express();

// middleware (WAJIB DI ATAS)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'sigapbanjir',
    resave: false,
    saveUninitialized: true
}));

// static
app.use(express.static('public'));

// DB
mongoose.connect('mongodb://127.0.0.1/sigap-banjir');

// ===== SENSOR API =====
app.post('/sensor', async (req, res) => {
    const data = new Sensor(req.body);
    await data.save();
    res.sendStatus(200);
});

app.get('/sensor/latest', async (req, res) => {
    const data = await Sensor.findOne().sort({ createdAt: -1 });
    res.json(data);
});

// ===== AUTH =====
const users = [];

app.post('/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    users.push({ username, email, password, role: 'user' });
    res.sendStatus(200);
});

app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return res.sendStatus(401);

    req.session.user = user;
    res.sendStatus(200);
});

app.get('/auth/me', (req, res) => {
    if (!req.session.user) return res.sendStatus(401);
    res.json(req.session.user);
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// ===== START =====
app.listen(3000, () => {
    console.log("http://localhost:3000");
});