const { AppError } = require('../../../shared/errors/CustomErrors');

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Chế độ Development: Trả về đầy đủ stack trace để dễ debug
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } 
  // Chế độ Production: Che giấu chi tiết lỗi hệ thống, chỉ trả về message
  else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // Lỗi lập trình, lỗi thư viện chưa biết
      console.error('ERROR 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Đã có lỗi nghiêm trọng xảy ra trên hệ thống!'
      });
    }
  }
};

module.exports = errorHandler;