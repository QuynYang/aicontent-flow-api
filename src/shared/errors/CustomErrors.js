class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Phân biệt lỗi nghiệp vụ có thể lường trước và lỗi sập code (bugs)
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

class ExternalAPIError extends AppError {
  constructor(provider, message) {
    super(`Lỗi từ phía API [${provider}]: ${message}`, 502); // 502 Bad Gateway
  }
}

class BusinessLogicError extends AppError {
  constructor(message) {
    super(message, 422); // Unprocessable Entity
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ExternalAPIError,
  BusinessLogicError
};