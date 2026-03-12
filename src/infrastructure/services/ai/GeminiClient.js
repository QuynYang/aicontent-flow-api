const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ExternalAPIError } = require('../../../shared/errors/CustomErrors');

class GeminiClient {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('Thiếu GEMINI_API_KEY trong file .env');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Sử dụng model flash cho tốc độ nhanh và chi phí rẻ trong lúc test đồ án
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
// (Nếu vẫn lỗi, bạn có thể thử đổi thành "gemini-pro")
  }

  /**
   * Gửi prompt và nhận kết quả text trả về
   * @param {string} prompt - Câu lệnh chỉ thị cho AI
   * @returns {Promise<string>} Nội dung AI sinh ra
   */
  async generateText(prompt) {
    try {
      console.log('🤖 [Gemini] Đang xử lý prompt...');
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return text;
    } catch (error) {
      console.error('❌ [Gemini] Lỗi:', error.message);
      throw new ExternalAPIError('Gemini', error.message);
    }
  }
}

module.exports = GeminiClient;