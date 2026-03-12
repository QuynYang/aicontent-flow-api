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

    // Bật dịch vụ Drive, Docs và Sheets với quyền của chính bạn
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.docs = google.docs({ version: 'v1', auth: this.auth });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
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

  /**
   * Đọc danh sách từ khóa từ một file Google Sheet
   * Giả định các từ khóa nằm ở Cột A, từ dòng 2 trở đi (Sheet1!A2:A)
   */
  async readKeywordsFromSheet(sheetId, range = 'Sheet1!A2:A') {
    try {
      console.log(`📊 [Google Sheets] Đang đọc dữ liệu từ Sheet ID: ${sheetId}...`);
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range,
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) return [];
      
      // Lấy phần tử đầu tiên của mỗi mảng (Cột A) và lọc bỏ các dòng trống
      return rows.map(row => row[0]).filter(Boolean); 
    } catch (error) {
      throw new ExternalAPIError('Google Sheets', `Lỗi đọc Sheet: ${error.message}`);
    }
  }

  /**
   * Ghi nối (append) văn bản vào một file Google Docs có sẵn
   */
  async appendContentToDoc(docId, text) {
    try {
      console.log(`✍️ [Google Docs] Đang ghi văn bản vào tài liệu ID: ${docId}...`);
      await this.docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 }, // Ghi chèn lên đầu trang
                text: text + '\n\n'
              }
            }
          ]
        }
      });
      console.log(`✅ [Google Docs] Đã ghi thành công.`);
    } catch (error) {
      throw new ExternalAPIError('Google Docs', `Lỗi ghi nội dung: ${error.message}`);
    }
  }
}

// Bọc Singleton để toàn hệ thống chỉ xài chung 1 instance kết nối Google API
module.exports = new GoogleWorkspaceFacade();