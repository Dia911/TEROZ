// server.js - Phiên bản CommonJS hoàn chỉnh
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const logger = require('./utils/logger');
const { NexusOneCore } = require('./core/app');
const faqRouter = require('./config/faq');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware với cấu hình nâng cao
app.use(morgan('combined', { 
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Routes
app.use('/webhook/:platform', (req, res, next) => {
  const platform = req.params.platform;
  logger.info(`Webhook request from ${platform}`, {
    ip: req.ip,
    headers: req.headers
  });
  
  // Security validation
  if (!['facebook', 'telegram', 'zalo'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  
  next();
}, require('./core/platform-router').routeHandler);

app.use('/faq', faqRouter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'operational',
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    env: process.env.NODE_ENV
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Server Error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Closing server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Khởi động ứng dụng
const server = app.listen(PORT, async () => {
  try {
    const nexus = new NexusOneCore();
    await nexus.initialize();
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
});