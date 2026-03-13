const Article = require('../../infrastructure/database/mongoose/ArticleSchema');
const aiFactory = require('../../infrastructure/services/ai/AIProviderFactory');
const googleFacade = require('../../infrastructure/services/google/GoogleWorkspaceFacade');
const ARTICLE_STATUS = require('../../shared/constants/ArticleStatus');

class GenerateDetailUseCase {
  /**
   * Thực thi luồng TRANG 3: Viết bài chi tiết từ dàn ý có sẵn trong Docs
   */
  async execute(articleId, customPrompt = null) {
    const article = await Article.findById(articleId);
    if (!article) throw new Error(`Không tìm thấy bài viết ID: ${articleId}`);

    // [IDEMPOTENCY] Bỏ qua nếu đã viết bài chi tiết rồi
    if (article.status !== 'OUTLINE_COMPLETED') {
      console.log(`⏩ [Idempotency] Bài viết [${article.keyword}] không ở trạng thái chờ viết bài. Bỏ qua.`);
      return true;
    }

    console.log(`\n▶️ [Trang 3] Bắt đầu viết nội dung chi tiết cho: [${article.keyword}]`);
    const aiClient = aiFactory.createProvider('GEMINI');

    try {
      article.status = 'GENERATING_CONTENT';
      await article.save();

      // 1. ĐỌC DÀN Ý TRỰC TIẾP TỪ GOOGLE DOCS (Rất quan trọng)
      const existingOutline = await googleFacade.readDocContent(article.docId);

      // 2. Lắp ráp Prompt để viết bài
      const prompt = customPrompt
        ? `${customPrompt}\n\nDựa vào dàn ý dưới đây, hãy viết nội dung chi tiết:\n\n${existingOutline}`
        : `Hãy đóng vai một chuyên gia SEO. Dựa vào dàn ý chi tiết sau đây, hãy viết một bài viết hoàn chỉnh, sâu sắc và giữ nguyên cấu trúc các thẻ H2, H3. \nDàn ý:\n${existingOutline}`;

      const contentText = await aiClient.generateText(prompt);

      // 3. Ghi đè hoặc nối tiếp nội dung vào Docs
      await googleFacade.appendContentToDoc(article.docId, "\n\n=== NỘI DUNG CHI TIẾT ===\n" + contentText);

      // 4. Hoàn tất Trang 3, đẩy trạng thái để chờ Trang 4 (Check SEO)
      article.status = 'CONTENT_COMPLETED'; 
      article.executionLog.push({ step: 'GENERATE_DETAIL', status: 'SUCCESS', message: 'Viết nội dung thành công' });
      await article.save();

      console.log(`✅ [Trang 3] Đã viết xong bài chi tiết cho: [${article.keyword}]`);
      return true;

    } catch (error) {
      article.status = ARTICLE_STATUS.FAILED;
      await article.save();
      throw error;
    }
  }
}

module.exports = new GenerateDetailUseCase();