const NexusEngine = require('../modules/nexus-engine');
const logger = require('../utils/logger');

class PlatformService {
  static supportedPlatforms = ['facebook', 'zalo', 'telegram', 'tiktok', 'weibo'];

  /**
   * Xử lý message qua core bot
   */
  static async process(event) {
    try {
      // 1. Kiểm tra platform hợp lệ
      if (!this.supportedPlatforms.includes(event.platform)) {
        throw new Error(`Unsupported platform: ${event.platform}`);
      }

      // 2. Gọi core bot hiện tại
      const botResponse = await NexusEngine.processMessage(event);
      
      // 3. Thêm thông tin platform vào response
      return {
        ...botResponse,
        platform: event.platform,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Platform processing error: ${error}`);
      throw error;
    }
  }

  /**
   * Lấy cấu hình cho từng platform
   */
  static getConfig(platform) {
    // Có thể kết nối với file config hoặc database
    return require(`../config/platforms/${platform}-config`);
  }
}

module.exports = PlatformService;