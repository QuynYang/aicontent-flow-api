const QueueManager = require('../../../infrastructure/messaging/bullmq/QueueManager');
const Campaign = require('../../../infrastructure/database/mongoose/CampaignSchema');
const Article = require('../../../infrastructure/database/mongoose/ArticleSchema');

class CampaignController {
  
  /**
   * [TRANG 1] Khởi tạo Drive, Docs và ghi link lên Sheet
   * POST /api/campaigns/init
   */
  async initCampaign(req, res, next) {
    try {
      // Đã bổ sung các tham số dòng, cột từ yêu cầu của bạn
      const { campaignName, sheetId, rootFolderId, startRow, readColumn, writeColumnStart, writeColumnEnd } = req.body;

      if (!campaignName || !sheetId || !rootFolderId) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc!' });
      }

      const job = await QueueManager.initWorkspaceQueue.add('init', { 
        campaignName, sheetId, rootFolderId, startRow, readColumn, writeColumnStart, writeColumnEnd 
      });

      res.status(202).json({ message: 'Đã đưa lệnh Khởi tạo vào hàng đợi xử lý ngầm.', jobId: job.id });
    } catch (error) { next(error); }
  }

  /**
   * [TRANG 2] Lập dàn ý hàng loạt (Có tuỳ chọn Prompt)
   * POST /api/campaigns/outline
   */
  async generateOutline(req, res, next) {
    try {
      const { campaignId, customPrompt } = req.body;

      // Tìm tất cả bài viết của chiến dịch này đang ở trạng thái QUEUED (vừa qua Trang 1)
      const articles = await Article.find({ campaignId: campaignId, status: 'QUEUED' });
      
      if (articles.length === 0) {
        return res.status(400).json({ error: 'Không có bài viết nào sẵn sàng để tạo dàn ý.' });
      }

      // Ném tất cả vào Queue Outline
      for (const article of articles) {
        await QueueManager.generateOutlineQueue.add('outline', { articleId: article._id, customPrompt });
      }

      res.status(202).json({ message: `Đã đưa ${articles.length} bài viết vào hàng đợi tạo Dàn Ý.` });
    } catch (error) { next(error); }
  }

  /**
   * [TRANG 3] Viết bài chi tiết dựa trên Dàn Ý (Có tuỳ chọn Prompt)
   * POST /api/campaigns/detail
   */
  async generateDetail(req, res, next) {
    try {
      const { campaignId, customPrompt } = req.body;

      // Tìm bài viết đang ở trạng thái OUTLINE_COMPLETED (Đã xong Trang 2)
      const articles = await Article.find({ campaignId: campaignId, status: 'OUTLINE_COMPLETED' });
      
      if (articles.length === 0) {
        return res.status(400).json({ error: 'Không có bài viết nào đã hoàn thành dàn ý để viết chi tiết.' });
      }

      for (const article of articles) {
        await QueueManager.generateDetailQueue.add('detail', { articleId: article._id, customPrompt });
      }

      res.status(202).json({ message: `Đã đưa ${articles.length} bài viết vào hàng đợi Viết Nội Dung Chi Tiết.` });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/campaigns/:id/status
   */
  async getCampaignStatus(req, res, next) {
    try {
      const campaign = await Campaign.findById(req.params.id);
      const articles = await Article.find({ campaignId: req.params.id });
      res.status(200).json({ campaign, articles });
    } catch (error) { next(error); }
  }
}

module.exports = new CampaignController();