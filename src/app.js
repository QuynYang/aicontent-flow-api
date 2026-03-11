const express = require('express');
const dotenv = require('dotenv');
const dbPool = require('./infrastructure/database/DatabaseConnectionPool');
const errorHandler = require('./interfaces/http/middlewares/ErrorHandler'); 
const { NotFoundError } = require('./shared/errors/CustomErrors');

// Load biến môi trường
dotenv.config();

const app = express();
app.use(express.json());

// Test Route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'AICONTENT-FLOW Core API is running!' });
});

// Bắt lỗi cho các route không tồn tại (Chuẩn Express 5)
app.use((req, res, next) => {
  next(new NotFoundError(`Không tìm thấy endpoint ${req.originalUrl} trên máy chủ!`));
});
// MIDDLEWARE XỬ LÝ LỖI TOÀN CỤC (Phải nằm ở cuối cùng)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Hàm khởi động Server
async function bootstrap() {
  try {
    // Bắt buộc khởi tạo DB xong mới mở cổng cho API nhận Request
    await dbPool.connect();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });

    // Graceful Shutdown - Bắt tín hiệu tắt máy
    process.on('SIGINT', async () => {
      console.log('\n⏳ Đang tắt hệ thống an toàn (Graceful Shutdown)...');
      server.close();
      await dbPool.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Khởi động server thất bại:', error);
    process.exit(1);
  }
}

// Chạy hệ thống
bootstrap();