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
   * HÀM MẶT TIỀN (FACADE METHOD): Được gọi bởi Use Case TRANG 1
   * Nhận danh sách từ khóa -> Tạo Folder RIÊNG cho từng từ khóa -> Tạo Docs bên trong
   */
  async initializeContentWorkspace(campaignName, keywords, rootFolderId) {
    console.log(`📁 [Workspace] Đang xử lý ${keywords.length} từ khóa...`);
    const results = [];

    // Lặp qua từng từ khóa để tạo Folder và Docs tương ứng
    for (const keyword of keywords) {
      console.log(`▶️ Đang tạo tài nguyên cho: [${keyword}]`);
      
      // 1. Tạo thư mục riêng mang tên từ khóa
      const keywordFolder = await this._createFolder(keyword, rootFolderId);
      
      // 2. Tạo file Docs nằm TRONG thư mục vừa tạo
      const docInfo = await this._createDoc(`${keyword}`, keywordFolder.id);
      
      results.push({
        keyword: keyword,
        folderId: keywordFolder.id,
        folderUrl: keywordFolder.webViewLink,
        docId: docInfo.docId,
        docUrl: docInfo.docUrl
      });
    }

    console.log(`✅ [Workspace] Khởi tạo thành công ${keywords.length} bộ thư mục & bài viết.`);
    
    return {
      articles: results
    };
  }

  /**
   * Đọc danh sách từ khóa từ một file Google Sheet
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
      
      // Lấy phần tử đầu tiên của mỗi mảng (Cột được chỉ định) và lọc bỏ các dòng trống
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

  /**
   * Ghi mảng dữ liệu ngược lại vào Google Sheet (Dùng cho Trang 1)
   * @param {string} sheetId - ID của file Google Sheet
   * @param {string} range - Vùng dữ liệu cần ghi (VD: 'Sheet1!B2:C10')
   * @param {Array<Array<string>>} values - Mảng 2 chiều chứa Link Drive và Link Docs
   */
  async writeDataToSheet(sheetId, range, values) {
    try {
      console.log(`📝 [Google Sheets] Đang ghi ${values.length} dòng dữ liệu vào dải ô ${range}...`);
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: range,
        valueInputOption: 'USER_ENTERED', // Để Google Sheet tự nhận diện dạng text thành link
        requestBody: {
          values: values
        }
      });
      console.log('✅ [Google Sheets] Đã ghi link thành công!');
      return response.data;
    } catch (error) {
      throw new ExternalAPIError('Google Sheets', `Lỗi ghi Sheet: ${error.message}`);
    }
  }

  /**
   * Đọc toàn bộ nội dung văn bản (Text) từ một file Google Docs
   * Dùng cho Trang 3: Đọc dàn ý để viết bài chi tiết
   */
  async readDocContent(docId) {
    try {
      console.log(`📖 [Google Docs] Đang đọc nội dung từ tài liệu ID: ${docId}...`);
      const doc = await this.docs.documents.get({ documentId: docId });
      
      let fullText = '';
      const content = doc.data.body.content;
      
      // Bóc tách text từ cấu trúc JSON phức tạp của Google Docs
      content.forEach(element => {
        if (element.paragraph) {
          element.paragraph.elements.forEach(elem => {
            if (elem.textRun) {
              fullText += elem.textRun.content;
            }
          });
        }
      });
      
      return fullText.trim();
    } catch (error) {
      throw new ExternalAPIError('Google Docs', `Lỗi đọc nội dung: ${error.message}`);
    }
  }
}

// Bọc Singleton để toàn hệ thống chỉ xài chung 1 instance kết nối Google API
module.exports = new GoogleWorkspaceFacade();