const EventBus = require('../../domain/events/EventBus');
const QueueManager = require('../../infrastructure/messaging/bullmq/QueueManager');
const Article = require('../../infrastructure/database/mongoose/ArticleSchema');

class EventSubscribers {
  static initialize() {
    // 1. Lắng nghe sự kiện: Đã khởi tạo Workspace xong (Có danh sách bài viết)
    EventBus.on('WORKSPACE_INITIALIZED', async ({ campaignId }) => {
      console.log(`\n🔔 [Event] Bắt được sự kiện WORKSPACE_INITIALIZED cho Campaign: ${campaignId}`);
      
      // Tìm tất cả các bài viết thuộc chiến dịch này đang ở trạng thái QUEUED
      const articles = await Article.find({ campaignId: campaignId, status: 'QUEUED' });
      
      // Ném từng bài vào Queue để AI viết bài
      for (const article of articles) {
        await QueueManager.generateContentQueue.add('generate-content', { articleId: article._id });
        console.log(`📥 [Queue] Đã đẩy bài viết [${article.keyword}] vào hàng đợi Viết AI.`);
      }
    });

    // 2. Lắng nghe sự kiện: AI đã viết bài xong -> Ném sang hàng đợi Chấm điểm SEO
    EventBus.on('CONTENT_GENERATED', async ({ articleId }) => {
      console.log(`\n🔔 [Event] Bắt được sự kiện CONTENT_GENERATED cho Article: ${articleId}`);
      await QueueManager.checkSeoQueue.add('check-seo', { articleId });
      console.log(`📥 [Queue] Đã đẩy bài viết vào hàng đợi Chấm SEO.`);
    });

    // 3. Lắng nghe sự kiện: Chấm SEO phát hiện lỗi -> Ném sang hàng đợi Tự sửa lỗi (Auto Fix)
    EventBus.on('SEO_FAILED', async ({ articleId }) => {
      console.log(`\n🔔 [Event] Bắt được sự kiện SEO_FAILED. Đưa vào luồng cấp cứu...`);
      await QueueManager.autoFixQueue.add('auto-fix', { articleId });
    });

    console.log('🎧 [EventSubscribers] Đã bật tai nghe, sẵn sàng bắt sự kiện.');
  }
}

module.exports = EventSubscribers;