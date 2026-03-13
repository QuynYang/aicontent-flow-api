const EventEmitter = require('events');

/**
 * Singleton EventBus: Trung tâm trung chuyển sự kiện.
 * Giúp các module hoàn toàn độc lập (Decoupling) với nhau.
 */
class EventBus extends EventEmitter {}

module.exports = new EventBus();