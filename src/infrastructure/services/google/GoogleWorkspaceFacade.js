const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { ExternalAPIError } = require('../../../shared/errors/CustomErrors');

class GoogleWorkspaceFacade {
  constructor() {
    const credentialsPath = path.join(process.cwd(), 'oauth-credentials.json');
    const tokenPath = path.join(process.cwd(), 'token.json');

    if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
      console.error('⚠️ [Google API] Thiếu file xác thực. Hãy chạy node src/auth-setup.js trước!');
      return;
    }

    // Đọc thông tin xác thực
    const credentials = JSON.parse(fs.readFileSync(credentialsPath));
    const { client_secret, client_id, redirect_uris } = credentials.web;
    
    // Khởi tạo OAuth2 Client
    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    
    // Nạp Token vào Client
    const token = JSON.parse(fs.readFileSync(tokenPath));
    this.auth.setCredentials(token);

    // Bật dịch vụ Drive với quyền của chính bạn
    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Tạo thư mục con trên Google Drive
   */
  async _createFolder(folderName, parentFolderId) {
    try {
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId] // Nằm trong thư mục gốc bạn đã share quyền
      };
      
      const folder = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, webViewLink'
      });
      return folder.data;
    } catch (error) {
      throw new ExternalAPIError('Google Drive', `Lỗi tạo thư mục: ${error.message}`);
    }
  }

  /**
   * Tạo file Google Docs mới TRỰC TIẾP trong một thư mục bằng Drive API
   */
  async _createDoc(title, folderId) {
    try {
      // Tuyệt chiêu: Khai báo mimeType là Google Docs để Drive API tự hiểu và tạo file Docs
      const doc = await this.drive.files.create({
        requestBody: { 
          name: title,
          mimeType: 'application/vnd.google-apps.document', // Định dạng Google Docs
          parents: [folderId] // Đặt trực tiếp vào thư mục cha, không cần move!
        },
        fields: 'id'
      });

      const docId = doc.data.id;

      return {
        docId: docId,
        docUrl: `https://docs.google.com/document/d/${docId}/edit`
      };
    } catch (error) {
      throw new ExternalAPIError('Google Workspace', `Lỗi tạo file doc: ${error.message}`);
    }
  }

  /**
   * HÀM MẶT TIỀN (FACADE METHOD): Được gọi bởi Use Case
   * Nhận danh sách từ khóa -> Tạo Folder cha -> Trả về danh sách Link Docs tương ứng
   * @param {string} campaignName - Tên chiến dịch (dùng làm tên Folder)
   * @param {Array<string>} keywords - Mảng các từ khóa (VD: ["Bàn phím cơ", "Chuột không dây"])
   * @param {string} rootFolderId - ID của thư mục gốc trên Drive
   * @returns {Promise<Object>} Thông tin Folder cha và danh sách bài viết
   */
  async initializeContentWorkspace(campaignName, keywords, rootFolderId) {
    console.log(`📁 [Workspace] Đang khởi tạo không gian làm việc cho: ${campaignName}`);
    
    // 1. Tạo thư mục chứa riêng cho Campaign này
    const campaignFolder = await this._createFolder(campaignName, rootFolderId);
    
    const results = [];

    // 2. Lặp qua từng từ khóa để tạo file Docs
    // Dùng for...of thay vì Promise.all để tránh bị Google API block do spam request quá nhanh
    for (const keyword of keywords) {
      console.log(`📄 [Workspace] Đang tạo file Docs cho từ khóa: ${keyword}`);
      const docInfo = await this._createDoc(`[SEO] ${keyword}`, campaignFolder.id);
      
      results.push({
        keyword: keyword,
        docId: docInfo.docId,
        docUrl: docInfo.docUrl
      });
    }

    console.log(`✅ [Workspace] Khởi tạo thành công ${keywords.length} files.`);

    return {
      campaignFolderId: campaignFolder.id,
      campaignFolderUrl: campaignFolder.webViewLink,
      articles: results
    };
  }
}

// Bọc Singleton để toàn hệ thống chỉ xài chung 1 instance kết nối Google API
module.exports = new GoogleWorkspaceFacade();