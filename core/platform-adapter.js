class PlatformAdapter {
    /**
     * Chuẩn hóa incoming message từ các nền tảng về format chung
     */
    static standardize(platform, payload) {
      const standardizers = {
        facebook: this._standardizeFacebook,
        zalo: this._standardizeZalo,
        telegram: this._standardizeTelegram,
        tiktok: this._standardizeTikTok,
        weibo: this._standardizeWeibo
      };
  
      return standardizers[platform]?.(payload) || this._standardizeDefault(payload);
    }
  
    /**
     * Chuyển đổi response từ bot sang format từng nền tảng
     */
    static adaptToPlatform(platform, message) {
      const adapters = {
        facebook: this._adaptToFacebook,
        zalo: this._adaptToZalo,
        telegram: this._adaptToTelegram,
        tiktok: this._adaptToTikTok,
        weibo: this._adaptToWeibo
      };
  
      return adapters[platform]?.(message) || this._adaptToDefault(message);
    }
  
    // Facebook
    static _standardizeFacebook(payload) {
      return {
        platform: 'facebook',
        userId: payload.sender.id,
        message: payload.message.text,
        rawData: payload
      };
    }
  
    static _adaptToFacebook(message) {
      return {
        recipient: { id: message.userId },
        message: { text: message.text },
        messaging_type: "RESPONSE"
      };
    }
  
    // Zalo
    static _standardizeZalo(payload) {
      return {
        platform: 'zalo',
        userId: payload.fromuid,
        message: payload.message.text,
        rawData: payload
      };
    }
  
    // ... Thêm các nền tảng khác tương tự
  }
  
  module.exports = PlatformAdapter;