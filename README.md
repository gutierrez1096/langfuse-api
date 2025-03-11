# Langfuse Admin API

API de administración para [Langfuse](https://langfuse.com) que permite gestionar organizaciones, proyectos y API keys.

## 🚀 Características

- ✅ Gestión completa de organizaciones y miembros
- ✅ Administración de proyectos
- ✅ Creación y gestión de API keys
- ✅ Autenticación simple mediante API key
- ✅ Documentación OpenAPI/Swagger
- ✅ Arquitectura modular y robusta

## 📋 Requisitos

- Node.js >= 18
- PostgreSQL >= 14

## 🛠️ Instalación

1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/langfuse-admin-api.git
cd langfuse-admin-api
```

2. Instalar dependencias

```bash
npm install
```

3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con los valores apropiados
```

4. Iniciar el servidor

```bash
npm start
```

Para desarrollo:

```bash
npm run dev
```

## 📊 Estructura del Proyecto

```
src/
 ├── config/         # Configuración centralizada
 ├── controllers/    # Controladores de rutas
 ├── middleware/     # Middleware Express
 ├── models/         # Modelos de datos
 ├── routes/         # Definición de rutas
 ├── services/       # Lógica de negocio
 ├── utils/          # Utilidades
 └── app.js          # Punto de entrada Express
```

## 📚 Endpoints API

La documentación completa está disponible en `/api-docs` cuando el servidor está en ejecución.

### Organizaciones

- `GET /api/organizations` - Listar organizaciones
- `GET /api/organizations/:id` - Obtener organización por ID
- `POST /api/organizations` - Crear una organización
- `PUT /api/organizations/:id` - Actualizar una organización

### Miembros de Organización

- `GET /api/organizations/:id/members` - Listar miembros
- `POST /api/organizations/:id/members` - Añadir miembro
- `PUT /api/organizations/:orgId/members/:userId` - Actualizar rol
- `DELETE /api/organizations/:orgId/members/:userId` - Eliminar miembro

### Proyectos

- `GET /api/projects` - Listar proyectos
- `GET /api/projects/:id` - Obtener proyecto por ID
- `POST /api/projects` - Crear un proyecto
- `PUT /api/projects/:id` - Actualizar un proyecto
- `DELETE /api/projects/:id` - Eliminar un proyecto

### API Keys

- `GET /api/projects/:id/api-keys` - Listar API keys
- `POST /api/projects/:id/api-keys` - Crear API key
- `DELETE /api/api-keys/:id` - Eliminar API key

## 🧪 Tests

Ejecutar los tests:

```bash
npm test
```

Con cobertura:

```bash
npm run test:coverage
```

## 🔧 Desarrollo

Verificar código:

```bash
npm run lint
```

Formatear código:

```bash
npm run format
```

## 🐳 Docker

Construir imagen:

```bash
npm run docker:build
```

Ejecutar contenedor:

```bash
npm run docker:run
```

## 📃 Licencia

[MIT](LICENSE)