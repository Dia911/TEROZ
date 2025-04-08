// platform-router.js
import path from 'path';
import { fileURLToPath } from 'url';
import { PlatformAdapter } from './platform-adapter.js';

// Khởi tạo __dirname vì ES Modules không có sẵn
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PlatformRouter {
  static async route(platform, req, res) {
    try {
      // Tạo đường dẫn đến webhook handler theo platform
      const webhookPath = path.join(__dirname, '../platforms', platform, 'webhook.js');

      // Import dynamic webhook handler
      const { default: webhookHandler } = await import(`file://${webhookPath}`);

      // Gọi handler
      const result = await webhookHandler(req, res);
      return result;

    } catch (error) {
      console.error(`[${platform}] Routing failed:`, error);
      res.status(500).json({ error: 'Platform routing error' });
    }
  }
}
