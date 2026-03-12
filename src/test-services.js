require('dotenv').config();
const AIProviderFactory = require('./infrastructure/services/ai/AIProviderFactory');
const googleWorkspaceFacade = require('./infrastructure/services/google/GoogleWorkspaceFacade');
const puppeteerManager = require('./infrastructure/services/spineditor/PuppeteerBrowserManager');

async function runTest() {
  console.log('=== 🚀 BẮT ĐẦU TEST DỊCH VỤ ===\n');

  // ---------------------------------------------------------
  // 1. TEST GEMINI API (MẪU FACTORY)
  // ---------------------------------------------------------
  try {
    console.log('>> 1. Đang test Gemini API...');
    const aiClient = AIProviderFactory.createProvider('GEMINI');
    const prompt = 'Viết một đoạn văn ngắn 3 câu giới thiệu về lợi ích của Clean Architecture trong Node.js.';
    
    const aiResult = await aiClient.generateText(prompt);
    console.log('✅ [Kết quả Gemini]:\n', aiResult);
  } catch (error) {
    console.error('❌ [Lỗi Gemini]:', error.message);
  }

  console.log('\n---------------------------------------------------------\n');

  // ---------------------------------------------------------
  // 2. TEST GOOGLE WORKSPACE API (MẪU FACADE)
  // ---------------------------------------------------------
  try {
    console.log('>> 2. Đang test Google Workspace API...');
    
    // Đã chèn sẵn ID gốc của bạn vào đây
    const ROOT_FOLDER_ID = '1dOh7NLY3sc9A8FHDWLSgaPLohfvJ49iz'; 
    const campaignName = 'Test Campaign Đồ Án 2026';
    const keywords = ['Từ khóa test 1', 'Từ khóa test 2'];
    
    // Gọi Facade khởi tạo Workspace
    const googleResult = await googleWorkspaceFacade.initializeContentWorkspace(campaignName, keywords, ROOT_FOLDER_ID);
    
    console.log('✅ [Kết quả Google Workspace]: Toàn bộ thông tin trả về:');
    console.log(JSON.stringify(googleResult, null, 2));
    console.log('\n👉 Bạn hãy lên Google Drive kiểm tra xem thư mục và file đã được tạo chưa nhé!');
    
  } catch (error) {
    console.error('❌ [Lỗi Google Workspace]:', error.message);
  }

  console.log('\n---------------------------------------------------------\n');

  // ---------------------------------------------------------
  // 3. TEST SPINEDITOR & PUPPETEER (MẪU SINGLETON)
  // ---------------------------------------------------------
  try {
    console.log('>> 3. Đang test Spineditor Client (Puppeteer)...');
    
    // Mở thử trình duyệt lên xem Singleton hoạt động không
    const browser = await puppeteerManager.getBrowser();
    const pages = await browser.pages();
    console.log(`✅ [Puppeteer]: Trình duyệt đã khởi tạo ngầm thành công với ${pages.length} tab mặc định.`);
    
    // Đóng dọn dẹp để giải phóng RAM
    await puppeteerManager.closeBrowser();
    console.log('✅ [Puppeteer]: Đã dọn dẹp và đóng trình duyệt an toàn.');

  } catch (error) {
    console.error('❌ [Lỗi Spineditor/Puppeteer]:', error.message);
  }

  console.log('\n=== 🏁 KẾT THÚC TEST ===');
  // Node.js sẽ tự đóng sau vài giây khi các task ngầm hoàn tất
}

runTest();