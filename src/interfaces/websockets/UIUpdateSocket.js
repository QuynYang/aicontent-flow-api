const socketIo = require('socket.io');
const EventBus = require('../../domain/events/EventBus');

class UIUpdateSocket {
  initialize(server) {
    // Gắn Socket.io vào HTTP Server của Express, cho phép mọi nguồn (CORS) kết nối tới
    this.io = socketIo(server, {
      cors: { origin: '*' }
    });

    this.io.on('connection', (socket) => {
      console.log(`🟢 [Socket.io] Giao diện Frontend đã kết nối (ID: ${socket.id})`);

      socket.on('disconnect', () => {
        console.log(`🔴 [Socket.io] Giao diện Frontend ngắt kết nối (ID: ${socket.id})`);
      });
    });

    // --- CẦU NỐI: EVENT BUS -> SOCKET.IO ---
    // Nghe thấy Worker báo cáo -> Bắn ngay về Frontend để nhấp nháy UI

    EventBus.on('WORKSPACE_INITIALIZED', (data) => {
      this.io.emit('campaign_update', { status: 'WORKSPACE_INITIALIZED', ...data });
    });

    EventBus.on('CONTENT_GENERATED', (data) => {
      this.io.emit('article_update', { status: 'CONTENT_GENERATED', ...data });
    });

    EventBus.on('SEO_FAILED', (data) => {
      this.io.emit('article_update', { status: 'SEO_FAILED', isError: true, ...data });
    });

    EventBus.on('SEO_PASSED', (data) => {
      this.io.emit('article_update', { status: 'SEO_PASSED', isSuccess: true, ...data });
    });

    console.log('📡 [Socket.io] Trạm phát sóng Real-time đã được lắp đặt thành công.');
  }
}

module.exports = new UIUpdateSocket();