'use strict';

const { AppError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Middleware for capturing errors in async/await controllers
 * Wraps controllers with a try/catch and passes the error to the next middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Central middleware to handle all application errors
 */
const errorHandler = (err, req, res, next) => {
  // Application errors vs third-party errors
  if (err instanceof AppError) {
    const statusCode = err.status;
    
    // Log based on severity
    if (statusCode >= 500) {
      logger.error('Application error:', {
        error: err.message,
        stack: err.stack,
        code: err.code,
        details: err.details
      });
    } else {
      logger.warn('Client error:', {
        error: err.message,
        code: err.code,
        details: err.details
      });
    }
    
    return res.status(statusCode).json(err.toJSON());
  }
  
  // Express and other library errors
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  // Known specific errors
  if (err.name === 'SyntaxError' && err.status === 400) {
    statusCode = 400;
    errorMessage = 'Invalid JSON format';
    errorCode = 'INVALID_JSON';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    errorMessage = 'Service temporarily unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }
  
  // Log error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    type: err.name,
    code: err.code
  });
  
  // Response to client
  const response = {
    error: errorCode,
    message: errorMessage
  };
  
  if (process.env.NODE_ENV !== 'production') {
    response.details = {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n')
    };
  }
  
  return res.status(statusCode).json(response);
};

module.exports = {
  asyncHandler,
  errorHandler
};