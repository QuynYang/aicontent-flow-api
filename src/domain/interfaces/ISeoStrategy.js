/**
 * Interface chuẩn mực cho mọi thuật toán chấm điểm SEO.
 * Tuân thủ nguyên tắc Open/Closed (O trong SOLID).
 */
class ISeoStrategy {
  /**
   * @param {string} content - Nội dung bài viết (dạng text hoặc Markdown)
   * @param {string} keyword - Từ khóa chính
   * @param {Object} config - Cấu hình chấm điểm (từ file Google Sheet hoặc DB)
   * @returns {Object} { isValid: boolean, score: number, errors: string[] }
   */
  evaluate(content, keyword, config) {
    throw new Error('Method evaluate() bắt buộc phải được implement ở lớp con');
  }
}

module.exports = ISeoStrategy;