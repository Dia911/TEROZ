// app.js - NexusOne Testing Framework v2.2
require('dotenv').config();
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { NexusEngine } = require('../modules/nexus-engine')
const { CustomerAnalyzer } = require('./ai/customer-analyzer');
const { NexusSheet } = require('./services/nexus-sheet');
const { PerformanceTracker } = require('./utils/performance');

// Middleware
app.use(express.json());

// Khởi tạo ứng dụng
const tester = new NexusOneTester();

// Routes cơ bản
app.get('/', (req, res) => {
  res.send('NexusOne Testing Framework is running');
});

class NexusOneTester {
  constructor() {
    this.engine = new NexusEngine({
      apiKey: process.env.NEXUS_API_KEY,
      mode: process.env.TEST_MODE || 'standard'
    });
    
    this.analyzer = new CustomerAnalyzer();
    this.sheet = new NexusSheet({
      sheetId: process.env.GOOGLE_SHEET_ID,
      credentialPath: path.resolve(__dirname, 'config', 'google-credentials.json')
    });
    
    this.performance = new PerformanceTracker();
    this.loadScenarios();
    this.initConsoleStyles();
  }

  // ... (giữ nguyên tất cả các phương thức khác)
}

// Export app cho server.js
module.exports = app;

// Khởi chạy tester (nếu chạy trực tiếp file này)
if (require.main === module) {
  new NexusOneTester().start().catch(console.error);
}