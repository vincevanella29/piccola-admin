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
    && apt-get install -y --no-install-recommends \
        openvpn \
        ffmpeg \
        ca-certificates \
        curl \
        build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

# Copia WSDLs necesarios para ONVIF (ya incluidos en el repo en backend/wsdl)
COPY wsdl /backend/wsdl

# Valor por defecto dentro del contenedor (puede sobreescribirse en runtime)
ENV ONVIF_WSDL_DIR=/backend/wsdl

# Copia el resto del código fuente del backend
COPY . .

# Expone el puerto de FastAPI (uvicorn)
ENV PORT=8081
ENV FFMPEG_BIN=/usr/bin/ffmpeg
EXPOSE $PORT

# Comando por defecto para correr el backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
