'use strict';

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware para validar solicitudes
 * @param {Object} schema - Esquema de validación Joi para body, query y params
 * @returns {Function} - Middleware de validación
 */
const validate = (schema) => {
  return (req, res, next) => {
    // Objeto para almacenar los errores
    const validationErrors = {};
    
    // Validar body si hay un esquema definido
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        validationErrors.body = formatJoiErrors(error);
      }
    }
    
    // Validar query params si hay un esquema definido
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        validationErrors.query = formatJoiErrors(error);
      }
    }
    
    // Validar path params si hay un esquema definido
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        validationErrors.params = formatJoiErrors(error);
      }
    }
    
    // Si hay errores, lanzar error de validación
    if (Object.keys(validationErrors).length > 0) {
      return next(new ValidationError('Error de validación', validationErrors));
    }
    
    next();
  };
};

/**
 * Formatea los errores de Joi en un formato más amigable
 * @param {Object} error - Error de validación de Joi
 * @returns {Object} - Errores formateados
 */
function formatJoiErrors(error) {
  return error.details.reduce((acc, detail) => {
    // Extraer el nombre del campo y quitar corchetes
    const key = detail.path.join('.');
    
    // Formatear mensajes para ser más legibles
    let message = detail.message.replace(/['"]/g, '');
    
    // Mensajes más amigables para casos comunes
    if (message.includes('is required')) {
      message = 'Este campo es requerido';
    } else if (message.includes('must be a valid')) {
      message = 'Formato inválido';
    }
    
    acc[key] = message;
    return acc;
  }, {});
}

/**
 * Esquema genérico para validar ID
 * Ahora soporta tanto IDs en formato prefijo_base (como 'org_12345') como cuid (como 'cm84umiqf001bpp07fzmk5q26')
 */
const idSchema = Joi.string().pattern(/(^[a-z]+_[a-z0-9]+$)|(^c[a-z0-9]+$)/);

/**
 * Esquemas comunes reutilizables
 */
const commonSchemas = {
  id: idSchema,
  uuid: Joi.string().uuid(),
  email: Joi.string().email(),
  name: Joi.string().min(2).max(100),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
  orgRole: Joi.string().valid('OWNER', 'ADMIN', 'VIEWER', 'NONE'),
};

module.exports = {
  validate,
  commonSchemas,
  Joi, // Exportar Joi para definir esquemas en los controladores
};