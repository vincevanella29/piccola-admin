# 🖥️ Vanellix Admin Web3: Frontend Architecture

Bienvenido al Frontend Administrativo de La Piccola Italia. 
Construido sobre **React + Vite**, este proyecto no es un panel de administración tradicional; es una **DApp (Decentralized Application)** diseñada bajo la filosofía visual "Apple-Style". Combina la elegancia del Glassmorphism y las animaciones fluidas con la seguridad de la criptografía asimétrica (Web3 y Dilithium).

---

## 📐 Arquitectura de Inicialización (State Flow)

La aplicación utiliza una cascada de estado Top-Down, donde la identidad criptográfica y los permisos se resuelven en el nivel más alto (`main.jsx`) y fluyen hacia abajo a través de un cascarón visual (Layout Shell) hasta llegar a las vistas dinámicas.

```mermaid
graph TD
    %% Estilos "Apple Simple" Glassmorphism
    classDef root fill:#fbfbfd,stroke:#d2d2d7,stroke-width:2px,color:#1d1d1f,rx:12px,ry:12px;
    classDef auth fill:#e8f4fc,stroke:#3b82f6,stroke-width:2px,color:#1d4ed8,rx:12px,ry:12px;
    classDef shell fill:#ffffff,stroke:#0066cc,stroke-width:2px,color:#0066cc,rx:12px,ry:12px;
    classDef page fill:#fafafa,stroke:#8b5cf6,stroke-width:2px,color:#5b21b6,rx:12px,ry:12px;
    classDef hooks fill:#f5f5f7,stroke:#34d399,stroke-width:2px,color:#065f46,rx:12px,ry:12px;

    %% Nodos
    Main[🚀 main.jsx\nEntry Point & Providers]:::root
    Privy[🔐 PrivyProvider\nCustodia de Wallet Web3]:::auth
    Vanellix[🛡️ useVanellixLogin\nEmisión de JWT Session]:::hooks
    
    Wrapper[🧩 ContentWrapper.jsx\nLayout Shell & Modales UI]:::shell
    App[🛤️ App.jsx\nRouter Dinámico & RBAC]:::shell
    
    Hooks[🪝 Custom Hooks\nLógica de Negocio]:::hooks
    Pages[📄 Pages / Rutas\n(Delivery, Marketing, Finanzas)]:::page

    %% Relaciones
    Main --> Privy
    Privy -->|Wallet & Identity| Vanellix
    Vanellix -->|Genera appState| Wrapper
    
    Wrapper -->|Inyecta appState & sidebarWidth| App
    App -->|Monta según pagesConfig.js| Pages
    
    Pages -.->|Consumen| Hooks
    Hooks -.->|Llaman a| APIs[📡 Backend Hub]
```

---

## 📚 Ecosistema de Módulos (Directorio)

Para mantener la base de código limpia y escalable, el Frontend está rigurosamente dividido. **Lee el README de cada subcarpeta para entender su lógica interna:**

- 🧩 **[Componentes Base (`src/components/README.md`)](./src/components/README.md)**: El *Layout Shell*. Explica cómo funciona el `ContentWrapper`, las animaciones globales (Framer Motion) y cómo sobrescribimos los modales de Privy para darles nuestra estética "Whitelabel".
- 📄 **[Vistas y Rutas (`src/pages/README.md`)](./src/pages/README.md)**: El *Auto-Discovery*. Cómo Vite encuentra automáticamente tus archivos `.jsx` y los convierte en rutas protegidas usando la constante `pageMetadata`.
- 🪝 **[Lógica de Negocio (`src/hooks/README.md`)](./src/hooks/README.md)**: El *Cerebro*. Toda la interacción con la Blockchain (Polygon), las conexiones WebSockets (Chat) y los endpoints del Backend se abstraen aquí.

---

## 🎨 Filosofía de Diseño: "Apple-Style"

Si vas a programar en el Frontend de Vanellix, debes adherirte a estas reglas visuales y de experiencia de usuario:

1. **Cero Interfaces "Cuadradas" (Bootstrap-like):** Todo elemento debe sentirse "Premium". Usa bordes redondeados (`rounded-2xl` o `rounded-3xl`), sombras difuminadas (`shadow-lg`), y fondos translúcidos con desenfoque (`backdrop-blur-xl` / Glassmorphism).
2. **Micro-Interacciones siempre:** Botones, tarjetas y modales nunca deben aparecer de golpe. Todo debe usar `<motion.div>` de `Framer Motion` con curvas de interpolación suaves (`easeOut`).
3. **Manejo de Errores Sutil:** Evita los `alert()` bloqueantes del navegador. Si una transacción Web3 falla o la API devuelve un error 500, notifícalo a través del componente global `GlobalStatusMessage` usando colores pastel.
4. **Modo Oscuro Nativo:** Toda vista nueva debe soportar clases de Tailwind `dark:`. El ecosistema cambia de color completamente respetando los tonos oscuros de alto contraste (sin llegar al negro `#000000` puro, usando tonos como `#1c1c1e`).

---

## 🚀 Arranque del Proyecto

El entorno utiliza Vite para una compilación ultrarrápida (Hot Module Replacement - HMR).

1. Instala las dependencias (se requiere Node 18+):
   \`\`\`bash
   npm install
   \`\`\`
2. Configura las variables de entorno en tu `.env` (Client ID de Privy, URL del Backend).
3. Inicia el servidor de desarrollo:
   \`\`\`bash
   npm run dev
   \`\`\`

> *"Design is not just what it looks like and feels like. Design is how it works."* – Filosofía UI de Vanellix.
