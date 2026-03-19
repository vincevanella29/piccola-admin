# Dockerfile para el frontend Vite (Node.js + npm)

# Etapa de build
FROM node:20-alpine AS build

WORKDIR /frontend-vite

# Limitar memoria de Node para evitar OOM en builds paralelos
ENV NODE_OPTIONS="--max-old-space-size=512"

# 1) Copiar SOLO archivos de dependencias → cache de npm se mantiene si no cambian
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# 2) Copiar el código fuente (esta capa se invalida en cada push, pero npm ci ya está cacheado)
COPY . .
RUN npm run build

# Etapa de producción: sirve archivos estáticos con Nginx
FROM nginx:alpine

# Copia el build generado al directorio de Nginx
COPY --from=build /frontend-vite/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

# Expone los puertos estándar internos (fijos)
EXPOSE 80 443

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
