const FAQManager = require('../modules/faq-manager');

class FacebookBot {
  constructor() {
    this.faq = new FAQManager();
    this.platform = 'facebook';
  }

  async handleMessage(event) {
    const { message, sender } = event;
    const reply = this.faq.getAnswer(message.text) 
                || await NexusEngine.process(message.text);
    
    // Gửi reply phù hợp với Facebook API
    return this.sendAPIResponse(sender.id, reply);
  }
}

module.exports = FacebookBot;