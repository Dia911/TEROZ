require('dotenv').config();
const app = require('./core/app');
const PlatformRouter = require('./core/platform-router');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(require('morgan')('combined', { stream: logger.stream }));
app.use(require('cors')());
app.use(require('helmet')());
app.use(require('express').json());

// Routes
app.use('/webhook/:platform', (req, res) => {
  const platform = req.params.platform;
  logger.info(`Incoming webhook from ${platform}`);
  PlatformRouter.route(platform, req, res);
});

const faqRouter = require('./config/faq');
app.use('/faq', faqRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error(`Server error: ${err.stack}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Server start
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});