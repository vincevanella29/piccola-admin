# Dockerfile para el frontend Vite (Node.js + npm)

# Etapa de build
FROM node:20-alpine AS build

WORKDIR /frontend-vite

# Copia los archivos de dependencias primero para aprovechar el cache
COPY package*.json ./
COPY . .

# Instala dependencias y construye el proyecto
RUN npm ci --legacy-peer-deps
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
