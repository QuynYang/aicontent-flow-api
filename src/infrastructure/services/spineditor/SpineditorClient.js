const axios = require('axios');
const puppeteerBrowserManager = require('./PuppeteerBrowserManager');
const { ExternalAPIError } = require('../../../shared/errors/CustomErrors');

class SpineditorClient {
  constructor() {
    this.username = process.env.SPINEDITOR_USER;
    this.password = process.env.SPINEDITOR_PASS;
    this.twoCaptchaKey = process.env.TWOCAPTCHA_API_KEY;
    this.isLoggedIn = false; // Cờ đánh dấu để không phải đăng nhập lại nhiều lần
  }

  /**
   * Hàm gọi API 2Captcha để giải mã reCAPTCHA V2
   * @param {string} googleKey - Mã sitekey lấy từ trang web chứa Captcha
   * @param {string} pageUrl - Đường link của trang web đang bị dính Captcha
   */
  async _solveCaptcha(googleKey, pageUrl) {
    console.log('🤖 [2Captcha] Bắt đầu gửi yêu cầu giải Captcha...');
    try {
      // 1. Gửi yêu cầu giải
      const reqResponse = await axios.get(`http://2captcha.com/in.php?key=${this.twoCaptchaKey}&method=userrecaptcha&googlekey=${googleKey}&pageurl=${pageUrl}&json=1`);
      if (reqResponse.data.status !== 1) throw new Error(reqResponse.data.request);
      
      const captchaId = reqResponse.data.request;
      console.log(`⏳ [2Captcha] Đã gửi task (ID: ${captchaId}). Đang chờ kết quả...`);

      // 2. Vòng lặp chờ kết quả (poll cứ 5 giây 1 lần)
      let token = null;
      for (let i = 0; i < 24; i++) { // Chờ tối đa 2 phút
        await new Promise(resolve => setTimeout(resolve, 5000));
        const resResponse = await axios.get(`http://2captcha.com/res.php?key=${this.twoCaptchaKey}&action=get&id=${captchaId}&json=1`);
        
        if (resResponse.data.status === 1) {
          token = resResponse.data.request;
          console.log('✅ [2Captcha] Giải Captcha thành công!');
          break;
        } else if (resResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(resResponse.data.request);
        }
      }

      if (!token) throw new Error('Timeout khi chờ giải Captcha');
      return token;

    } catch (error) {
      throw new ExternalAPIError('2Captcha', `Lỗi giải Captcha: ${error.message}`);
    }
  }

  /**
   * Đăng nhập vào Spineditor
   */
  async login(page) {
    if (this.isLoggedIn) return; // Nếu đăng nhập rồi thì bỏ qua
    
    console.log('🔑 [Spineditor] Đang tiến hành đăng nhập...');
    await page.goto('https://spineditor.com/login', { waitUntil: 'networkidle2' });

    // ĐIỀN CHÍNH XÁC ID CỦA Ô EMAIL VÀ PASSWORD TRÊN SPINEDITOR VÀO ĐÂY
    await page.type('#email_login', this.username); 
    await page.type('#password_login', this.password);

    // Xử lý Captcha lúc đăng nhập (Nếu Spineditor có)
    // Cần kiểm tra xem có div chứa reCAPTCHA không. Nếu có, bóc tách data-sitekey để giải.
    const siteKeyElement = await page.$('.g-recaptcha');
    if (siteKeyElement) {
      console.log('⚠️ [Spineditor] Phát hiện Captcha lúc đăng nhập!');
      const siteKey = await page.evaluate(el => el.getAttribute('data-sitekey'), siteKeyElement);
      const captchaToken = await this._solveCaptcha(siteKey, page.url());
      
      // Inject token của 2Captcha vào form ẩn của trang web
      await page.evaluate((token) => {
        document.getElementById('g-recaptcha-response').innerHTML = token;
      }, captchaToken);
    }

    // Click nút đăng nhập
    await Promise.all([
      page.click('#btn_login'), // THAY BẰNG ĐÚNG ID NÚT LOGIN
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    this.isLoggedIn = true;
    console.log('🔓 [Spineditor] Đăng nhập thành công!');
  }

  /**
   * Hàm mặt tiền: Nhận nội dung bài viết và trả về % Unique
   * @param {string} content - Nội dung bài viết cần check
   */
  async checkPlagiarism(content) {
    const browser = await puppeteerBrowserManager.getBrowser();
    const page = await browser.newPage();
    
    try {
      await this.login(page);

      console.log('🔍 [Spineditor] Đang đẩy nội dung lên check đạo văn...');
      await page.goto('https://spineditor.com/check-kiem-tra-dao-van', { waitUntil: 'networkidle2' });

      // Dán text vào ô kiểm tra
      await page.type('#text_to_check', content); // THAY BẰNG ID Ô NHẬP TEXT
      
      // Bấm nút kiểm tra
      await page.click('#btn_check_plagiarism'); // THAY BẰNG ID NÚT CHECK
      
      // Đợi Spineditor trả về kết quả (đợi cho một thẻ class chứa kết quả xuất hiện)
      console.log('⏳ [Spineditor] Đang chờ hệ thống chấm điểm...');
      await page.waitForSelector('.result-percentage', { timeout: 60000 }); // THAY BẰNG CLASS CHỨA ĐIỂM SỐ
      
      // Cào lấy điểm số phần trăm
      const uniqueScoreText = await page.$eval('.result-percentage', el => el.innerText);
      
      // Cào lấy các câu bị đỏ (trùng lặp) để gửi lại cho AI sửa
      const plagiarizedSentences = await page.$$eval('.sentence-duplicate', nodes => nodes.map(n => n.innerText));

      // Lọc lấy số từ chuỗi "Độ unique: 85%"
      const score = parseInt(uniqueScoreText.replace(/[^0-9]/g, ''), 10);

      console.log(`✅ [Spineditor] Check xong! Điểm Unique: ${score}%`);

      return {
        score: score,
        plagiarizedSentences: plagiarizedSentences
      };

    } catch (error) {
      console.error('❌ [Spineditor] Lỗi khi check bài:', error.message);
      throw new ExternalAPIError('Spineditor', error.message);
    } finally {
      await page.close(); // Xong việc phải đóng Tab để giải phóng RAM
    }
  }
}

module.exports = new SpineditorClient();