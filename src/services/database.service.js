'use strict';

const { Pool } = require('pg');
const config = require('../config');
const { DatabaseError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Abstracción de la base de datos para centralizar manejo de conexiones y queries
 */
class DatabaseService {
  constructor() {
    // Initialize the pool configuration
    const poolConfig = {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      max: config.db.pool.max,
      idleTimeoutMillis: config.db.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.pool.acquireTimeoutMillis,
    };

    // Configure SSL if enabled
    if (config.db.ssl) {
      poolConfig.ssl = typeof config.db.ssl === 'object' 
        ? config.db.ssl 
        : { rejectUnauthorized: false };
    }

    // Log connection details (excluding sensitive data)
    logger.info('Initializing database connection', {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      sslEnabled: !!config.db.ssl,
    });

    // Create the connection pool
    this.pool = new Pool(poolConfig);

    // Events for pool monitoring
    this.pool.on('connect', () => {
      logger.debug('Connection acquired from pool');
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error in pool client', {
        error: err.message,
        stack: err.stack,
        code: err.code
      });
    });

    logger.info('Database service initialized');
  }

  /**
   * Ejecuta una consulta individual
   * @param {string} text - Consulta SQL
   * @param {Array} params - Parámetros para consulta
   * @returns {Promise<Object>} - Resultado de la consulta
   */
  async query(text, params = []) {
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Loguear consultas lentas
      if (duration > 500) {
        logger.warn(`Consulta lenta (${duration}ms): ${text}`);
      } else {
        logger.debug(`Consulta ejecutada (${duration}ms): ${text}`);
      }
      
      return result.rows;
    } catch (error) {
      logger.error('Error en consulta:', {
        query: text,
        params,
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      
      throw new DatabaseError('Error al ejecutar consulta', { cause: error });
    }
  }

  /**
   * Ejecuta una consulta y devuelve un solo registro
   * @param {string} text - Consulta SQL
   * @param {Array} params - Parámetros para consulta
   * @returns {Promise<Object|null>} - Registro único o null
   */
  async queryOne(text, params = []) {
    const rows = await this.query(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Ejecuta una transacción con múltiples consultas
   * @param {Function} callback - Función que recibe cliente y ejecuta consultas
   * @returns {Promise<any>} - Resultado del callback
   */
  async transaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error en transacción:', {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      throw new DatabaseError('Error al ejecutar transacción', { cause: error });
    } finally {
      client.release();
    }
  }

  /**
   * Verifica la conexión a la base de datos
   * @returns {Promise<Object>} - Resultado de la verificación
   */
  async checkConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as time');
      return {
        status: 'connected',
        time: result.rows[0].time
      };
    } catch (error) {
      logger.error('Database connection check failed:', {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      
      return {
        status: 'error',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Cierra todas las conexiones del pool
   */
  async close() {
    logger.info('Cerrando conexiones de base de datos');
    return this.pool.end();
  }
}

// Singleton para reutilizar en toda la aplicación
const dbService = new DatabaseService();

module.exports = {
  db: dbService,
  transaction: async (callback) => dbService.transaction(callback)
};