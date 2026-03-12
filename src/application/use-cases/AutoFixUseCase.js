const Article = require('../../infrastructure/database/mongoose/ArticleSchema');
const aiFactory = require('../../infrastructure/services/ai/AIProviderFactory');
const googleFacade = require('../../infrastructure/services/google/GoogleWorkspaceFacade');
const ARTICLE_STATUS = require('../../shared/constants/ArticleStatus');

class AutoFixUseCase {
  /**
   * Bắt AI viết lại nội dung bị lỗi (SEO hoặc Đạo văn)
   * @param {string} articleId - ID bài viết trong cơ sở dữ liệu
   */
  async execute(articleId) {
    const article = await Article.findById(articleId);
    if (!article) throw new Error(`Không tìm thấy bài viết ID: ${articleId}`);

    // Giới hạn số lần sửa lỗi (tránh việc AI sửa mãi không xong làm tốn tiền API)
    const MAX_RETRIES = 3;
    if (article.retryCount >= MAX_RETRIES) {
      article.status = ARTICLE_STATUS.FAILED;
      article.errorMessage = `Đã vượt quá ${MAX_RETRIES} lần tự động sửa lỗi nhưng vẫn không đạt tiêu chuẩn. Cần thao tác thủ công.`;
      await article.save();
      return false;
    }

    console.log(`\n▶️ [AutoFix] Bắt đầu sửa lỗi cho bài viết: [${article.keyword}] (Lần ${article.retryCount + 1}/${MAX_RETRIES})`);
    
    const aiClient = aiFactory.createProvider('GEMINI');
    let prompt = '';
    let fixType = '';

    // XÁC ĐỊNH LOẠI LỖI ĐỂ TẠO PROMPT "MẮNG" AI
    if (article.status === ARTICLE_STATUS.FIXING_SEO || article.qualityMetrics.seoErrors.length > 0) {
      fixType = 'SEO';
      article.status = ARTICLE_STATUS.FIXING_SEO;
      prompt = `Đóng vai Copywriter SEO. Bài viết về từ khóa "${article.keyword}" của bạn đang bị đánh rớt vì các lỗi sau:\n`;
      article.qualityMetrics.seoErrors.forEach(err => prompt += `- ${err}\n`);
      prompt += `\nHãy viết lại nội dung bổ sung để khắc phục HOÀN TOÀN các lỗi trên. Đảm bảo cấu trúc Markdown.`;
      
    } else if (article.status === ARTICLE_STATUS.FIXING_PLAGIARISM || article.qualityMetrics.plagiarizedSentences.length > 0) {
      fixType = 'PLAGIARISM';
      article.status = ARTICLE_STATUS.FIXING_PLAGIARISM;
      prompt = `Đóng vai Copywriter. Các câu sau trong bài viết "${article.keyword}" bị phát hiện copy 100% từ đối thủ. Hãy viết lại chúng sang cách diễn đạt hoàn toàn mới, đồng nghĩa nhưng từ vựng khác biệt:\n`;
      article.qualityMetrics.plagiarizedSentences.forEach((sentence, idx) => prompt += `${idx + 1}. ${sentence}\n`);
      
    } else {
      console.log(`✅ [AutoFix] Bài viết [${article.keyword}] không có lỗi nào cần sửa.`);
      return true;
    }

    await article.save();

    try {
      // 1. Đưa Prompt cho AI sửa sai
      const fixedContent = await aiClient.generateText(prompt);

      // 2. Ghi phần sửa lỗi vào Google Docs (Ghi nối tiếp vào tài liệu để người duyệt có thể so sánh)
      const updateText = `\n\n=== BẢN TỰ SỬA LỖI ${fixType} (LẦN ${article.retryCount + 1}) ===\n\n${fixedContent}`;
      await googleFacade.appendContentToDoc(article.docId, updateText);

      // 3. Cập nhật lại trạng thái bài viết
      article.retryCount += 1;
      
      // Chuyển status ngược lại để hệ thống (Queue) tự bốc đi chấm điểm lại từ đầu
      if (fixType === 'SEO') {
        article.status = ARTICLE_STATUS.CHECKING_SEO;
        article.qualityMetrics.seoErrors = []; // Xóa log lỗi cũ
      } else {
        article.status = ARTICLE_STATUS.CHECKING_PLAGIARISM;
        article.qualityMetrics.plagiarizedSentences = []; // Xóa log lỗi cũ
      }

      article.executionLog.push({
        step: `AUTO_FIX_${fixType}`,
        status: 'SUCCESS',
        message: `AI đã khắc phục lỗi và đẩy nội dung vào Docs (Lần ${article.retryCount})`
      });

      await article.save();
      console.log(`✅ [AutoFix] Đã sửa xong lỗi ${fixType}. Trạng thái quay về: ${article.status}`);
      return true;

    } catch (error) {
      article.executionLog.push({
        step: `AUTO_FIX_${fixType}`,
        status: 'ERROR',
        message: `Bị gián đoạn khi gọi AI sửa bài: ${error.message}`
      });
      await article.save();
      throw error;
    }
  }
}

module.exports = new AutoFixUseCase();