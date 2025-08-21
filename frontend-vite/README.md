# Club della Nonna — La Piccola Italia

![Vite](https://img.shields.io/badge/Built%20With-Vite-646CFF?logo=vite&logoColor=fff)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react)
![TailwindCSS](https://img.shields.io/badge/Styles-TailwindCSS-06B6D4?logo=tailwindcss)
![Web3](https://img.shields.io/badge/Web3-Wagmi/Privy-4B3263?logo=ethereum)
![License](https://img.shields.io/badge/license-MIT-green)

> **Versión 1.0 — Club della Nonna**  
> ¡Abre tu cofre, reclama Monedas de Oro PAZ y sé parte de la famiglia!

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura y Estructura](#arquitectura-y-estructura)
- [Convenciones de Código](#convenciones-de-código)
- [Instalación y Primeros Pasos](#instalación-y-primeros-pasos)
- [Variables de Entorno](#variables-de-entorno)
- [Despliegue Docker y Puertos](#despliegue-docker-y-puertos)
- [Integración Web3](#integración-web3)
- [Testing](#testing)
- [Internacionalización (i18n)](#internacionalización-i18n)
- [Contacto y Créditos](#contacto-y-créditos)

---

## Descripción General

**Club della Nonna** es el programa de lealtad Web3 de La Piccola Italia, donde los clientes pueden reclamar cofres, ganar Monedas de Oro PAZ, canjearlas por comida, votar por nuevos platos y acceder a beneficios exclusivos.  
Construido sobre Vanellix Hub, combina la experiencia tradicional de la Nonna con tecnología blockchain, cupones NFT y gamificación real.

### Características Clave

- UI/UX inspirada en la cultura italiana, minimalista y mobile-first.
- Reclama tu cofre del tesoro y gana recompensas únicas.
- Integración avanzada con Web3: wallets, contratos, staking y cupones NFT.
- Internacionalización lista para español, inglés y portugués.
- Seguridad, privacidad y flexibilidad para despliegues multi-entorno.
- Preparado para CI/CD y despliegue automatizado en Coolify.

---

## Stack Tecnológico

| Categoría         | Tecnología/Paquete             |
|-------------------|-------------------------------|
| UI                | React 18, TailwindCSS, Lucide  |
| Build Tool        | Vite 6                         |
| Web3              | Wagmi 2, Privy, ethers   |
| Estado/Cache      | React Context, TanStack Query  |
| Routing           | React Router DOM 6             |
| Testing           | Vitest, Testing Library, Jest  |
| Lint/Format       | ESLint, Prettier               |
| i18n              | i18next, react-i18next         |
| CI/CD             | Coolify, Netlify, Vercel       |

---

## Arquitectura y Estructura

```mermaid
flowchart TD
    A[App.jsx] --> B(main.jsx)
    B --> C1[pages/]
    B --> C2[components/]
    B --> C3[hooks/]
    B --> C4[context/]
    B --> C5[utils/]
    B --> C6[contracts/]
    C1 --> D1[club/]
    C1 --> D2[adminPanel/]
    C2 --> E1[common/]
    C2 --> E2[wallet/]
### Estructura de Carpetas

```
src/
├── assets/        # Imágenes y logos de La Piccola
├── components/    # UI atómica y compuesta
│   ├── common/    # Botones, banners, layouts
│   └── wallet/    # Conexión y gestión de wallet
├── context/       # Contextos globales (Theme, Cache)
├── contracts/     # ABIs y helpers Web3
├── hooks/         # Custom hooks (usePromotionClient, useWallet)
├── locales/       # Traducciones (es, en, pt)
├── pages/         # Rutas principales (club, adminPanel)
├── utils/         # Funciones utilitarias y API
├── App.jsx        # Componente raíz
├── main.jsx       # Entry point
└── ...
```

---

### Convenciones de Código

| Elemento     | Convención                              |
|--------------|-----------------------------------------|
| Componentes  | PascalCase, separados por dominio       |
| Hooks        | useNombre, lógica reutilizable          |
| Context      | Sufijo `Context`, un archivo por contexto |
| Estilos      | Tailwind, sin CSS custom salvo excepciones |
| Tests        | Mismo nombre que componente + `.test.js` |
| Contratos    | ABIs y helpers en `contracts/`          |
| Utils        | Funciones puras y sin efectos           |

---

## Instalación y Primeros Pasos

```bash
git clone https://github.com/lapiccolaitalia/club-della-nonna.git
cd club-della-nonna/frontend-vite
npm install
```

### Desarrollo local

```bash
npm run dev
```

Accede a [http://localhost:5173](http://localhost:5173)

---

## Variables de Entorno

Configura tus claves en `.env` (ejemplo en `.env.example`).  
**Nunca subas `.env` a git.**

Variables importantes:

```env
VITE_API_URL=https://api.testing.lapiccolaitalia.cl/api
VITE_PRIVY_APP_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_COMPANY_ID=piccola
VITE_CHAIN_ID=80002
VITE_RPC_URL=...
VITE_BLOCK_EXPLORER=...
VITE_DRIP_KEY=...
```

En Coolify define las variables en la UI, no en archivos.

---

## 🐳 Despliegue Docker y Puertos

- El frontend expone el puerto interno `80` (HTTP).
- El puerto externo se define con `FRONTEND_HOST_PORT` en Docker Compose o Coolify.
- El backend se conecta vía `BACKEND_HOST` y `BACKEND_PORT` (proxy `/api`).

### Ejemplo en `docker-compose.yml`

```yaml
services:
  frontend:
    build:
      context: ./frontend-vite
    ports:
      - "${FRONTEND_HOST_PORT:-8082}:80"
    environment:
      - DOMAIN=testing.lapiccolaitalia.cl
      - BACKEND_HOST=backend
      - BACKEND_PORT=8081
      - STATIC_ROOT=/usr/share/nginx/html
    depends_on:
      - backend
```

---

## Integración Web3

- **Privy**: Login universal y wallet embebida.
- **Wagmi**: Conexión y firma con contratos.
- **ethers/viem**: Interacción avanzada.
- **Cupones NFT**: Reclama, canjea y consulta tu saldo de Monedas PAZ.

---

## Testing

- Tests unitarios con [Vitest](https://vitest.dev/) y [Testing Library](https://testing-library.com/)
- Ejecuta todos los tests:
  ```bash
  npm run test
  ```
- Archivos de test junto al componente/hook correspondiente.

---

## Internacionalización (i18n)

- Configuración en `src/i18n.js`
- Idiomas: español, inglés, portugués.
- Uso de hooks: `useTranslation()`

---

## Despliegue en Coolify

1. Sube el repo a Coolify.
2. Define las variables de entorno en la UI.
3. Coolify mapea automáticamente el dominio y puertos.
4. El build y proxy Nginx usan variables (`DOMAIN`, `BACKEND_HOST`, etc).

---

## Seguridad y Buenas Prácticas

- Nunca subas `.env` ni secretos.
- Usa HTTPS en producción.
- Valida datos del usuario y maneja errores.
- Revisa logs con `docker compose logs -f frontend`.

---

## Contacto y Créditos

- **Equipo:** La Famiglia de La Piccola Italia
- **Contacto:** [lucciano@vanellix.com](mailto:lucciano@vanellix.com)
- **Web:** [https://testing.lapiccolaitalia.cl](https://testing.lapiccolaitalia.cl)
- **Discord:** vanellix

---

> ¡Sé parte de la famiglia! Reclama tu cofre, gana Monedas de Oro y disfruta de beneficios VIP en La Piccola Italia.