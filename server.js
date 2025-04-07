// server.js - Phiên bản hoàn chỉnh cho NexusOne
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { NexusOneCore } = require('./core/app');
const faqRouter = require('./config/faq');

// Khởi tạo Express app
const app = express();
const PORT = process.env.PORT || 3000;

// 1. CẤU HÌNH BẢO MẬT NÂNG CAO
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
      connectSrc: ["'self'", 'https://*.googleapis.com']
    }
  },
  hsts: {
    maxAge: 63072000, // 2 năm
    includeSubDomains: true,
    preload: true
  }
}));

// 2. RATE LIMITING (Chống DDoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500, // Giới hạn 500 request/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút'
});

// 3. MIDDLEWARE CORE
app.use(morgan('combined', { 
  stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://yourdomain.com',
    'https://admin.yourdomain.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. ROUTES CHÍNH
// 4.1 Webhook Platform
app.use('/webhook/:platform', apiLimiter, (req, res, next) => {
  const platform = req.params.platform;
  const validPlatforms = ['facebook', 'telegram', 'zalo', 'tiktok', 'weibo'];
  
  if (!validPlatforms.includes(platform)) {
    logger.warn(`Attempt to access invalid platform: ${platform}`, {
      ip: req.ip,
      headers: req.headers
    });
    return res.status(400).json({ error: 'Invalid platform' });
  }
  
  logger.info(`Webhook request from ${platform}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  next();
}, require('./handlers/PlatformHandler'));

// 4.2 FAQ Routes
app.use('/api/faq', faqRouter);

// 4.3 Health Check
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'operational',
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    database: 'connected', // Thêm trạng thái kết nối DB nếu có
    timestamp: new Date().toISOString()
  };
  res.status(200).json(healthStatus);
});

// 4.4 Static Files (nếu cần)
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// 5. XỬ LÝ LỖI
app.use((err, req, res, next) => {
  const errorId = require('crypto').randomBytes(8).toString('hex');
  
  logger.error(`Error ${errorId}`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    user: req.user || 'unauthenticated'
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    errorId,
    docs: 'https://docs.nexusone.com/errors' // Link tài liệu lỗi
  });
});

// 6. GRACEFUL SHUTDOWN
function shutdown() {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Force shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// 7. KHỞI ĐỘNG SERVER
const server = app.listen(PORT, async () => {
  try {
    const nexus = new NexusOneCore();
    await nexus.initialize();
    
    logger.info(`🟢 Server running on port ${PORT}`, {
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage()
    });
    
    // Ghi nhận startup thành công
    if (process.env.NODE_ENV === 'production') {
      require('./tracking/google-sheets').logStartup();
    }
  } catch (error) {
    logger.error('🔴 Failed to start server', error);
    process.exit(1);
  }
});

// Xử lý lỗi unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = server; // Cho mục đích testing