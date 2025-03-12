'use strict';

const express = require('express');
const router = express.Router();
const { validateAdminApiKey } = require('../middleware/auth.middleware');

// Importar rutas específicas
const organizationsRoutes = require('./organizations.routes');
const projectsRoutes = require('./projects.routes');
const usersRoutes = require('./users.routes');
const apiKeysRoutes = require('./api-keys.routes');
const healthRoutes = require('./health.routes');

// Endpoint de estado (no requiere autenticación)
router.use('/health', healthRoutes);

// Rutas protegidas por API key administrativa
// Este es el único punto de autenticación necesario
router.use(validateAdminApiKey);

// Rutas para cada recurso
router.use('/organizations', organizationsRoutes);
router.use('/projects', projectsRoutes);
router.use('/users', usersRoutes);
router.use('/api-keys', apiKeysRoutes);

module.exports = router;