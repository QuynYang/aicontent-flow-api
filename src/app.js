const express = require('express');
const http = require('http'); 
const dotenv = require('dotenv');
const dbPool = require('./infrastructure/database/DatabaseConnectionPool');
const errorHandler = require('./interfaces/http/middlewares/ErrorHandler'); 
const { NotFoundError } = require('./shared/errors/CustomErrors');
const EventSubscribers = require('./application/events/EventSubscribers');
const WorkerManager = require('./infrastructure/messaging/bullmq/WorkerManager');

// Import Routes và Socket
const campaignRoutes = require('./interfaces/http/routes/CampaignRoutes');
// SỬA LẠI ĐƯỜNG DẪN CHUẨN (Có dấu ./ ở đầu và bỏ src đi)
const uiUpdateSocket = require('./interfaces/websockets/UIUpdateSocket');

dotenv.config();

const app = express();
app.use(express.json());

// Gắn các API Routes
app.use('/api/campaigns', campaignRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AICONTENT-FLOW Core API is running!' });
});

app.use((req, res, next) => {
  next(new NotFoundError(`Không tìm thấy endpoint ${req.originalUrl} trên máy chủ!`));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Nâng cấp app Express thành HTTP Server để gắn được Socket.io
const server = http.createServer(app);

async function bootstrap() {
  try {
    await dbPool.connect();

    EventSubscribers.initialize();
    WorkerManager.startAllWorkers();

    // Khởi tạo trạm phát sóng WebSocket
    uiUpdateSocket.initialize(server);

    // Lưu ý: Bây giờ dùng server.listen thay vì app.listen
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

    process.on('SIGINT', async () => {
      console.log('\n⏳ Đang tắt hệ thống an toàn (Graceful Shutdown)...');
      
      // 1. Tắt nhận request mới từ API
      server.close();
      
      // 2. Chờ Worker làm nốt việc đang dở rồi mới đóng
      await WorkerManager.gracefulShutdown(); 
      
      // 3. Cuối cùng mới ngắt kết nối Database
      await dbPool.disconnect();
      
      console.log('👋 Hệ thống đã tắt hoàn toàn.');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Khởi động server thất bại:', error);
    process.exit(1);
  }
}

bootstrap();