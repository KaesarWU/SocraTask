// Simple console logger for demo purposes
const fs = require('fs');
const path = require('path');

class SimpleLogger {
    constructor() {
        this.logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        // Print to console
        console.log(logMessage);
        
        // Write to file
        const logEntry = `${logMessage} ${JSON.stringify(meta)}\n`;
        const logFile = path.join(this.logsDir, `${level}.log`);
        fs.appendFileSync(logFile, logEntry);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }
}

const logger = new SimpleLogger();
module.exports = logger;