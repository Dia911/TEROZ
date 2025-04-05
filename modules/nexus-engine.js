const ChatCore = require('../core/app');
const core = new ChatCore();

class NexusEngine {
  constructor() {
    this.sessionState = {};
  }

  handleUserSession(userId, message) {
    const session = this.sessionState[userId] || { step: 'init' };
    
    if (message === 'back') {
      session.step = 'category';
      delete session.currentCategory;
    }

    switch(session.step) {
      case 'init':
        return this.handleInitialStep(userId);
        
      case 'category':
        return this.handleCategorySelection(userId, message);
        
      case 'question':
        return this.handleQuestionSelection(userId, message);
        
      default:
        return this.getErrorMessage();
    }
  }

  handleInitialStep(userId) {
    this.sessionState[userId] = { step: 'category' };
    return {
      type: 'welcome',
      data: core.getWelcomeMessage()
    };
  }

  handleCategorySelection(userId, categoryId) {
    const questions = core.getCategoryQuestions(categoryId);
    
    if (questions.length > 0) {
      this.sessionState[userId] = {
        step: 'question',
        currentCategory: categoryId
      };
      
      return {
        type: 'questions',
        category: categoryId,
        questions: questions.map(q => ({
          id: q.id,
          text: q.question
        }))
      };
    }
    
    return this.getErrorMessage();
  }

  handleQuestionSelection(userId, questionId) {
    const answer = core.getAnswer(questionId);
    
    if (answer) {
      return {
        type: 'answer',
        question: answer.question,
        answer: answer.answer,
        metadata: {
          lastUpdated: faqData.metadata.lastUpdated
        }
      };
    }
    
    return this.getErrorMessage();
  }
}