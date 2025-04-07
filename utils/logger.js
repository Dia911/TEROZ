// utils/logger.js - Phiên bản ESM hoàn chỉnh
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { inspect } from 'util';
import os from 'os';

// Cập nhật lại đường dẫn __dirname cho môi trường ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

class NexusLogger {
  constructor(config = {}) {
    // Cấu hình mặc định cho logger
    this.config = {
      logDir: join(__dirname, '..', '..', 'logs'),  // Đảm bảo đường dẫn đúng
      logFile: 'nexus.log',
      errorFile: 'nexus-error.log',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      consoleLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...config
    };

    // Khởi tạo hệ thống log
    this._ensureLogDirExists();
    this._createLogStreams();
    this._initColors();
  }

  // Các phương thức log
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
      ...this._parseError(error)
    });

    return errorId;
  }

  debug(message, data) {
    if (this.config.consoleLevel === 'debug') {
      this._log('debug', message, data);
    }
  }

  // Phương thức nội bộ
  async _log(level, message, data) {
    const entry = this._createLogEntry(level, message, data);

    await this._writeToFile(entry);

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
      errorType: error?.constructor?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack?.split('\n'),
      ...(error?.code && { code: error.code }),
      ...(error?.response && { response: error.response?.data })
    };
  }

  async _writeToFile(entry) {
    const logString = JSON.stringify(entry) + os.EOL;

    await new Promise((resolve) => {
      this.mainLogStream.write(logString, () => {
        if (entry.level === 'ERROR') {
          this.errorLogStream.write(logString, resolve);
        } else {
          resolve();
        }
      });
    });
  }

  _logToConsole(entry) {
    const color = this.colors[entry.level.toLowerCase()] || this.colors.reset;
    console.log(
      `${color}[${entry.timestamp}] [${entry.level}]${this.colors.reset} ${entry.message}` +
      (entry.data ? `\n${inspect(entry.data, { colors: true, depth: 5 })}` : '')
    );
  }

  // Quản lý file log
  _ensureLogDirExists() {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  _createLogStreams() {
    this.mainLogStream = createWriteStream(
      join(this.config.logDir, this.config.logFile),
      { flags: 'a' }
    );

    this.errorLogStream = createWriteStream(
      join(this.config.logDir, this.config.errorFile),
      { flags: 'a' }
    );

    this.mainLogStream.on('error', (err) =>
      console.error('Main log stream error:', err)
    );
    this.errorLogStream.on('error', (err) =>
      console.error('Error log stream error:', err)
    );
  }

  _initColors() {
    this.colors = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[35m', // Magenta
      reset: '\x1b[0m'
    };
  }

  // Kiểm tra điều kiện log console
  _shouldLogToConsole(level) {
    const levels = ['error', 'warn', 'info', 'debug'];
    return levels.indexOf(level) <= levels.indexOf(this.config.consoleLevel);
  }

  // Đóng stream khi kết thúc
  async close() {
    return Promise.all([
      new Promise((resolve) => this.mainLogStream.end(resolve)),
      new Promise((resolve) => this.errorLogStream.end(resolve))
    ]);
  }
}

// Khởi tạo instance và export
const logger = new NexusLogger();

process.on('beforeExit', async () => {
  await logger.close();
});

export default logger;
