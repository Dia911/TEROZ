require('dotenv').config(); // Load biến môi trường
const app = require('./core/app');
const PlatformRouter = require('./core/platform-router');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 3000;

// Middleware cơ bản
app.use(require('morgan')('combined', { stream: logger.stream }));
app.use(require('cors')());
app.use(require('helmet')());
app.use(require('express').json());

// Route đa nền tảng
app.use('/webhook/:platform', (req, res) => {
  const platform = req.params.platform;
  logger.info(`Incoming webhook from ${platform}`);
  PlatformRouter.route(platform, req, res);
});

// Route FAQ
const faqRouter = require('./config/faq');
app.use('/faq', faqRouter);

// Route health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
  logger.error(`Server error: ${err.stack}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Khởi động server
const server = app.listen(PORT, () => {
  const baseUrl = `http://localhost:${PORT}`;
  
  console.log(`\n=== NexusOne Server ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`\n[Webhook Endpoints]`);
  console.log(`- Facebook: ${baseUrl}/webhook/facebook`);
  console.log(`- Zalo: ${baseUrl}/webhook/zalo`);
  console.log(`- Telegram: ${baseUrl}/webhook/telegram`);
  console.log(`- TikTok: ${baseUrl}/webhook/tiktok`);
  console.log(`- Weibo: ${baseUrl}/webhook/weibo`);
  
  console.log(`\n[FAQ Endpoints]`);
  console.log(`- Danh sách: ${baseUrl}/faq`);
  console.log(`- Chi tiết: ${baseUrl}/faq/:categoryId`);
  
  console.log(`\n[System Endpoints]`);
  console.log(`- Health check: ${baseUrl}/health`);
  console.log(`- Metrics: ${baseUrl}/metrics`);
});

// Khởi động tester nếu có
if (app.tester) {
  app.tester.start()
    .then(() => logger.info('Tester started successfully'))
    .catch(err => logger.error('Tester failed to start:', err));
}

// Xử lý tắt server đúng cách
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server terminated');
    process.exit(0);
  });
});

module.exports = server;