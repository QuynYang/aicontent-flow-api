const { google } = require('googleapis');
const express = require('express');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(process.cwd(), 'oauth-credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

async function runAuthFlow() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Không tìm thấy file oauth-credentials.json ở thư mục gốc!');
    return;
  }

  // Đọc file Client ID
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Tạo URL xin cấp quyền
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Bắt buộc để lấy được Refresh Token chạy ngầm
    scope: ['https://www.googleapis.com/auth/drive'],
    prompt: 'consent'
  });

  console.log('\n======================================================');
  console.log('🔗 HÃY CLICK VÀO ĐƯỜNG LINK BÊN DƯỚI ĐỂ ĐĂNG NHẬP GMAIL:');
  console.log(authUrl);
  console.log('======================================================\n');

  // Khởi tạo một server tạm thời ở cổng 3001 để hứng mã code trả về
  const app = express();
  const server = app.listen(3001, () => {
    console.log('⏳ Đang chờ bạn xác nhận trên trình duyệt...');
  });

  app.get('/oauthcallback', async (req, res) => {
    const code = req.query.code;
    if (code) {
      try {
        // Đổi mã code lấy Token
        const { tokens } = await oAuth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        
        res.send('<h1>✅ Xác thực thành công!</h1><p>Bạn có thể đóng tab này và quay lại VS Code.</p>');
        console.log('\n🎉 THÀNH CÔNG! Đã tạo file token.json ở thư mục gốc.');
        console.log('Khóa xác thực này sẽ được hệ thống dùng vĩnh viễn.');
        
        server.close(); // Đóng server tạm
        process.exit(0);
      } catch (err) {
        res.send('<h1>❌ Lỗi xác thực</h1>');
        console.error('Lỗi khi lấy token:', err);
      }
    }
  });
}

runAuthFlow();