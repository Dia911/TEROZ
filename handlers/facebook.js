// File: handlers/Facebook.js

import path from 'path';
import { fileURLToPath } from 'url';
import faq from '../config/faq.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FacebookHandler {
  constructor(config) {
    if (!config || !config.userId) {
      throw new Error('❌ Thiếu userId khi khởi tạo FacebookHandler');
    }
    this.userId = config.userId;
    this.session = {};
    console.log(`🟢 Khởi tạo bot Messenger cho user [${this.userId}]`);
  }

  async handleMessage(event) {
    try {
      if (!event || !event.sender || !event.sender.id) {
        throw new Error('Event structure invalid');
      }

      const msgText = this.normalizeMessage(event);

      // 1. Xử lý quick reply
      if (event.message?.quick_reply?.payload) {
        return this.handleQuickReply(event);
      }

      // 2. Xử lý FAQ
      const faqResponse = this.checkFAQ(msgText);
      if (faqResponse) return this.sendReply(event, faqResponse);

      // 3. Mặc định
      return this.sendReply(event, faq.fallback);

    } catch (error) {
      console.error('❌ Lỗi xử lý tin nhắn:', error.stack || error.message);
      return this.sendReply(event, 'Bot gặp sự cố, vui lòng thử lại sau!');
    }
  }

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
    return this.sendReply(event, `Đã nhận quick reply: ${payload}`);
  }

  sendReply(event, message) {
    if (!message) return;

    const response = {
      recipient: { id: event.sender.id },
      message: { text: message }
    };

    console.log(`📤 [Bot → User ${event.sender.id.substr(0, 5)}...]:`, message);
    return response;
  }
}

// ✅ Export đúng chuẩn ESM
export function process(event, config) {
  const handler = new FacebookHandler(config);
  return handler.handleMessage(event);
}

export function formatResponse(response) {
  return response;
}
