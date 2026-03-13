const { Worker } = require('bullmq');
const EventBus = require('../../../domain/events/EventBus');
const QueueNames = require('../../../shared/constants/QueueNames');

// Nhúng các Use Cases (Đã chẻ luồng Outline và Detail)
const initWorkspaceUseCase = require('../../../application/use-cases/InitWorkspaceUseCase');
const generateOutlineUseCase = require('../../../application/use-cases/GenerateOutlineUseCase');
const generateDetailUseCase = require('../../../application/use-cases/GenerateDetailUseCase');
// const autoFixUseCase = require('../../../application/use-cases/AutoFixUseCase'); // Tạm comment nếu chưa ráp Trang 4

const redisConnection = { 
  host: process.env.REDIS_HOST || '127.0.0.1', 
  port: process.env.REDIS_PORT || 6379, 
  maxRetriesPerRequest: null 
};

class WorkerManager {
  constructor() {
    this.workers = []; // Khay chứa danh sách công nhân để dễ dàng gọi đóng cửa (Graceful Shutdown)
  }

  startAllWorkers() {
    console.log('👷 [WorkerManager] Đang tuyển dụng công nhân cho các dây chuyền...');

    // --- WORKER 1: Khởi tạo Workspace & Ghi link Excel (Trang 1) ---
    const initWorker = new Worker(QueueNames.INIT_WORKSPACE, async (job) => {
      // Truyền toàn bộ dữ liệu từ Controller (bao gồm startRow, readColumn...) vào UseCase
      return await initWorkspaceUseCase.execute(job.data);
    }, { connection: redisConnection, concurrency: 1 });

    initWorker.on('completed', (job, returnvalue) => {
      EventBus.emit('WORKSPACE_INITIALIZED', { campaignId: returnvalue.campaignId });
    });


    // --- WORKER 2: Viết Dàn Ý / Outline (Trang 2) ---
    const outlineWorker = new Worker(QueueNames.GENERATE_OUTLINE, async (job) => {
      // Truyền ID bài viết và Prompt tùy chỉnh (nếu có) vào UseCase
      return await generateOutlineUseCase.execute(job.data.articleId, job.data.customPrompt);
    }, { connection: redisConnection, concurrency: 3 });

    outlineWorker.on('completed', (job) => {
      EventBus.emit('OUTLINE_GENERATED', { articleId: job.data.articleId });
    });


    // --- WORKER 3: Viết Bài Chi Tiết / Detail Content (Trang 3) ---
    const detailWorker = new Worker(QueueNames.GENERATE_DETAIL, async (job) => {
      // Truyền ID bài viết và Prompt tùy chỉnh (nếu có) vào UseCase
      return await generateDetailUseCase.execute(job.data.articleId, job.data.customPrompt);
    }, { connection: redisConnection, concurrency: 3 });

    detailWorker.on('completed', (job) => {
      EventBus.emit('CONTENT_GENERATED', { articleId: job.data.articleId });
    });


    // Đưa các worker vào mảng quản lý
    this.workers.push(initWorker, outlineWorker, detailWorker);
    
    // Bắt lỗi chung cho các worker
    this.workers.forEach(worker => {
      worker.on('failed', (job, err) => {
        console.error(`❌ [Worker Error] Job ${job.id} trong ${worker.name} thất bại:`, err.message);
      });
    });

    console.log('🏭 [WorkerManager] Dây chuyền Trang 1, 2, 3 đã đi vào hoạt động!');
  }

  /**
   * Tạm dừng nhận việc mới, chờ các việc đang làm dở hoàn thành rồi mới tắt server
   */
  async gracefulShutdown() {
    console.log('\n🛑 [WorkerManager] Đã nhận lệnh dừng. Đang chờ công nhân làm nốt việc dở dang...');
    await Promise.all(this.workers.map(worker => worker.close()));
    console.log('✅ [WorkerManager] Toàn bộ công nhân đã nghỉ việc an toàn. Không có dữ liệu nào bị hỏng.');
  }
}

module.exports = new WorkerManager();