// utils/logger.js
const fs = require('fs');
const path = require('path');

class NexusLogger {
  constructor(config = {}) {
    this.logFile = config.logFile || 'nexus.log';
    this.logFilePath = path.join(__dirname, '..', 'logs', this.logFile);
    this.consoleLevel = config.consoleLevel || 'info';
    
    // Đảm bảo thư mục logs tồn tại
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, data) {
    const entry = this._createLogEntry('info', message, data);
    this._writeToFile(entry);
    if (this.consoleLevel === 'debug' || this.consoleLevel === 'info') {
      console.log(entry);
    }
  }

  error(message, error) {
    const entry = this._createLogEntry('error', message, error);
    this._writeToFile(entry);
    console.error(entry);
  }

  _createLogEntry(level, message, data) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data instanceof Error ? { message: data.message, stack: data.stack } : data
    };
  }

  _writeToFile(entry) {
    fs.appendFileSync(this.logFilePath, JSON.stringify(entry) + '\n', 'utf8');
  }
}

module.exports = { NexusLogger };
