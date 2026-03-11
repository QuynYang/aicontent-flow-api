const mongoose = require('mongoose');
const { Schema } = mongoose;
const ARTICLE_STATUS = require('../../../shared/constants/ArticleStatus');

const ArticleSchema = new Schema({
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  keyword: { type: String, required: true },
  
  // Dữ liệu Google Workspace
  driveFolderId: { type: String }, 
  docId: { type: String },
  docUrl: { type: String },
  
  // State Machine 
  status: {
    type: String,
    enum: Object.values(ARTICLE_STATUS),
    default: ARTICLE_STATUS.PENDING,
    index: true
  },
  
  // Kết quả đánh giá chất lượng
  qualityMetrics: {
    seoScore: { type: Number, default: 0 },
    seoErrors: [{ type: String }], 
    plagiarismScore: { type: Number, default: 0 }, 
    plagiarizedSentences: [{ type: String }] 
  },
  
  // Quản lý tự sửa lỗi
  retryCount: { type: Number, default: 0 },
  
  // Dấu vết xử lý (Audit Log)
  executionLog: [{
    step: { type: String },
    status: { type: String, enum: ['SUCCESS', 'ERROR', 'RETRYING', 'INFO'] },
    message: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  
  errorMessage: { type: String }
}, { timestamps: true });

ArticleSchema.index({ campaignId: 1, status: 1 });

module.exports = mongoose.model('Article', ArticleSchema);