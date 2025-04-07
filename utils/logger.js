// utils/logger.js - Phiên bản hoàn thiện
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const util = require('util');
const os = require('os');

class NexusLogger {
  constructor(config = {}) {
    // 1. CẤU HÌNH MẶC ĐỊNH
    this.config = {
      logDir: path.join(__dirname, '..', 'logs'),
      logFile: 'nexus.log',
      errorFile: 'nexus-error.log',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      consoleLevel: 'info',
      ...config
    };

    // 2. KHỞI TẠO THƯ MỤC LOG
    this._ensureLogDirExists();
    
    // 3. TẠO STREAMS
    this._createLogStreams();
    
    // 4. CẤU HÌNH MÀU SẮC CHO CONSOLE
    this.colors = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m', // Magenta
      reset: '\x1b[0m'
    };
  }

  // ================= CORE METHODS =================
  info(message, data) {
    this._log('info', message, data);
  }

  warn(message, data) {
    this._log('warn', message, data);
  }

  error(message, error) {
    const errorId = createHash('sha1')
      .update(Date.now().toString())
      .digest('hex')
      .substring(0, 8);
    
    this._log('error', message, {
      errorId,
      ...(error instanceof Error ? this._parseError(error) : error)
    });
    
    return errorId; // Trả về ID để tracking
  }

  debug(message, data) {
    if (this.config.consoleLevel === 'debug') {
      this._log('debug', message, data);
    }
  }

  // ================= INTERNAL METHODS =================
  _log(level, message, data) {
    const entry = this._createLogEntry(level, message, data);
    
    // Ghi vào file
    this._writeToFile(entry);
    
    // Hiển thị console nếu cần
    if (this._shouldLogToConsole(level)) {
      this._logToConsole(entry);
    }
  }

  _createLogEntry(level, message, data) {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      pid: process.pid,
      hostname: os.hostname(),
      message,
      data: this._sanitizeData(data)
    };
  }

  _sanitizeData(data) {
    if (!data) return undefined;
    if (data instanceof Error) return this._parseError(data);
    if (typeof data === 'object') {
      return JSON.parse(JSON.stringify(data, (_, value) => {
        if (value instanceof Error) return this._parseError(value);
        if (typeof value === 'bigint') return value.toString();
        return value;
      }));
    }
    return data;
  }

  _parseError(error) {
    return {
      errorType: error.constructor.name,
      message: error.message,
      stack: error.stack?.split('\n'),
      ...(error.code && { code: error.code }),
      ...(error.response && { response: error.response.data })
    };
  }

  _writeToFile(entry) {
    const logString = JSON.stringify(entry) + os.EOL;
    
    // Ghi vào file log chính
    this.mainLogStream.write(logString);
    
    // Ghi vào file error nếu là lỗi
    if (entry.level === 'ERROR') {
      this.errorLogStream.write(logString);
    }
    
    // Rotate file nếu cần
    this._rotateFiles();
  }

  _logToConsole(entry) {
    const color = this.colors[entry.level.toLowerCase()] || this.colors.reset;
    const levelStr = `${color}[${entry.level}]${this.colors.reset}`;
    const messageStr = `${entry.message}`;
    
    console.log(
      `${entry.timestamp} ${levelStr} ${messageStr}` + 
      (entry.data ? `\n${util.inspect(entry.data, { colors: true, depth: 5 })}` : '')
    );
  }

  // ================= FILE MANAGEMENT =================
  _ensureLogDirExists() {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  _createLogStreams() {
    this.mainLogStream = fs.createWriteStream(
      path.join(this.config.logDir, this.config.logFile), 
      { flags: 'a' }
    );
    
    this.errorLogStream = fs.createWriteStream(
      path.join(this.config.logDir, this.config.errorFile), 
      { flags: 'a' }
    );
    
    // Xử lý lỗi stream
    const handleStreamError = (err) => {
      console.error('Logger stream error:', err);
    };
    
    this.mainLogStream.on('error', handleStreamError);
    this.errorLogStream.on('error', handleStreamError);
  }

  _rotateFiles() {
    const checkRotation = (filePath) => {
      try {
        const stats = fs.statSync(filePath);
        return stats.size > this.config.maxFileSize;
      } catch (err) {
        return false;
      }
    };

    const rotate = (baseName) => {
      for (let i = this.config.maxFiles - 1; i > 0; i--) {
        const current = path.join(this.config.logDir, `${baseName}.${i}`);
        const next = path.join(this.config.logDir, `${baseName}.${i + 1}`);
        
        if (fs.existsSync(current)) {
          fs.renameSync(current, next);
        }
      }
      
      const mainFile = path.join(this.config.logDir, baseName);
      if (fs.existsSync(mainFile)) {
        fs.renameSync(mainFile, path.join(this.config.logDir, `${baseName}.1`));
      }
    };

    if (checkRotation(path.join(this.config.logDir, this.config.logFile))) {
      rotate(this.config.logFile);
    }

    if (checkRotation(path.join(this.config.logDir, this.config.errorFile))) {
      rotate(this.config.errorFile);
    }
  }

  // ================= HELPER METHODS =================
  _shouldLogToConsole(level) {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.config.consoleLevel);
  }

  // ================= CLEANUP =================
  close() {
    return new Promise((resolve) => {
      this.mainLogStream.end(() => {
        this.errorLogStream.end(() => {
          resolve();
        });
      });
    });
  }
}

// Singleton instance
const logger = new NexusLogger({
  consoleLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

process.on('beforeExit', () => logger.close());

module.exports = logger;