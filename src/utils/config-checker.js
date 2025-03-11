'use strict';

const { logger } = require('./logger');

/**
 * Utility to validate configuration settings
 */
class ConfigChecker {
  /**
   * Validates database configuration parameters and logs useful information
   * @param {Object} dbConfig - Database configuration object
   * @returns {Object} - Validation result with warnings and errors
   */
  static validateDatabaseConfig(dbConfig) {
    const result = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Check for essential parameters
    if (!dbConfig.host) {
      result.errors.push('DB_HOST not defined');
      result.valid = false;
    }

    if (!dbConfig.port) {
      result.warnings.push('DB_PORT not defined, using default (5432)');
    } else if (isNaN(dbConfig.port)) {
      result.errors.push('DB_PORT must be a number');
      result.valid = false;
    }

    if (!dbConfig.database) {
      result.errors.push('DB_NAME not defined');
      result.valid = false;
    }

    if (!dbConfig.user) {
      result.errors.push('DB_USER not defined');
      result.valid = false;
    }

    if (!dbConfig.password) {
      result.warnings.push('DB_PASS not defined, make sure this is intentional');
    }

    // Additional validations
    if (dbConfig.host === 'localhost' && process.env.NODE_ENV === 'production') {
      result.warnings.push('Using localhost in production environment, ensure this is intentional');
    }

    // Log validation results
    if (result.warnings.length > 0) {
      logger.warn('Database configuration warnings:', { warnings: result.warnings });
    }

    if (result.errors.length > 0) {
      logger.error('Database configuration errors:', { errors: result.errors });
    } else {
      logger.info('Database configuration validated successfully');
    }

    return result;
  }

  /**
   * Validates the application configuration and logs useful diagnostic information
   * @param {Object} config - The application configuration object
   * @returns {boolean} - Whether the configuration is valid
   */
  static validateAppConfig(config) {
    logger.info('Application configuration:', {
      environment: config.nodeEnv,
      port: config.port,
      host: config.host,
      apiKeyAuthEnabled: config.enableApiKeyAuth,
      corsOrigin: config.corsOrigin,
      logLevel: config.logLevel
    });

    // Validate database configuration
    const dbValidation = this.validateDatabaseConfig(config.db);
    
    return dbValidation.valid;
  }

  /**
   * Format database connection string for logging (hiding sensitive data)
   * @param {Object} dbConfig - Database configuration object
   * @returns {string} - Formatted connection string for logging
   */
  static formatDbConnectionString(dbConfig) {
    return `postgres://${dbConfig.user}:***@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}${dbConfig.ssl ? ' (SSL enabled)' : ''}`;
  }
}

module.exports = ConfigChecker;