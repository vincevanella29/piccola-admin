# 🍝 La Piccola Italia Web3 — Club della Nonna

![Web3](https://img.shields.io/badge/Web3-100%25-4B3263?logo=ethereum)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-green?logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?logo=react)
![MongoDB](https://img.shields.io/badge/Analytics-MongoDB-47A248?logo=mongodb)
![CI/CD](https://img.shields.io/github/actions/workflow/status/vanellix/vanellix-hub/backend-ci.yml?label=CI%2FCD)
![License](https://img.shields.io/badge/license-MIT-green)

> **Esta plataforma es una solución real de fidelización y comunidad, construida sobre [Vanellix Hub](https://github.com/Vanellix/vanellix-hub): la infraestructura Web3 modular, stateless y 100% on-chain para DAOs, loyalty y economías digitales.**

---

## 🛠️ ¿Por qué es una demo de Vanellix Hub?

La Piccola Italia Web3 es el primer caso de uso público de Vanellix Hub, mostrando cómo cualquier empresa puede lanzar su propio sistema de fidelización y recompensas 100% blockchain, sin servidores centralizados ni bases de datos tradicionales.

- **Demuestra cómo Vanellix Hub permite crear clubs de lealtad, DAOs y economías tokenizadas en minutos.**
- **Todo el flujo (reclamo, staking, recompensas, votación) está gobernado por contratos inteligentes y APIs abiertas.**
- **La experiencia de usuario es moderna, rápida y amigable, usando React 18, Vite y Privy para onboarding Web3/Web2.**
- **El staking es gamificado: los usuarios depositan tokens, ganan recompensas diarias y desbloquean beneficios exclusivos, todo con feedback visual y UX de alto nivel.**

---

## ✨ Características destacadas

- **Staking gamificado:** Deposita tokens PAZ y gana PARE automáticamente cada día.
- **Recompensas reales:** Canjea tus tokens por descuentos, cupones, experiencias VIP y más.
- **Votación comunitaria:** Usa tus tokens para decidir el futuro del menú y la comunidad.
- **Onboarding universal:** Cualquier usuario puede entrar con wallet Web3 o credenciales Web2 (Privy).
- **Open-source & Plug & Play:** El código es abierto y cualquier restaurante o empresa puede adaptar el stack para su propio club.
- **UI/UX premium:** Interfaz moderna, mobile-first y con animaciones y feedback claros para el usuario.

---

![Web3](https://img.shields.io/badge/Web3-100%25-4B3263?logo=ethereum)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-green?logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?logo=react)
![MongoDB](https://img.shields.io/badge/Analytics-MongoDB-47A248?logo=mongodb)

> **La Piccola Italia Web3 es el primer club de lealtad y comunidad gastronómica 100% on-chain de Chile, construido sobre la infraestructura de Vanellix Hub.**

---

## 🌍 Visita el club en producción

**[testing.lapiccolaitalia.cl](https://testing.lapiccolaitalia.cl)**

---

## 🎉 ¿Qué es el Club della Nonna?

¡Bienvenido a la revolución Web3 de La Piccola Italia! El Club della Nonna es un club de recompensas, comunidad y experiencias donde cada cliente puede ganar, canjear y votar usando tokens propios de la marca (PAZ y PARE), todo sobre tecnología blockchain y sin dependencia de servidores Web2.

- Reclama Monedas de Oro PAZ gratis por ser pionero.
- Deposita tus PAZ en la bóveda y gana Monedas de Plata PARE todos los días.
- Usa tus monedas para descuentos, cupones, experiencias VIP y votar el futuro del menú.
- Todo es transparente, auditable y gobernado por la comunidad.

---

## 🏗️ Arquitectura

La Piccola Italia Web3 utiliza Vanellix Hub como infraestructura base, garantizando:

- **Descentralización total:** Todos los saldos, recompensas y reglas viven en contratos inteligentes.
- **Backend stateless:** Solo relay y analítica, nunca guarda datos críticos de usuarios o negocios.
- **MongoDB solo para analytics:** Nunca para datos críticos.
- **Frontend moderno:** React 18 + Vite + Privy para onboarding Web3/Web2.

---

## 🚦 Despliegue y uso

### 🔹 Producción

- Accede a: [https://testing.lapiccolaitalia.cl](https://testing.lapiccolaitalia.cl)

### 🔹 Local/Docker Compose

1. Crea un archivo `.env` en la raíz:
   ```env
   FRONTEND_HOST_PORT=8082
   BACKEND_HOST_PORT=8081
   ```
2. Levanta todo el stack:
   ```sh
   docker compose up -d
   ```
3. Accede localmente a:
   - Frontend: http://localhost:8082
   - Backend: http://localhost:8081/api/docs

### 🔹 Manual (desarrollo)

1. **Backend**
   ```sh
   cd backend
   python3 -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   export PORT=8081
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
2. **Frontend**
   ```sh
   cd frontend-vite
   npm install
   npm run dev
   ```

---

## 🌱 Variables de entorno

- Todas las variables necesarias están declaradas en `docker-compose.yml` y en los archivos `.env.example` de cada módulo.
- Para frontend Vite en Coolify, recuerda marcar las variables `VITE_...` como "Build Variable".

---

## 💡 ¿Por qué es revolucionario?

- **No hay backend centralizado:** Todo lo importante ocurre en la blockchain.
- **Recompensas y comunidad sin Web2:** Los tokens y reglas viven en contratos inteligentes.
- **Open & Auditable:** Todo el código y los contratos son públicos.
- **Plug & Play:** Cualquier restaurante puede lanzar su propio club sobre Vanellix Hub.

---

## 📁 Estructura del repositorio

```
piccola_italia_web3/
├── backend/         # API stateless, workers de eventos, analytics (Python/FastAPI)
├── frontend-vite/   # Web3 app (React 18, Vite, Tailwind, Wagmi, Privy)
├── docker-compose.yml
├── README.md        # Este archivo
└── ...
```

---

## 🚚 Delivery & Pagos (Transbank OneClick)

La plataforma incluye un sistema de delivery con pagos integrados:

- **Transbank OneClick Mall** — Inscripción de tarjetas + cobros automáticos
- **Sync encriptado** — Las credenciales de Transbank se encriptan con Fernet (HKDF del dilithium_mnemonic) y se pushean al delivery app durante la sincronización
- **3 triggers de sync**: push on save, catalog sync manual, cron nocturno

### Dependencias adicionales (Delivery)
```txt
transbank-sdk>=6.1.0      # SDK oficial Transbank
cryptography>=45.0.0       # Fernet encryption (ya incluido por web3)
dilithium-py>=1.4.0        # Post-quantum signing
mnemonic>=0.21             # BIP39 keypair derivation
```

### Flujo de pagos
```
Admin → Guarda creds → Encrypta con Fernet → Push a delivery providers
Delivery → Almacena blob encriptado → Descifra in-memory solo al cobrar
Cliente → Inscribe tarjeta → tbk_user local → Pagos con OneClick
```

---

## 🛡️ Buenas prácticas
- Nunca subas `.env` ni llaves privadas a git.
- Usa ramas y PRs para cambios.
- Documenta endpoints y contratos.
- Revisa seguridad y tests automáticos.

---

## 🤝 Autores y comunidad
- Proyecto: La Piccola Italia (powered by Vanellix Hub)
- Autor infra: Lucciano Vanella ([luccianoVanella](https://github.com/luccianoVanella))
- Email: lucciano@vanellix.com

> **¡Súmate a la revolución Web3 de La Piccola Italia!**

