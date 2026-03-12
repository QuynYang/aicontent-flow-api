const ISeoStrategy = require('../../domain/interfaces/ISeoStrategy');

class StandardSeoStrategy extends ISeoStrategy {
  evaluate(content, keyword, config) {
    const errors = [];
    let score = 100;
    const normalizedContent = content.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();

    // 1. Kiểm tra số lượng từ (Word Count)
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const minWords = config.minWords || 800; // Mặc định 800 từ nếu không truyền
    if (wordCount < minWords) {
      errors.push(`Bài viết quá ngắn (${wordCount} từ). Yêu cầu tối thiểu ${minWords} từ.`);
      score -= 30;
    }

    // 2. Kiểm tra từ khóa trong Sapo (100 từ đầu tiên)
    const first100Words = content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
    if (config.requireSapoKeyword !== false && !first100Words.includes(normalizedKeyword)) {
      errors.push(`Đoạn mở bài (Sapo) không chứa từ khóa chính "${keyword}".`);
      score -= 20;
    }

    // 3. Kiểm tra cấu trúc thẻ Heading (dựa trên thẻ của Markdown)
    if (config.requireH2 !== false && !content.includes('## ')) {
      errors.push('Bài viết thiếu thẻ H2 (##). Cấu trúc đang bị phẳng.');
      score -= 15;
    }
    if (config.requireH3 !== false && !content.includes('### ')) {
      errors.push('Bài viết thiếu thẻ H3 (###). Cần chia nhỏ nội dung chi tiết hơn.');
      score -= 10;
    }

    // 4. Mật độ từ khóa (Keyword density)
    const keywordRegex = new RegExp(normalizedKeyword, 'g');
    const keywordMatches = normalizedContent.match(keywordRegex);
    const keywordCount = keywordMatches ? keywordMatches.length : 0;
    
    if (keywordCount === 0) {
      errors.push(`Từ khóa "${keyword}" hoàn toàn biến mất khỏi bài viết!`);
      score -= 50;
    } else if (keywordCount > (wordCount / 50)) { 
      // Mật độ > 2% thường bị Google đánh gậy Spam (Keyword Stuffing)
      errors.push(`Nhồi nhét từ khóa quá mức. Vui lòng giảm bớt tần suất xuất hiện của từ "${keyword}".`);
      score -= 20;
    }

    return {
      isValid: errors.length === 0, // True nếu mảng lỗi trống rỗng
      score: Math.max(0, score),    // Không để điểm âm
      errors: errors
    };
  }
}

module.exports = StandardSeoStrategy;