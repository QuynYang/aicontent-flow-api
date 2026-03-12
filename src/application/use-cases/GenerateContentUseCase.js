const Article = require('../../infrastructure/database/mongoose/ArticleSchema');
const aiFactory = require('../../infrastructure/services/ai/AIProviderFactory');
const googleFacade = require('../../infrastructure/services/google/GoogleWorkspaceFacade');
const ARTICLE_STATUS = require('../../shared/constants/ArticleStatus');

class GenerateContentUseCase {
  /**
   * Thực thi luồng sinh nội dung bằng AI cho 1 bài viết cụ thể
   * @param {string} articleId - ID của bài viết trong MongoDB
   */
  async execute(articleId) {
    // 1. Kéo dữ liệu bài viết lên từ DB
    const article = await Article.findById(articleId);
    if (!article) throw new Error(`Không tìm thấy bài viết với ID: ${articleId}`);

    console.log(`\n▶️ [UseCase] Bắt đầu sản xuất nội dung cho từ khóa: [${article.keyword}]`);
    
    // Khởi tạo Gemini (Mẫu Factory)
    const aiClient = aiFactory.createProvider('GEMINI');

    try {
      // --- PHA 1: LẬP DÀN Ý (OUTLINE) ---
      article.status = ARTICLE_STATUS.GENERATING_OUTLINE;
      await article.save();

      const outlinePrompt = `Đóng vai một chuyên gia SEO. Lập dàn ý cực kỳ chi tiết cho bài viết có tiêu đề/từ khóa: "${article.keyword}". Dàn ý cần có cấu trúc các thẻ H2, H3 rõ ràng. Chỉ in ra dàn ý, không cần giải thích.`;
      const outlineText = await aiClient.generateText(outlinePrompt);
      
      // Ghi dàn ý vào Google Docs
      await googleFacade.appendContentToDoc(article.docId, "=== DÀN Ý AI ===\n" + outlineText);


      // --- PHA 2: VIẾT BÀI CHI TIẾT (CONTENT) ---
      article.status = ARTICLE_STATUS.GENERATING_CONTENT;
      await article.save();

      const contentPrompt = `Đóng vai một Copywriter chuyên nghiệp. Dựa vào dàn ý chi tiết sau đây, hãy viết một bài viết hoàn chỉnh, văn phong lôi cuốn, độ dài tối thiểu 1000 từ cho từ khóa "${article.keyword}". \n\nDàn ý:\n${outlineText}`;
      const contentText = await aiClient.generateText(contentPrompt);

      // Ghi bài viết đè lên trên dàn ý trong Google Docs
      await googleFacade.appendContentToDoc(article.docId, "=== NỘI DUNG CHÍNH ===\n" + contentText);


      // --- PHA 3: HOÀN THÀNH & CẬP NHẬT LOG ---
      article.status = ARTICLE_STATUS.CHECKING_SEO; // Bàn giao state cho bộ phận Check SEO
      article.executionLog.push({ 
        step: 'GENERATE_CONTENT', 
        status: 'SUCCESS', 
        message: 'Sinh bài viết và ghi vào Docs thành công' 
      });
      await article.save();

      console.log(`✅ [UseCase] Hoàn thành luồng bài viết: [${article.keyword}]`);
      return true;

    } catch (error) {
      // Nếu có lỗi API (đứt mạng, AI bị lỗi), ghi nhận FAILED để hệ thống biết
      article.status = ARTICLE_STATUS.FAILED;
      article.errorMessage = error.message;
      article.executionLog.push({ 
        step: 'GENERATE_CONTENT', 
        status: 'ERROR', 
        message: error.message 
      });
      await article.save();
      
      throw error;
    }
  }
}

module.exports = new GenerateContentUseCase();