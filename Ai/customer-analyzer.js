// Ai/customer-analyzer.js
const _ = require('lodash');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const natural = require('natural');
const logger = require('../utils/logger');
const config = require('../config/service-account.json');
const Sentiment = require('sentiment'); // Alternative sentiment analysis

// Constants
const SENTIMENT_THRESHOLDS = {
  POSITIVE: 0.3,
  NEGATIVE: -0.3
};
const POTENTIAL_SCORE_WEIGHTS = {
  SENTIMENT: 25,
  INVESTMENT_QUESTION: 5,
  RESPONSE_TIME: 10
};
const RECOMMENDED_ACTIONS = {
  HIGH: 'priority_support',
  MEDIUM: 'follow_up',
  LOW: 'general_follow_up',
  DEFAULT: 'standard_response'
};

class CustomerAnalyzer {
  constructor() {
    this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
    
    // Initialize NLP tools with proper configurations
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
    
    // Initialize sentiment analysis with fallback
    try {
      this.analyzer = new natural.SentimentAnalyzer(
        "English", 
        natural.PorterStemmer, 
        "afinn"
      );
      this.useNatural = true;
    } catch (error) {
      logger.warn('Using alternative sentiment analyzer');
      this.sentiment = new Sentiment();
      this.useNatural = false;
    }
  }

