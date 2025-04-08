import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import createNexusOneCore from './app.js';

// 1. Cấu hình môi trường
dotenv.config();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 2. Khởi tạo ứng dụng Express chính
const mainApp = express();

// 3. Cấu hình logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// 4. Middleware cơ bản
mainApp.use(helmet());
mainApp.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
mainApp.use(compression());
mainApp.use(express.json({ limit: '10kb' }));

// 5. Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
mainApp.use(limiter);

// 6. Khởi tạo và tích hợp NexusOne Core
let nexusApp;
(async () => {
  try {
    // Tạo core application
    nexusApp = await createNexusOneCore();
    
    // Mount NexusOne app vào main app
    mainApp.use('/api', nexusApp.app);

    // 7. Routes cơ bản
    mainApp.get('/', (req, res) => {
      logger.info('Root endpoint accessed');
      res.status(200).json({
        status: 'success',
        message: 'NexusOne API is running',
        environment: NODE_ENV,
        version: '3.0'
      });
    });

    mainApp.get('/healthz', (req, res) => {
      res.status(200).send('OK');
    });

    // 8. Xử lý lỗi
    mainApp.use((err, req, res, next) => {
      logger.error(`Error: ${err.stack}`);
      
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error',
        ...(NODE_ENV === 'development' && { error: err.message })
      });
    });

    // 9. Khởi động server
    const server = mainApp.listen(PORT, () => {
      logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
      console.log(chalk.green.bold(`\n🚀 Server started on port ${PORT}`));
    });

    // 10. Xử lý shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error(`Failed to start application: ${error.stack}`);
    process.exit(1);
  }
})();

// Export cho testing
export default mainApp;