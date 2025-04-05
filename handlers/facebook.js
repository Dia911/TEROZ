const path = require('path');
const faq = require(path.resolve(__dirname, '../config/faq'));

class FacebookHandler {
  constructor(config) {
    if (!config || !config.userId) {
      throw new Error('❌ Thiếu userId khi khởi tạo FacebookHandler');
    }
    this.userId = config.userId; // Đã sửa lỗi chính tả "conxafig" -> "config"
    this.session = {}; // Thêm session management
    console.log(`🟢 Khởi tạo bot Messenger cho user [${this.userId}]`);
  }

  async handleMessage(event) {
    try {
      // Validate event
      if (!event || !event.sender || !event.sender.id) {
        throw new Error('Event structure invalid');
      }

      const msgText = this.normalizeMessage(event);

      // ===== CORE LOGIC =====
      // 1. Xử lý quick reply
      if (event.message?.quick_reply?.payload) {
        return this.handleQuickReply(event);
      }

      // 2. Xử lý FAQ
      const faqResponse = this.checkFAQ(msgText);
      if (faqResponse) return this.sendReply(event, faqResponse);

      // 3. Logic mặc định
      this.sendReply(event, faq.fallback);

    } catch (error) {
      console.error('❌ Lỗi xử lý tin nhắn:', error.stack || error.message);
      this.sendReply(event, 'Bot gặp sự cố, vui lòng thử lại sau!');
    }
  }

  // ==================== OPTIMIZED METHODS ====================
  normalizeMessage(event) {
    return (event.message?.text || '').trim().toLowerCase();
  }

  checkFAQ(message) {
    const patterns = {
      greeting: /(chào|hello|hi|xin chào)\b/,
      pricing: /(giá|báo giá|price|cost)\b/,
      contact: /(liên hệ|contact|sđt|phone)\b/
    };

    if (patterns.greeting.test(message)) return faq.greeting;
    if (patterns.pricing.test(message)) return faq.pricing;
    if (patterns.contact.test(message)) return faq.contact;
    
    return null;
  }

  handleQuickReply(event) {
    const payload = event.message.quick_reply.payload;
    console.log(`🔘 Quick Reply payload: ${payload}`);
    
    // Thêm logic xử lý quick reply tại đây
    this.sendReply(event, `Đã nhận quick reply: ${payload}`);
  }

  sendReply(event, message) {
    if (!message) return;
    
    // Mock gửi message thực tế
    const response = {
      recipient: { id: event.sender.id },
      message: { text: message }
    };
    
    console.log(`📤 [Bot → User ${event.sender.id.substr(0, 5)}...]:`, message);
    return response; // Trả về response để test
  }
}

module.exports = { FacebookHandler }; // Export dạng object