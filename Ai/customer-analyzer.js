// Ai/customer-analyzer.mjs - Phiên bản ESM hoàn chỉnh
import _ from 'lodash';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import natural from 'natural';
import logger from '../utils/logger.js';
import Sentiment from 'sentiment';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Tạo __dirname trong ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config
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
    CACHE_TTL: 3600
  }
};

class CustomerAnalyzer {
  constructor() {
    this.cache = new Map();
    this.initializeServices();
  }

  initializeServices() {
    try {
      this.sheet = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;
      this.analyzer = new natural.SentimentAnalyzer('English', this.stemmer, 'afinn');
      this.sentiment = new Sentiment();
      logger.info('AI services initialized');
    } catch (error) {
      logger.error('Service initialization failed', error);
      throw new Error('Failed to initialize AI services');
    }
  }

  async initialize() {
    try {
      const credentialsRaw = await fs.readFile(CONFIG.GOOGLE_SHEETS.CREDENTIALS, 'utf8');
      const credentials = JSON.parse(credentialsRaw);

      await this.sheet.useServiceAccountAuth({
        client_email: credentials.client_email,
        private_key: credentials.private_key
      });

      await this.sheet.loadInfo();
      logger.info('Connected to Google Sheets');
    } catch (error) {
      logger.error('Google Sheets connection failed', error);
      throw new Error('Failed to connect to Google Sheets');
    }
  }

  async analyzeUser(userId) {
    if (this.cache.has(userId)) return this.cache.get(userId);

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

  getSentimentSummary(results) {
    const averageScore = _.meanBy(results, 'score');
    if (averageScore >= CONFIG.SENTIMENT.POSITIVE_THRESHOLD) return 'Positive';
    if (averageScore <= CONFIG.SENTIMENT.NEGATIVE_THRESHOLD) return 'Negative';
    return 'Neutral';
  }

  analyzeBehavior(data) {
    const responseTimes = data.map(entry => this.calculateResponseTime(entry.timestamp));
    const investments = data.map(entry => this.calculateInvestment(entry.message));
    return {
      averageResponseTime: _.mean(responseTimes),
      averageInvestment: _.mean(investments),
    };
  }

  calculateResponseTime(timestamp) {
    const now = new Date();
    const responseTime = (now - new Date(timestamp)) / 1000;
    return responseTime;
  }

  calculateInvestment(message) {
    const investmentKeywords = ['mua', 'đầu tư', 'tiền', 'chiến lược'];
    const messageTokens = this.tokenizer.tokenize(message);
    return _.intersection(messageTokens, investmentKeywords).length;
  }

  calculateScore(sentiment, behavior) {
    const sentimentScore = sentiment.average * CONFIG.SCORING.WEIGHTS.SENTIMENT;
    const investmentScore = behavior.averageInvestment * CONFIG.SCORING.WEIGHTS.INVESTMENT;
    const responseTimeScore = (1 / behavior.averageResponseTime) * CONFIG.SCORING.WEIGHTS.RESPONSE_TIME;
    const baseScore = sentimentScore + investmentScore + responseTimeScore;
    return CONFIG.SCORING.FORMULA(baseScore);
  }
}

const customerAnalyzer = new CustomerAnalyzer();
export default customerAnalyzer;
