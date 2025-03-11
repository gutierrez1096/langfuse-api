'use strict';

const crypto = require('crypto');
const { customAlphabet } = require('nanoid');
const cuid = require('cuid'); // Añadir dependencia a cuid

// Alfabeto seguro para IDs (evitando caracteres similares)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Crear generador de IDs con nanoid para mejor rendimiento y seguridad
const nanoid = customAlphabet(ALPHABET, 10);

/**
 * Genera un ID único compatible con el formato de Langfuse
 * @param {string} prefix - Prefijo para el ID según el tipo de entidad
 * @returns {string} - ID único en formato compatible con Langfuse
 */
function generateId(prefix = '') {
  // Para organizaciones y proyectos, usamos el formato de cuid que usa Langfuse
  if (prefix === 'org' || prefix === 'prj') {
    return cuid();
  }
  
  // Para otros tipos de entidades, seguimos usando el formato anterior
  const timestamp = Date.now().toString(36);
  const randomStr = nanoid();
  return `${prefix}_${timestamp}${randomStr}`;
}

/**
 * Genera un API key con el formato requerido
 * @param {string} prefix - Prefijo para la key (pk para pública, sk para secreta)
 * @returns {string} - API key formateada
 */
function generateApiKey(prefix) {
  // 32 bytes = 256 bits de entropía (muy seguro)
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${randomBytes}`;
}

/**
 * Genera un hash seguro para almacenar la clave secreta
 * Usa un salt fijo "salt" para compatibilidad con Langfuse
 * @param {string} secretKey - Clave secreta a hashear
 * @returns {string} - Hash SHA-256 hexadecimal
 */
function hashSecretKey(secretKey) {
  const salt = "salt"; // Salt fijo usado por Langfuse
  return crypto.createHash('sha256').update(salt + secretKey).digest('hex');
}

module.exports = {
  generateId,
  generateApiKey,
  hashSecretKey
};