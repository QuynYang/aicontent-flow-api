const EventBus = require('../../domain/events/EventBus');

class EventSubscribers {
  static initialize() {
    console.log('🎧 [EventSubscribers] Đã tắt chế độ chạy chuyền tay. Chuyển sang chế độ đợi lệnh từ Trang UI.');

    // Chỉ in ra Log để theo dõi, KHÔNG tự động đẩy vào Queue nữa!
    // Việc đẩy vào Queue bây giờ sẽ do Frontend gọi API (Trang 2, Trang 3) quyết định.

    EventBus.on('WORKSPACE_INITIALIZED', ({ campaignId }) => {
      console.log(`\n🔔 [Event] Campaign ${campaignId} đã khởi tạo xong! Đang chờ người dùng bấm chạy Trang 2...`);
    });

    EventBus.on('OUTLINE_GENERATED', ({ articleId }) => {
      console.log(`\n🔔 [Event] Bài viết ${articleId} đã có Dàn Ý! Đang chờ người dùng kiểm tra hoặc bấm chạy Trang 3...`);
    });

    EventBus.on('CONTENT_GENERATED', ({ articleId }) => {
      console.log(`\n🔔 [Event] Bài viết ${articleId} đã viết xong Nội Dung! Đang chờ chấm điểm SEO...`);
    });

    EventBus.on('SEO_FAILED', ({ articleId }) => {
      console.log(`\n🔔 [Event] Bài viết ${articleId} rớt điểm SEO. Đang chờ đưa vào luồng Auto-Fix...`);
    });
  }
}

module.exports = EventSubscribers;