const mongoose = require('mongoose');
const Redis = require('ioredis');

class DatabaseConnectionPool {
  constructor() {
    // Implement Singleton Pattern
    if (DatabaseConnectionPool.instance) {
      return DatabaseConnectionPool.instance;
    }

    this.mongoConnection = null;
    this.redisClient = null;
    DatabaseConnectionPool.instance = this;
  }

  /**
   * Khởi tạo đồng thời kết nối MongoDB và Redis
   */
  async connect() {
    try {
      await Promise.all([this._connectMongo(), this._connectRedis()]);
      console.log('✅ [Database] Toàn bộ cơ sở dữ liệu đã kết nối thành công.');
    } catch (error) {
      console.error('❌ [Database] Lỗi khởi tạo kết nối database:', error.message);
      process.exit(1); // Dừng server ngay lập tức nếu không có DB
    }
  }

  /**
   * Kết nối MongoDB (Lưu trữ trạng thái vĩnh viễn)
   */
  async _connectMongo() {
    if (this.mongoConnection) return;

    const mongoUri = process.env.MONGO_URI;
    
    // Bắt các sự kiện rớt mạng và kết nối lại của Mongoose
    mongoose.connection.on('connected', () => console.log('🍃 [MongoDB] Connected!'));
    mongoose.connection.on('error', (err) => console.error('🍃 [MongoDB] Error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('🍃 [MongoDB] Disconnected. Đang thử lại...'));

    this.mongoConnection = await mongoose.connect(mongoUri, {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10), // Giới hạn số lượng connection
      serverSelectionTimeoutMS: 5000, // Thử kết nối trong 5s, không được thì báo lỗi
    });
  }

  /**
   * Kết nối Redis (Dùng cho Hàng đợi Queue và Caching)
   */
  async _connectRedis() {
    if (this.redisClient) return;

    return new Promise((resolve, reject) => {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        // Cấu hình chiến lược tự động kết nối lại cực kỳ quan trọng cho Worker
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          console.warn(`🔥 [Redis] Mất kết nối. Đang thử lại lần ${times} sau ${delay}ms...`);
          return delay;
        },
      });

      this.redisClient.on('connect', () => {
        console.log('🔥 [Redis] Connected!');
        resolve();
      });

      this.redisClient.on('error', (err) => {
        // Chỉ reject trong lần gọi đầu tiên nếu sai thông tin, các lần sau retryStrategy sẽ lo
        if (!this.redisClient.status || this.redisClient.status === 'wait') {
           reject(err);
        }
      });
    });
  }

  /**
   * Lấy instance của Redis để truyền vào BullMQ
   */
  getRedisClient() {
    if (!this.redisClient) throw new Error('Redis chưa được khởi tạo!');
    return this.redisClient;
  }

  /**
   * Đóng kết nối an toàn (Dùng khi tắt Server)
   */
  async disconnect() {
    if (this.mongoConnection) await mongoose.connection.close();
    if (this.redisClient) this.redisClient.quit();
    console.log('🛑 [Database] Đã ngắt kết nối an toàn.');
  }
}

// Export một instance duy nhất (Singleton)
module.exports = new DatabaseConnectionPool();