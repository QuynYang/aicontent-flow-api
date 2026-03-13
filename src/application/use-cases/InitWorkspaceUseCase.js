const Campaign = require('../../infrastructure/database/mongoose/CampaignSchema');
const Article = require('../../infrastructure/database/mongoose/ArticleSchema');
const googleFacade = require('../../infrastructure/services/google/GoogleWorkspaceFacade');
const ARTICLE_STATUS = require('../../shared/constants/ArticleStatus');

class InitWorkspaceUseCase {
  /**
   * Thực thi luồng khởi tạo không gian làm việc (TRANG 1)
   * @param {Object} params - Gồm: campaignName, sheetId, rootFolderId, startRow, readColumn, writeColumnStart
   */
  async execute({ campaignName, sheetId, rootFolderId, startRow = 2, readColumn = 'A', writeColumnStart = 'B', writeColumnEnd = 'C' }) {
    console.log(`\n▶️ [Trang 1] Bắt đầu khởi tạo dữ liệu từ Sheet ID: ${sheetId}`);

    // 1. Lưu Campaign (Chiến dịch) để quản lý
    const campaign = await Campaign.create({
      name: campaignName,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      status: 'INITIALIZING'
    });

    // 2. Tính toán vùng đọc (VD: 'Sheet1!A2:A') và đọc từ khóa
    const readRange = `Sheet1!${readColumn}${startRow}:${readColumn}`;
    const keywords = await googleFacade.readKeywordsFromSheet(sheetId, readRange);
    
    if (keywords.length === 0) {
      campaign.status = 'FAILED';
      await campaign.save();
      throw new Error(`Không tìm thấy từ khóa nào ở cột ${readColumn}, bắt đầu từ dòng ${startRow}!`);
    }

    // 3. Gọi tay sai Google tạo hàng loạt Folder và Docs
    const workspaceData = await googleFacade.initializeContentWorkspace(campaignName, keywords, rootFolderId);

    // 4. CHUẨN BỊ DỮ LIỆU ĐỂ GHI NGƯỢC LẠI SHEET
    // Tạo mảng 2 chiều chứa link Drive và link Docs tương ứng với từng từ khóa
    const sheetUpdateValues = workspaceData.articles.map(item => [
      item.folderUrl, // Điền vào cột B
      item.docUrl     // Điền vào cột C
    ]);

    // Tính toán vùng ghi (VD: 'Sheet1!B2:C10')
    const endRow = startRow + keywords.length - 1;
    const writeRange = `Sheet1!${writeColumnStart}${startRow}:${writeColumnEnd}${endRow}`;
    
    // Gọi API ghi đè vào Sheet
    await googleFacade.writeDataToSheet(sheetId, writeRange, sheetUpdateValues);

    // 5. Lưu toàn bộ xuống Database để phục vụ cho Trang 2 (Tạo Outline)
    campaign.status = 'RUNNING'; // Đánh dấu hoàn tất pha khởi tạo
    await campaign.save();

    const articlesToInsert = workspaceData.articles.map(item => ({
      campaignId: campaign._id,
      keyword: item.keyword,
      driveFolderId: item.folderId, // Trỏ đúng ID thư mục riêng
      docId: item.docId,
      docUrl: item.docUrl,
      status: ARTICLE_STATUS.QUEUED, 
      executionLog: [{ step: 'INIT_WORKSPACE', status: 'SUCCESS', message: 'Tạo Folder/Docs và ghi link lên Sheet thành công' }]
    }));

    await Article.insertMany(articlesToInsert);
    console.log(`✅ [Trang 1] Hoàn tất! Đã cập nhật xong Sheet và lưu Database.`);

    return { 
      campaignId: campaign._id,
      articlesCreated: articlesToInsert.length,
      sheetUpdatedRange: writeRange
    };
  }
}

module.exports = new InitWorkspaceUseCase();