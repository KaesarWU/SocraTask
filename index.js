const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { initializeAI } = require('./src/ai/qwen-nexus');
const { initializeDatabase } = require('./src/database');
const { initializeProductivityEngine } = require('./src/productivity');
const { initializeLearnSpace } = require('./src/learnspace');
const { initializeSocialArena } = require('./src/social');
const { initializePointsSystem } = require('./src/economy');
const logger = require('./src/utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Initialize database
initializeDatabase();

// Initialize the Qwen AI Nexus
initializeAI();

// Initialize core systems
initializeProductivityEngine(app, io);
initializeLearnSpace(app, io);
initializePointsSystem(app, io);
initializeSocialArena(app, io);

// Main routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`SocraTask server running on port ${PORT}`);
    console.log(`🚀 SocraTask server running on port ${PORT}`);
    console.log(`🌐 Access the application at http://localhost:${PORT}`);
});