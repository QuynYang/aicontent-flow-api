const puppeteer = require('puppeteer');

class PuppeteerBrowserManager {
  constructor() {
    // Singleton Pattern: Nếu đã có instance rồi thì trả về luôn, không tạo mới
    if (PuppeteerBrowserManager.instance) {
      return PuppeteerBrowserManager.instance;
    }
    
    this.browser = null;
    PuppeteerBrowserManager.instance = this;
  }

  /**
   * Khởi tạo hoặc lấy trình duyệt hiện tại
   */
  async getBrowser() {
    if (!this.browser) {
      console.log('🌐 [Puppeteer] Đang khởi động trình duyệt ảo Chromium...');
      this.browser = await puppeteer.launch({
        headless: "new", // Chạy ngầm không hiện giao diện (khi test bạn có thể đổi thành false để xem nó tự click)
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Tối ưu RAM cho server
          '--disable-gpu'
        ]
      });
      console.log('✅ [Puppeteer] Khởi động trình duyệt thành công.');
    }
    return this.browser;
  }

  /**
   * Đóng trình duyệt an toàn khi tắt server
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🛑 [Puppeteer] Đã đóng trình duyệt ảo.');
    }
  }
}

module.exports = new PuppeteerBrowserManager();