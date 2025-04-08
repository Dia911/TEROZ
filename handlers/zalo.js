// File: handlers/Zalo.js

class ZaloHandler {
  constructor(config) {
    if (!config || !config.userId) {
      throw new Error('❌ Thiếu userId khi khởi tạo ZaloHandler');
    }
    this.userId = config.userId;
  }

  async handleMessage(event) {
    if (!event.text) {
      throw new Error('❌ Thiếu trường text trong event');
    }

    console.log(`💬 Xử lý tin nhắn Zalo từ [${this.userId}]:`, event.text);

    // Logic xử lý tin nhắn có thể mở rộng tại đây
    return {
      recipient: { id: this.userId },
      message: { text: `Zalo bot đã nhận: ${event.text}` }
    };
  }
}

// ✅ Export đúng chuẩn ESM
export function process(event, config) {
  const handler = new ZaloHandler(config);
  return handler.handleMessage(event);
}

export function formatResponse(response) {
  return response;
}
