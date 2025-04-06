// Ai/customer-analyzer.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const natural = require('natural');
const logger = require('../utils/logger');
const config = require('../config/service-account.json');

class CustomerAnalyzer {
  constructor() {
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    this.tokenizer = new natural.WordTokenizer();
    this.analyzer = new natural.SentimentAnalyzer();
    this.classifier = new natural.BayesClassifier();
  }

  async initialize() {
    try {
      await this.doc.useServiceAccountAuth(config);
      await this.doc.loadInfo();
      logger.info('CustomerAnalyzer initialized successfully');
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  async analyzeCustomerInteractions(userId) {
    const sheet = this.doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    const userInteractions = rows.filter(row => row.userId === userId);
    
    if (userInteractions.length === 0) {
      return { 
        status: 'not_found',
        message: 'No interactions found for this user' 
      };
    }

    // Phân tích tâm lý
    const sentimentResults = this.analyzeSentiment(userInteractions);
    
    // Phân tích hành vi
    const behaviorPatterns = this.analyzeBehavior(userInteractions);
    
    // Đánh giá tiềm năng
    const potentialScore = this.calculatePotentialScore(
      sentimentResults, 
      behaviorPatterns
    );

    return {
      userId,
      interactionCount: userInteractions.length,
      sentimentAnalysis: sentimentResults,
      behaviorPatterns,
      potentialScore,
      lastInteraction: this.getLastInteraction(userInteractions),
      recommendedAction: this.getRecommendedAction(potentialScore)
    };
  }

  analyzeSentiment(interactions) {
    const sentimentScores = interactions.map(interaction => {
      const tokens = this.tokenizer.tokenize(interaction.message);
      return {
        message: interaction.message,
        score: this.analyzer.getSentiment(tokens),
        timestamp: interaction.timestamp
      };
    });

    const averageScore = sentimentScores.reduce(
      (sum, curr) => sum + curr.score, 0
    ) / sentimentScores.length;

    return {
      averageScore,
      breakdown: sentimentScores,
      overallSentiment: averageScore >= 0 ? 'positive' : 'negative'
    };
  }

  analyzeBehavior(interactions) {
    const behaviorMetrics = {
      questionTypes: {},
      timePatterns: {},
      responseTimes: []
    };

    interactions.forEach(interaction => {
      // Phân loại câu hỏi
      const questionType = this.classifyQuestion(interaction.message);
      behaviorMetrics.questionTypes[questionType] = 
        (behaviorMetrics.questionTypes[questionType] || 0) + 1;
      
      // Phân tích thời gian
      const hour = new Date(interaction.timestamp).getHours();
      behaviorMetrics.timePatterns[hour] = 
        (behaviorMetrics.timePatterns[hour] || 0) + 1;
      
      // Tính thời gian phản hồi (nếu có)
      if (interaction.responseTimestamp) {
        const responseTime = new Date(interaction.responseTimestamp) - 
                           new Date(interaction.timestamp);
        behaviorMetrics.responseTimes.push(responseTime);
      }
    });

    return behaviorMetrics;
  }

  classifyQuestion(message) {
    if (message.includes('giá') || message.includes('chi phí')) {
      return 'price_inquiry';
    } else if (message.includes('đăng ký') || message.includes('thành viên')) {
      return 'registration';
    } else if (message.includes('đầu tư') || message.includes('cổ đông')) {
      return 'investment';
    } else {
      return 'general_inquiry';
    }
  }

  calculatePotentialScore(sentiment, behavior) {
    let score = 0;
    
    // Điểm từ tâm lý
    score += sentiment.averageScore * 20;
    
    // Điểm từ loại câu hỏi
    if (behavior.questionTypes.investment) {
      score += behavior.questionTypes.investment * 5;
    }
    
    // Điểm từ thời gian phản hồi trung bình
    if (behavior.responseTimes.length > 0) {
      const avgResponseTime = behavior.responseTimes.reduce(
        (a, b) => a + b, 0) / behavior.responseTimes.length;
      score += (1 - Math.min(avgResponseTime / 60000, 1)) * 10;
    }
    
    return Math.min(Math.max(score, 0), 100);
  }

  getLastInteraction(interactions) {
    return interactions.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? 
        current : latest;
    });
  }

  getRecommendedAction(score) {
    if (score >= 80) return 'priority_support';
    if (score >= 60) return 'follow_up';
    if (score >= 40) return 'general_follow_up';
    return 'standard_response';
  }
}

module.exports = new CustomerAnalyzer();