require('dotenv').config();
const mongoose = require('mongoose');
const dbPool = require('./infrastructure/database/DatabaseConnectionPool');
const Article = require('./infrastructure/database/mongoose/ArticleSchema');
const Campaign = require('./infrastructure/database/mongoose/CampaignSchema');
const googleFacade = require('./infrastructure/services/google/GoogleWorkspaceFacade');
const generateContentUseCase = require('./application/use-cases/GenerateContentUseCase');
const autoFixUseCase = require('./application/use-cases/AutoFixUseCase');
const StandardSeoStrategy = require('./application/strategies/StandardSeoStrategy');
const ARTICLE_STATUS = require('./shared/constants/ArticleStatus');

async function runUseCaseTest() {
  console.log('=== 🚀 BẮT ĐẦU TEST USE CASES (GIAI ĐOẠN 3) ===\n');

  try {
    // Kết nối Database trước khi làm bất cứ điều gì
    await dbPool.connect();

    // ---------------------------------------------------------
    // 1. CHUẨN BỊ DỮ LIỆU GIẢ LẬP (MOCK DATA)
    // ---------------------------------------------------------
    console.log('\n>> 1. Khởi tạo dữ liệu giả lập (Mock Data)...');
    
    // Dùng ID thư mục Drive của bạn
    const ROOT_FOLDER_ID = '1dOh7NLY3sc9A8FHDWLSgaPLohfvJ49iz'; 
    const keyword = 'Cách học Nodejs hiệu quả cho người mới';

    // Tạo nhanh 1 file Docs thật trên Google Drive
    const docInfo = await googleFacade._createDoc(`[AUTO-FIX TEST] ${keyword}`, ROOT_FOLDER_ID);

    // Tạo Campaign ảo
    const campaign = await Campaign.create({
      name: 'Test Auto-Fix Campaign',
      sheetUrl: 'https://dummy.com',
      status: 'RUNNING'
    });

    // Tạo Article ảo trong MongoDB
    const article = await Article.create({
      campaignId: campaign._id,
      keyword: keyword,
      driveFolderId: ROOT_FOLDER_ID,
      docId: docInfo.docId,
      docUrl: docInfo.docUrl,
      status: ARTICLE_STATUS.QUEUED
    });

    console.log(`✅ Đã tạo bài viết tạm trong DB (ID: ${article._id})`);
    console.log(`📄 Đã tạo Google Docs thành công. Link: ${docInfo.docUrl}`);

    // ---------------------------------------------------------
    // 2. CHẠY USE CASE SINH NỘI DUNG
    // ---------------------------------------------------------
    console.log('\n>> 2. Chạy GenerateContentUseCase (Gọi AI viết bài)...');
    await generateContentUseCase.execute(article._id);


    // ---------------------------------------------------------
    // 3. CHẠY ENGINE CHẤM ĐIỂM SEO 
    // ---------------------------------------------------------
    console.log('\n>> 3. Chạy StandardSeoStrategy (Chấm điểm SEO)...');
    
    // Giả lập nội dung AI vừa viết ra bị lỗi (thiếu thẻ H2, quá ngắn, và không chứa từ khóa ở Sapo)
    // Trong thực tế, hệ thống sẽ đọc nội dung từ Docs thông qua Google API để đưa vào hàm này.
    const mockBadContent = "Đây là một đoạn mở bài rất ngắn. Không có cấu trúc Markdown nào cả.";
    
    const seoStrategy = new StandardSeoStrategy();
    const seoResult = seoStrategy.evaluate(mockBadContent, keyword, { minWords: 800 });

    console.log(`📊 Kết quả SEO: Điểm ${seoResult.score}/100 | Hợp lệ: ${seoResult.isValid}`);
    console.log(`❌ Các lỗi phát hiện:`);
    seoResult.errors.forEach(err => console.log(`   - ${err}`));

    // Mô phỏng việc Worker lưu lỗi vào Database để kích hoạt AutoFix
    const articleToFix = await Article.findById(article._id);
    articleToFix.status = ARTICLE_STATUS.FIXING_SEO;
    articleToFix.qualityMetrics.seoScore = seoResult.score;
    articleToFix.qualityMetrics.seoErrors = seoResult.errors;
    await articleToFix.save();


    // ---------------------------------------------------------
    // 4. CHẠY USE CASE TỰ SỬA LỖI
    // ---------------------------------------------------------
    console.log('\n>> 4. Chạy AutoFixUseCase (Ép AI tự sửa lỗi SEO)...');
    await autoFixUseCase.execute(articleToFix._id);

    // Kiểm tra trạng thái cuối cùng trong Database
    const finalArticle = await Article.findById(articleToFix._id);
    console.log(`\n🎉 Trạng thái cuối cùng của bài viết trong DB: ${finalArticle.status}`);
    console.log(`🔄 Số lần đã Retry: ${finalArticle.retryCount}`);
    console.log(`\n👉 KẾT LUẬN: Hãy mở Link Google Docs ở Bước 1 để chiêm ngưỡng.`);
    console.log(`Bạn sẽ thấy: [Dàn ý] -> [Bài viết gốc] -> [Bản tự sửa lỗi bám sát tiêu chí SEO] được AI nối tiếp nhau rất chuẩn!`);

  } catch (error) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH TEST:', error);
  } finally {
    // Dọn dẹp kết nối sau khi test xong
    await dbPool.disconnect();
    process.exit(0);
  }
}

// Thực thi
runUseCaseTest();