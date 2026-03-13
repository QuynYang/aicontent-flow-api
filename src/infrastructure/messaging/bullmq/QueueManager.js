const { Queue } = require('bullmq');
const QueueNames = require('../../../shared/constants/QueueNames');

const redisConnection = { host: process.env.REDIS_HOST || '127.0.0.1', port: process.env.REDIS_PORT || 6379, maxRetriesPerRequest: null };

class QueueManager {
  constructor() {
    this.initWorkspaceQueue = new Queue(QueueNames.INIT_WORKSPACE, { connection: redisConnection });
    
    // Thêm 2 hàng đợi mới cho Trang 2 và Trang 3
    this.generateOutlineQueue = new Queue(QueueNames.GENERATE_OUTLINE, { connection: redisConnection });
    this.generateDetailQueue = new Queue(QueueNames.GENERATE_DETAIL, { connection: redisConnection });
    
    this.checkSeoQueue = new Queue(QueueNames.CHECK_SEO, { connection: redisConnection });
    this.autoFixQueue = new Queue(QueueNames.AUTO_FIX, { connection: redisConnection });
    
    console.log('📦 [QueueManager] Đã khởi tạo các hàng đợi riêng biệt cho từng Trang.');
  }
}
module.exports = new QueueManager();