/**
 * Liệt kê toàn bộ vòng đời của một bài viết trong hệ thống aicontent-flow.
 * Sử dụng Object.freeze để tạo Enum bất biến.
 */
const ARTICLE_STATUS = Object.freeze({
  PENDING: 'PENDING',                     // Mới khởi tạo, chờ đưa vào Queue
  QUEUED: 'QUEUED',                       // Đã nằm trong hàng đợi BullMQ
  CREATING_WORKSPACE: 'CREATING_WORKSPACE', // Đang tạo Google Docs/Drive
  GENERATING_OUTLINE: 'GENERATING_OUTLINE', // Đang gọi AI lập dàn ý
  GENERATING_CONTENT: 'GENERATING_CONTENT', // Đang gọi AI viết bài chi tiết
  CHECKING_SEO: 'CHECKING_SEO',             // Đang dùng regex/parser chấm điểm SEO
  FIXING_SEO: 'FIXING_SEO',                 // AI đang tự sửa lỗi SEO
  CHECKING_PLAGIARISM: 'CHECKING_PLAGIARISM', // Puppeteer đang check trên Spineditor
  FIXING_PLAGIARISM: 'FIXING_PLAGIARISM',     // AI đang tự viết lại các câu đạo văn
  COMPLETED: 'COMPLETED',                 // Hoàn thành xuất sắc 100%
  FAILED: 'FAILED'                        // Lỗi chí mạng (hết lượt retry, rớt mạng...)
});

module.exports = ARTICLE_STATUS;