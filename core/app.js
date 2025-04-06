// app.js - NexusOne Core Application v3.0 (Production Ready)
require('dotenv').config();
const express = require('express');
const app = express();
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

// Configurable Constants
const CONFIG = {
  MAX_FILE_SIZE: '10mb',
  SENTIMENT_THRESHOLD: 0.25,
  DEFAULT_PORT: 3000
};

// Dynamic Module Loading
const loadModule = (relativePath) => {
  try {
    return require(path.resolve(__dirname, relativePath));
  } catch (error) {
    console.error(chalk.red(`[MODULE ERROR] Failed to load ${relativePath}:`), error);
    process.exit(1);
  }
};

// Core Dependencies
const { NexusEngine } = loadModule('../modules/nexus-engine');
const CustomerAnalyzer = loadModule('../Ai/customer-analyzer'); // Case-sensitive path
const NexusSheet = loadModule('../Tracking/google-sheets');
const PerformanceTracker = loadModule('../utils/logger');
const PlatformRouter = loadModule('./platform-router');
const PlatformService = loadModule('./platform-service');

// Middleware Configuration
app.use(express.json({ limit: CONFIG.MAX_FILE_SIZE }));
app.use(express.urlencoded({ 
  extended: true, 
  limit: CONFIG.MAX_FILE_SIZE,
  parameterLimit: 1000 
}));

class NexusOneCore {
  constructor() {
    this._validateEnvironment();
    this._initializeServices();
    this._initErrorHandling();
    this._loadPlatformHandlers();
  }

  _validateEnvironment() {
    const requiredEnvs = {
      NEXUS_API_KEY: 'API key for Nexus Engine',
      GOOGLE_SHEET_ID: 'Google Sheets ID for logging',
      FACEBOOK_APP_SECRET: 'Facebook API secret'
    };

    const missing = Object.entries(requiredEnvs)
      .filter(([key]) => !process.env[key])
      .map(([key, desc]) => `${key} (${desc})`);

    if (missing.length) {
      const errorMsg = `Missing environment variables:\n${missing.join('\n')}`;
      console.error(chalk.red.bold('❌ Environment Validation Failed:'));
      throw new Error(errorMsg);
    }
  }

  _initializeServices() {
    try {
      this.engine = new NexusEngine({
        apiKey: process.env.NEXUS_API_KEY,
        environment: process.env.NODE_ENV || 'production'
      });

      this.analyzer = new CustomerAnalyzer({
        sentimentThreshold: CONFIG.SENTIMENT_THRESHOLD,
        language: 'vi',
        cacheDir: path.join(__dirname, '../Ai/cache')
      });

      this.sheet = new NexusSheet({
        sheetId: process.env.GOOGLE_SHEET_ID,
        credentials: path.resolve(__dirname, '../config/service-account.json')
      });

      this.performance = new PerformanceTracker({
        logLevel: process.env.LOG_LEVEL || 'info'
      });

      this.router = new PlatformRouter();
      this.service = new PlatformService();

    } catch (error) {
      console.error(chalk.red.bold('⛔ Critical Service Initialization Error:'), error);
      process.exit(1);
    }
  }

  _initErrorHandling() {
    const errorHandler = (err, type) => {
      this.performance.logError({
        type,
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      console.error(chalk.red.bold(`\n⚠️  Unhandled ${type}:`), err);
      
      if (type === 'UNCAUGHT_EXCEPTION') {
        setTimeout(() => process.exit(1), 1000);
      }
    };

    process.on('unhandledRejection', (err) => errorHandler(err, 'REJECTION'));
    process.on('uncaughtException', (err) => errorHandler(err, 'EXCEPTION'));
  }

  async _loadPlatformHandlers() {
    try {
      const handlersDir = path.resolve(__dirname, '../handlers');
      const files = await fs.readdir(handlersDir);
      
      await Promise.all(files.map(async (file) => {
        if (!file.endsWith('.js') || file === 'PlatformHandler.js') return;

        try {
          const platformName = path.basename(file, '.js');
          const { default: HandlerClass } = await import(`file://${path.join(handlersDir, file)}`);
          
          this.router.register(
            platformName,
            new HandlerClass({
              engine: this.engine,
              analyzer: this.analyzer,
              logger: this.performance
            })
          );
          
          console.log(chalk.green.bold(`✓ Successfully loaded ${platformName.toUpperCase()} handler`));
        } catch (error) {
          console.error(chalk.red(`Failed to load ${file}:`), error);
        }
      }));
      
    } catch (error) {
      console.error(chalk.red.bold('‼️ Platform Handler Loading Failed:'), error);
      process.exit(1);
    }
  }

  _setupRoutes() {
    // Health Check Endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'operational',
        version: '3.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    });

    // Main Webhook Processor
    app.post('/webhook/:platform', async (req, res) => {
      const start = Date.now();
      const { platform } = req.params;
      
      try {
        const result = await this.router.handle(platform, req.body);
        
        await this.sheet.logInteraction({
          platform,
          duration: Date.now() - start,
          success: true,
          data: result
        });

        res.json({
          status: 'success',
          processingTime: `${Date.now() - start}ms`,
          ...result
        });
        
      } catch (error) {
        await this.sheet.logInteraction({
          platform,
          duration: Date.now() - start,
          success: false,
          error: error.message
        });

        res.status(error.statusCode || 500).json({
          status: 'error',
          code: error.code || 'INTERNAL_ERROR',
          message: error.message
        });
      }
    });
  }

  async start() {
    try {
      await Promise.all([
        this.engine.initialize(),
        this.sheet.connect(),
        this.performance.startMonitoring()
      ]);

      this._setupRoutes();

      const port = process.env.PORT || CONFIG.DEFAULT_PORT;
      const server = app.listen(port, () => {
        console.log([
          chalk.blue.bold('\n🚀 NexusOne Core v3.0'),
          chalk.gray(`• Port: ${port}`),
          chalk.gray(`• Environment: ${process.env.NODE_ENV || 'production'}`),
          chalk.gray(`• Start Time: ${new Date().toISOString()}\n`)
        ].join('\n'));
      });

      server.on('error', (error) => {
        console.error(chalk.red.bold('⚡ Server Error:'), error);
        process.exit(1);
      });

      return server;
      
    } catch (error) {
      console.error(chalk.red.bold('🔥 Critical Startup Failure:'), error);
      process.exit(1);
    }
  }
}

// Export for Cluster Mode
module.exports = {
  app,
  NexusOneCore
};

// Single Instance Launch
if (require.main === module) {
  console.log(chalk.yellow.bold('\n🔧 Starting NexusOne System...'));
  
  const nexus = new NexusOneCore();
  nexus.start()
    .then(() => console.log(chalk.green.bold('\n✅ System Operational')))
    .catch((error) => console.error(chalk.red.bold('\n❌ Boot Sequence Failed:'), error));
}