const GeminiClient = require('./GeminiClient');

class AIProviderFactory {
  /**
   * Khởi tạo client AI dựa trên cấu hình
   * @param {string} providerType - 'GEMINI', 'POE', hoặc 'CHATGPT'
   * @returns {Object} Thể hiện của class AI Client tương ứng
   */
  static createProvider(providerType = 'GEMINI') {
    switch (providerType.toUpperCase()) {
      case 'GEMINI':
        return new GeminiClient();
      case 'POE':
        // Sau này bạn code PoeClient thì un-comment dòng dưới
        // return new PoeClient();
        throw new Error('PoeClient chưa được implement trong hệ thống.');
      case 'CHATGPT':
        throw new Error('ChatGPTClient chưa được implement.');
      default:
        console.warn(`⚠️ [Factory] Provider ${providerType} không hợp lệ. Mặc định dùng GEMINI.`);
        return new GeminiClient();
    }
  }
}

module.exports = AIProviderFactory;