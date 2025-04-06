// app.js - NexusOne Core Application v3.0 (Optimized)
require('dotenv').config();
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Fixed module paths using absolute paths
const { NexusEngine } = require(path.join(__dirname, '../modules/nexus-engine'));
const CustomerAnalyzer = require(path.join(__dirname, '../Ai/customer-analyzer')); // Sửa lại đường dẫn đúng
const NexusSheet = require(path.join(__dirname, '../Tracking/google-sheets'));
const PerformanceTracker = require(path.join(__dirname, '../utils/logger'));
const PlatformRouter = require(path.join(__dirname, './platform-router'));
const PlatformService = require(path.join(__dirname, './platform-service'));

// Enhanced Middleware Configuration
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

class NexusOneCore {
  constructor() {
    this._validateEnvironment();
    
    // Initialize services with error handling
    try {
      this.engine = new NexusEngine({
        apiKey: process.env.NEXUS_API_KEY,
        environment: process.env.NODE_ENV || 'development'
      });
      
      this.analyzer = new CustomerAnalyzer({
        sentimentThreshold: 0.2,
        language: 'vi'
      });
      
      this.sheet = new NexusSheet({
        sheetId: process.env.GOOGLE_SHEET_ID,
        credentials: path.resolve(__dirname, '../config/service-account.json')
      });
      
      this.performance = new PerformanceTracker();
      this.router = new PlatformRouter();
      this.service = new PlatformService();
    } catch (err) {
      console.error(chalk.red('Core service initialization failed:'), err);
      process.exit(1);
    }

    this._initErrorHandling();
    this._loadPlatformHandlers();
  }

  _validateEnvironment() {
    const requiredVars = [
      'NEXUS_API_KEY',
      'GOOGLE_SHEET_ID',
      'FACEBOOK_APP_SECRET'
    ];
    
    const missingVars = requiredVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  _initErrorHandling() {
    process.on('unhandledRejection', (err) => {
      this.performance.logError(err);
      console.error(chalk.red('[UNHANDLED REJECTION]'), err);
    });
    
    process.on('uncaughtException', (err) => {
      this.performance.logError(err);
      console.error(chalk.red('[UNCAUGHT EXCEPTION]'), err);
      process.exit(1);
    });
  }

  _loadPlatformHandlers() {
    try {
      const handlersDir = path.resolve(__dirname, '../handlers');
      const platformFiles = fs.readdirSync(handlersDir);
      
      platformFiles.forEach(file => {
        if (file.endsWith('.js') && file !== 'PlatformHandler.js') {
          try {
            const platformName = path.basename(file, '.js');
            const HandlerClass = require(path.join(handlersDir, file));
            
            this.router.register(
              platformName, 
              new HandlerClass(this.engine, this.analyzer)
            );
            
            console.log(chalk.green(`✓ Loaded handler for ${platformName}`));
          } catch (err) {
            console.error(chalk.red(`Failed to load handler ${file}:`), err);
          }
        }
      });
    } catch (err) {
      console.error(chalk.red('Failed to load platform handlers:'), err);
    }
  }

  _setupRoutes() {
    // Health Check with improved response
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        version: '3.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Webhook Route with enhanced error handling
    app.post('/webhook/:platform', async (req, res) => {
      const startTime = Date.now();
      const { platform } = req.params;
      
      try {
        const result = await this.router.handle(platform, req.body);
        
        await this.sheet.logInteraction({
          platform,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          data: result
        });
        
        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        this.performance.logError(error);
        
        // Log failed interaction
        await this.sheet.logInteraction({
          platform,
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        }).catch(e => console.error('Failed to log error:', e));
        
        res.status(500).json({ 
          success: false,
          error: error.message,
          code: error.code || 'INTERNAL_ERROR'
        });
      }
    });
  }

  async start() {
    try {
      await Promise.all([
        this.engine.initialize(),
        this.sheet.connect()
      ]);
      
      this._setupRoutes();
      
      const port = process.env.PORT || 3000;
      const server = app.listen(port, () => {
        console.log(chalk.blue.bold(`\nNexusOne Core v3.0 running on port ${port}`));
        console.log(chalk.grey(`Environment: ${process.env.NODE_ENV || 'development'}`));
        console.log(chalk.grey(`Start time: ${new Date().toISOString()}\n`));
      });
      
      // Enhanced server error handling
      server.on('error', (err) => {
        console.error(chalk.red('Server error:'), err);
        process.exit(1);
      });
      
      return app;
    } catch (error) {
      this.performance.logError(error);
      console.error(chalk.red('Failed to start NexusOne Core:'), error);
      process.exit(1);
    }
  }
}

module.exports = {
  app,
  NexusOneCore
};

// Startup with improved logging
if (require.main === module) {
  console.log(chalk.yellow('Starting NexusOne Core application...'));
  
  const nexus = new NexusOneCore();
  nexus.start()
    .then(() => {
      console.log(chalk.green('Application started successfully'));
    })
    .catch(err => {
      console.error(chalk.red('Fatal startup error:'), err);
      process.exit(1);
    });
}
