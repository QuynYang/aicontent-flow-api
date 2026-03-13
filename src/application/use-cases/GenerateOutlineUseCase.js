const Article = require('../../infrastructure/database/mongoose/ArticleSchema');
const aiFactory = require('../../infrastructure/services/ai/AIProviderFactory');
const googleFacade = require('../../infrastructure/services/google/GoogleWorkspaceFacade');
const ARTICLE_STATUS = require('../../shared/constants/ArticleStatus');

class GenerateOutlineUseCase {
  /**
   * Thực thi luồng TRANG 2: Lập dàn ý
   * @param {string} articleId - ID bài viết
   * @param {string} customPrompt - Prompt người dùng tự điền (có thể null)
   */
  async execute(articleId, customPrompt = null) {
    const article = await Article.findById(articleId);
    if (!article) throw new Error(`Không tìm thấy bài viết ID: ${articleId}`);

    // [IDEMPOTENCY] Bỏ qua nếu đã tạo dàn ý rồi
    if (article.status !== ARTICLE_STATUS.QUEUED) {
      console.log(`⏩ [Idempotency] Bài viết [${article.keyword}] đã qua bước tạo dàn ý. Bỏ qua.`);
      return true;
    }

    console.log(`\n▶️ [Trang 2] Bắt đầu lập dàn ý cho: [${article.keyword}]`);
    const aiClient = aiFactory.createProvider('GEMINI');

    try {
      article.status = 'GENERATING_OUTLINE';
      await article.save();

      // Sử dụng Prompt tùy chỉnh nếu có, ngược lại dùng Prompt mặc định
      const prompt = customPrompt 
        ? `${customPrompt}\nTừ khóa chính: "${article.keyword}"`
        : `Lập dàn ý chi tiết (chỉ bao gồm các thẻ H1, H2, H3) cho bài viết SEO với từ khóa: "${article.keyword}". Chỉ trả về dàn ý, không giải thích dài dòng.`;

      const outlineText = await aiClient.generateText(prompt);

      // Ghi dàn ý vào file Docs
      await googleFacade.appendContentToDoc(article.docId, "=== DÀN Ý BÀI VIẾT ===\n" + outlineText);

      // Cập nhật trạng thái chờ Trang 3 xử lý
      article.status = 'OUTLINE_COMPLETED';
      article.executionLog.push({ step: 'GENERATE_OUTLINE', status: 'SUCCESS', message: 'Tạo dàn ý thành công' });
      await article.save();

      console.log(`✅ [Trang 2] Đã tạo xong dàn ý cho: [${article.keyword}]`);
      return true;

    } catch (error) {
      article.status = ARTICLE_STATUS.FAILED;
      await article.save();
      throw error;
    }
  }
}

module.exports = new GenerateOutlineUseCase();