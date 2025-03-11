'use strict';

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

/**
 * Rutas para monitoreo de estado del servicio
 * Estas rutas no requieren autenticación para permitir monitoreo externo
 */

// Estado general del servicio
router.get('/', healthController.checkHealth);

// Estado específico de la base de datos
router.get('/db', healthController.checkDatabaseHealth);

module.exports = router;