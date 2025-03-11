# Imagen base con Node.js
FROM node:18-alpine AS base

# Crear directorio de la aplicación
WORKDIR /app

# Instalación de dependencias
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Compilación (si se necesitara)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Producción
FROM base AS runner
ENV NODE_ENV production

# Crear usuario para ejecutar la app (no usar root)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 langfuse
USER langfuse

# Copiar los archivos de la aplicación
COPY --from=builder --chown=langfuse:nodejs /app/package.json ./package.json
COPY --from=builder --chown=langfuse:nodejs /app/index.js ./index.js
COPY --from=builder --chown=langfuse:nodejs /app/docs ./docs
COPY --from=builder --chown=langfuse:nodejs /app/src ./src
COPY --from=deps --chown=langfuse:nodejs /app/node_modules ./node_modules

# Crear directorio para logs (asegurando permisos)
RUN mkdir -p logs && chown -R langfuse:nodejs logs

# Puerto de la aplicación
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3100/api/health || exit 1

# Comando para iniciar la aplicación
CMD ["node", "index.js"]