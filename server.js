require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const db = require('./database/db');
const scraperRoutes = require('./routes/scraper');
const callRoutes = require('./routes/calls');
const appointmentRoutes = require('./routes/appointments');
const mediaStreamHandler = require('./services/mediaStreamHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files (later)
// app.use(express.static('frontend/out'));

// Routes
app.use('/api', scraperRoutes);
app.use('/api', callRoutes);
app.use('/api', appointmentRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Cold Caller AI API is running 🚀' });
});

// WebSocket handling for Twilio Media Streams
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    mediaStreamHandler(ws);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`db connected: ${!!db}`);
});
