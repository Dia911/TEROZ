const PlatformAdapter = require('./platform-adapter');
const PlatformService = require('./platform-service');
const logger = require('../utils/logger');

class PlatformRouter {
  static async route(platform, req, res) {
    try {
      // 1. Xác thực platform
      if (!PlatformService.supportedPlatforms.includes(platform)) {
        return res.status(400).json({ error: 'Unsupported platform' });
      }

      // 2. Chuẩn hóa incoming request
      const standardizedEvent = PlatformAdapter.standardize(platform, req.body);
      
      // 3. Xử lý bằng core bot
      const botResponse = await PlatformService.process(standardizedEvent);
      
      // 4. Chuyển đổi response phù hợp platform
      const platformResponse = PlatformAdapter.adaptToPlatform(platform, botResponse);
      
      // 5. Trả kết quả
      res.json(platformResponse);
    } catch (error) {
      logger.error(`Platform routing error: ${error}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = PlatformRouter;