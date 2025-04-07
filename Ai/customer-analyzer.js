// Ai/customer-analyzer.js - Phiên bản CommonJS hoàn chỉnh
const _ = require('lodash');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const natural = require('natural');
const logger = require('../utils/logger');
const Sentiment = require('sentiment');
const path = require('path');
const fs = require('fs').promises;

// Config từ file riêng
const CONFIG = {
  SENTIMENT: {
    POSITIVE_THRESHOLD: 0.3,
    NEGATIVE_THRESHOLD: -0.3,
    LANGUAGE: 'vi'
  },
  SCORING: {
    WEIGHTS: {
      SENTIMENT: 25,
      INVESTMENT: 5,
      RESPONSE_TIME: 10
    },
    FORMULA: (baseScore) => Math.min(Math.max(baseScore, 0), 100)
  },
  GOOGLE_SHEETS: {
    CREDENTIALS: path.resolve(__dirname, '../config/service-account.json'),
    SHEET_INDEX: 0,
    CACHE_TTL: 3600 // 1 hour
  }
};

class CustomerAnalyzer {
  constructor() {
    this.cache = new Map();
    this.initializeServices();
  }

  initializeServices() {
    try {
      // Khởi tạo Google Sheets
      this.sheet = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
      
      // Khởi tạo NLP
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;
      this.analyzer = new natural.SentimentAnalyzer('English', this.stemmer, 'afinn');
      
      // Fallback sentiment
      this.sentiment = new Sentiment();
      
      logger.info('AI services initialized');
    } catch (error) {
      logger.error('Service initialization failed', error);
      throw new Error('Failed to initialize AI services');
    }
  }

  async initialize() {
    try {
      await this.sheet.useServiceAccountAuth({
        client_email: require(CONFIG.GOOGLE_SHEETS.CREDENTIALS).client_email,
        private_key: require(CONFIG.GOOGLE_SHEETS.CREDENTIALS).private_key
      });
      
      await this.sheet.loadInfo();
      logger.info('Connected to Google Sheets');
    } catch (error) {
      logger.error('Google Sheets connection failed', error);
      throw new Error('Failed to connect to Google Sheets');
    }
  }

  async analyzeUser(userId) {
    if (this.cache.has(userId)) {
      return this.cache.get(userId);
    }

    try {
      const data = await this.fetchUserData(userId);
      const analysis = await this.processData(data);
      
      this.cache.set(userId, analysis);
      setTimeout(() => this.cache.delete(userId), CONFIG.GOOGLE_SHEETS.CACHE_TTL);
      
      return analysis;
    } catch (error) {
      logger.error(`Analysis failed for user ${userId}`, error);
      throw new Error(`User analysis failed: ${error.message}`);
    }
  }

  async fetchUserData(userId) {
    const sheet = this.sheet.sheetsByIndex[CONFIG.GOOGLE_SHEETS.SHEET_INDEX];
    const rows = await sheet.getRows();
    return rows.filter(row => row.userId === userId);
  }

  async processData(data) {
    const [sentiment, behavior] = await Promise.all([
      this.analyzeSentiment(data),
      this.analyzeBehavior(data)
    ]);

    return {
      sentiment,
      behavior,
      score: this.calculateScore(sentiment, behavior),
      timestamp: new Date().toISOString()
    };
  }

  analyzeSentiment(data) {
    const results = data.map(entry => ({
      text: entry.message,
      score: this.calculateSentiment(entry.message),
      date: entry.timestamp
    }));

    return {
      average: _.meanBy(results, 'score'),
      breakdown: results,
      summary: this.getSentimentSummary(results)
    };
  }

  calculateSentiment(text) {
    try {
      const tokens = this.tokenizer.tokenize(text);
      return this.analyzer.getSentiment(tokens);
    } catch {
      return this.sentiment.analyze(text).comparative;
    }
  }

  // ... Các phương thức khác giữ nguyên
}

module.exports = new CustomerAnalyzer();