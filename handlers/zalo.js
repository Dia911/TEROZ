class ZaloHandler {
  constructor(config) {
    this.userId = config.userId;
  }

  async handleMessage(event) {
    if (!event.text) throw new Error('Missing text in event');
    
    console.log(`Xử lý tin nhắn Zalo từ ${this.userId}:`, event.text);
    // Thêm logic xử lý ở đây
  }
}

module.exports = { ZaloHandler }; // <- Phải export đúng dạng Class