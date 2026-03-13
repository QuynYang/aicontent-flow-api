/**
 * Chứa định nghĩa tên của toàn bộ hàng đợi trong hệ thống.
 * Chống việc gõ sai chính tả chuỗi string ở nhiều file khác nhau.
 */
module.exports = {
  INIT_WORKSPACE: 'init-workspace-queue',
  GENERATE_OUTLINE: 'generate-outline-queue',  // Dành cho Trang 2
  GENERATE_DETAIL: 'generate-detail-queue',    // Dành cho Trang 3
  CHECK_SEO: 'check-seo-queue',                // Dành cho Trang 4
  AUTO_FIX: 'auto-fix-queue'
};