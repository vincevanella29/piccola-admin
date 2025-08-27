# Dockerfile para el backend FastAPI de Vanellix Hub
FROM python:3.9-slim

# Evita prompts interactivos
ENV PYTHONUNBUFFERED=1

# Crea el directorio de trabajo
WORKDIR /backend

# Copia solo los archivos necesarios primero para aprovechar el cache de Docker
COPY requirements.txt ./

# Instala OpenVPN (para workers MTZ) y dependencias de Python
RUN apt-get update \
    && apt-get install -y --no-install-recommends openvpn \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

# Copia el resto del código fuente del backend
COPY . .

# Expone el puerto de FastAPI (uvicorn)
ENV PORT=8081
EXPOSE $PORT

# Comando por defecto para correr el backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
