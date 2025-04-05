class PlatformHandler {
  constructor(session) {
    this.session = session || {};
    this.platform = 'unknown';
  }

  async track(data) {
    throw new Error('Phương thức track() phải được triển khai');
  }
}

module.exports = PlatformHandler;