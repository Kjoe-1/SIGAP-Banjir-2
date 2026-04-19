const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema({
    suhu: Number,
    kelembapan: Number,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Sensor', SensorSchema);