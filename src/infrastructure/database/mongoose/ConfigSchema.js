const mongoose = require('mongoose');
const { Schema } = mongoose;

const ConfigSchema = new Schema({
  apiKeys: {
    gemini: { type: String },
    poe: { type: String },
    twoCaptcha: { type: String }
  },
  aiProviderType: { type: String, enum: ['GEMINI', 'POE', 'CHATGPT'], default: 'GEMINI' },
  spineditorAccount: {
    username: { type: String },
    password: { type: String } 
  },
  googleServiceAccount: { type: Object }, 
  systemSettings: {
    maxAutoFixRetries: { type: Number, default: 3 },
    concurrencyWorkers: { type: Number, default: 5 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Config', ConfigSchema);