const mongoose = require('mongoose');
const { Schema } = mongoose;

const CampaignSchema = new Schema({
  name: { type: String, required: true },
  sheetUrl: { type: String, required: true },
  rootDriveFolderId: { type: String }, 
  rootDriveFolderUrl: { type: String },
  status: { 
    type: String, 
    enum: ['PENDING', 'INITIALIZING', 'RUNNING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  seoStrategyConfig: {
    strategyType: { type: String, enum: ['STANDARD_SEO', 'SOCIAL_MEDIA'], default: 'STANDARD_SEO' },
    minWords: { type: Number, default: 1000 },
    requireH1: { type: Boolean, default: true },
    requireSapoKeyword: { type: Boolean, default: true }
  },
  stats: {
    totalKeywords: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', CampaignSchema);