  async initialize() {
    try {
      if (!process.env.GOOGLE_SHEET_ID) {
        throw new Error('GOOGLE_SHEET_ID environment variable not set');
      }

      await this.doc.useServiceAccountAuth({
        client_email: config.client_email,
        private_key: config.private_key
      });
      
      await this.doc.loadInfo();
      logger.info('CustomerAnalyzer initialized successfully');
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`, { error });
      throw new Error(`Analyzer initialization failed: ${error.message}`);
    }
  }

  async analyzeCustomerInteractions(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const sheet = this.doc.sheetsByIndex[0];
      const rows = await sheet.getRows();
      
      const userInteractions = rows.filter(row => row.userId === userId);
      
      if (userInteractions.length === 0) {
        return { 
          status: 'not_found',
          message: 'No interactions found for this user',
          userId
        };
      }

      // Process interactions in parallel where possible
      const [sentimentResults, behaviorPatterns] = await Promise.all([
        this.analyzeSentiment(userInteractions),
        this.analyzeBehavior(userInteractions)
      ]);
      
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
        recommendedAction: this.getRecommendedAction(potentialScore),
        status: 'success'
      };
    } catch (error) {
      logger.error(`Analysis failed for user ${userId}: ${error.message}`, { error });
      throw new Error(`Customer analysis failed: ${error.message}`);
    }
  }

  analyzeSentiment(interactions) {
    const sentimentScores = interactions.map(interaction => {
      let score;
      
      if (this.useNatural) {
        const tokens = this.tokenizer.tokenize(interaction.message);
        score = this.analyzer.getSentiment(tokens);
      } else {
        const result = this.sentiment.analyze(interaction.message);
        score = result.comparative;
      }

      return {
        message: interaction.message,
        score: score,
        timestamp: interaction.timestamp
      };
    });

    const averageScore = _.meanBy(sentimentScores, 'score');
    
    let overallSentiment = 'neutral';
    if (averageScore > SENTIMENT_THRESHOLDS.POSITIVE) {
      overallSentiment = 'positive';
    } else if (averageScore < SENTIMENT_THRESHOLDS.NEGATIVE) {
      overallSentiment = 'negative';
    }

    return {
      averageScore: parseFloat(averageScore.toFixed(2)),
      breakdown: sentimentScores,
      overallSentiment,
      positiveCount: sentimentScores.filter(s => s.score > SENTIMENT_THRESHOLDS.POSITIVE).length,
      negativeCount: sentimentScores.filter(s => s.score < SENTIMENT_THRESHOLDS.NEGATIVE).length
    };
  }

  analyzeBehavior(interactions) {
    const behaviorMetrics = {
      questionTypes: {},
      timePatterns: {},
      responseTimes: [],
      interactionFrequency: 0
    };

    // Calculate interaction frequency (interactions per day)
    if (interactions.length > 1) {
      const firstDate = new Date(interactions[0].timestamp);
      const lastDate = new Date(interactions[interactions.length - 1].timestamp);
      const days = (lastDate - firstDate) / (1000 * 60 * 60 * 24) || 1;
      behaviorMetrics.interactionFrequency = interactions.length / days;
    }

    interactions.forEach(interaction => {
      // Classify question type
      const questionType = this.classifyQuestion(interaction.message);
      behaviorMetrics.questionTypes[questionType] = 
        (behaviorMetrics.questionTypes[questionType] || 0) + 1;
      
      // Analyze time patterns
      const hour = new Date(interaction.timestamp).getHours();
      const timeSlot = `${hour}:00-${hour + 1}:00`;
      behaviorMetrics.timePatterns[timeSlot] = 
        (behaviorMetrics.timePatterns[timeSlot] || 0) + 1;
      
      // Calculate response times
      if (interaction.responseTimestamp) {
        const responseTime = (new Date(interaction.responseTimestamp) - 
                           new Date(interaction.timestamp)) / 60000; // in minutes
        behaviorMetrics.responseTimes.push(responseTime);
      }
    });

    // Calculate averages
    behaviorMetrics.avgResponseTime = behaviorMetrics.responseTimes.length > 0 ?
      _.round(_.mean(behaviorMetrics.responseTimes), 2) : null;
      
    behaviorMetrics.mostActiveTime = _.maxBy(
      Object.entries(behaviorMetrics.timePatterns),
      ([, count]) => count
    )?.[0] || 'N/A';

    behaviorMetrics.primaryQuestionType = _.maxBy(
      Object.entries(behaviorMetrics.questionTypes),
      ([, count]) => count
    )?.[0] || 'general_inquiry';

    return behaviorMetrics;
  }

  classifyQuestion(message) {
    const lowerMsg = message.toLowerCase();
    
    if (/(giá|chi phí|giá cả|phí)/.test(lowerMsg)) {
      return 'price_inquiry';
    } else if (/(đăng ký|thành viên|đăng kí|register)/.test(lowerMsg)) {
      return 'registration';
    } else if (/(đầu tư|cổ đông|investment|góp vốn)/.test(lowerMsg)) {
      return 'investment';
    } else if (/(khiếu nại|phàn nàn|complaint)/.test(lowerMsg)) {
      return 'complaint';
    } else if (/(hỗ trợ|help|tư vấn)/.test(lowerMsg)) {
      return 'support';
    } else {
      return 'general_inquiry';
    }
  }

  calculatePotentialScore(sentiment, behavior) {
    let score = 0;
    
    // Score from sentiment (weighted)
    score += sentiment.averageScore * POTENTIAL_SCORE_WEIGHTS.SENTIMENT;
    
    // Score from question types
    if (behavior.questionTypes.investment) {
      score += behavior.questionTypes.investment * POTENTIAL_SCORE_WEIGHTS.INVESTMENT_QUESTION;
    }
    
    // Score from response time (faster = better)
    if (behavior.avgResponseTime !== null) {
      const responseTimeScore = (1 - Math.min(behavior.avgResponseTime / 60, 1)) * 
                              POTENTIAL_SCORE_WEIGHTS.RESPONSE_TIME;
      score += responseTimeScore;
    }
    
    // Additional points for high interaction frequency
    if (behavior.interactionFrequency > 1) {
      score += Math.log(behavior.interactionFrequency) * 5;
    }
    
    // Ensure score is between 0-100
    return _.round(_.clamp(score, 0, 100), 1);
  }

  getLastInteraction(interactions) {
    if (!interactions.length) return null;
    
    return _.maxBy(interactions, interaction => 
      new Date(interaction.timestamp).getTime()
    );
  }

  getRecommendedAction(score) {
    if (score >= 80) return RECOMMENDED_ACTIONS.HIGH;
    if (score >= 60) return RECOMMENDED_ACTIONS.MEDIUM;
    if (score >= 40) return RECOMMENDED_ACTIONS.LOW;
    return RECOMMENDED_ACTIONS.DEFAULT;
  }
}

// Singleton instance
module.exports = new CustomerAnalyzer();