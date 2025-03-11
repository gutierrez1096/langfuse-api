'use strict';

/**
 * Sistema de errores personalizado para la aplicación
 * Permite categorizar y manejar errores de forma consistente
 */

/**
 * Error base de la aplicación
 * Todos los errores personalizados extenderán de esta clase
 */
class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status || 500;
    this.code = options.code || 'INTERNAL_ERROR';
    this.cause = options.cause;
    this.details = options.details || {};
    
    // Capturar stack trace correctamente
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convierte el error a formato JSON para respuestas API
   */
  toJSON() {
    const error = {
      error: this.code,
      message: this.message,
    };
    
    // Incluir detalles si existen
    if (Object.keys(this.details).length > 0) {
      error.details = this.details;
    }
    
    return error;
  }
}

/**
 * Error de validación (400 Bad Request)
 */
class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, {
      status: 400,
      code: 'VALIDATION_ERROR',
      details
    });
  }
}

/**
 * Error de autenticación (401 Unauthorized)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Credenciales inválidas') {
    super(message, {
      status: 401,
      code: 'AUTHENTICATION_ERROR'
    });
  }
}

/**
 * Error de autorización (403 Forbidden)
 */
class AuthorizationError extends AppError {
  constructor(message = 'No tiene permisos para esta acción') {
    super(message, {
      status: 403,
      code: 'AUTHORIZATION_ERROR'
    });
  }
}

/**
 * Error de recurso no encontrado (404 Not Found)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, {
      status: 404,
      code: 'NOT_FOUND',
      details: { resource }
    });
  }
}

/**
 * Error de conflicto (409 Conflict)
 */
class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(message, {
      status: 409,
      code: 'CONFLICT',
      details
    });
  }
}

/**
 * Error de base de datos
 */
class DatabaseError extends AppError {
  constructor(message = 'Error de base de datos', options = {}) {
    super(message, {
      ...options,
      status: options.status || 500,
      code: options.code || 'DATABASE_ERROR'
    });
  }
}

/**
 * Errores específicos de negocio
 */
class BusinessLogicError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      status: options.status || 400,
      code: options.code || 'BUSINESS_LOGIC_ERROR'
    });
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  BusinessLogicError
};