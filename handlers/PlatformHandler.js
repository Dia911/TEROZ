// File: adapters/PlatformAdapter.js

// Load tất cả handlers bằng import dynamic
import * as PlatformHandler from '../handlers/PlatformHandler.js';
import * as Zalo from '../handlers/Zalo.js';
import * as Facebook from '../handlers/Facebook.js';
// ... import thêm các handler khác nếu có

const handlers = {
  PlatformHandler,
  Zalo,
  Facebook
  // ... thêm các handler khác vào đây nếu có
};

class PlatformAdapter {
  static getHandler(platform) {
    const handler = handlers[platform] || handlers.PlatformHandler;

    return {
      process: typeof handler.process === 'function'
        ? handler.process
        : (data) => data,

      format: typeof handler.formatResponse === 'function'
        ? handler.formatResponse
        : (response) => response
    };
  }
}

export default PlatformAdapter;
