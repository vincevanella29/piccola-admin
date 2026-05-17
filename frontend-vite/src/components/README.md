# 🧩 Core Components Architecture (Vanellix UI)

Bienvenido a la capa de presentación central del Frontend Administrativo. 
Siguiendo los principios de diseño de "Apple Style" (minimalismo, transiciones suaves de Framer Motion y encapsulamiento), la carpeta `src/components/` define el **Layout Shell** (el cascarón visual) de toda la aplicación.

Aquí no hay lógica de negocio pura; estos componentes se encargan de enrutar, animar y proveer la interfaz base para que las "Páginas" (Pages) puedan existir y consumir datos.

---

## 📐 Diagrama de Flujo (El Árbol de Estado)

El estado centralizado (`appState`) viaja a través de una cascada descendente (Top-Down). Así es como la metadata y los estados llegan a todas las páginas:

```mermaid
graph TD
    %% Estilos "Apple Simple"
    classDef shell fill:#fbfbfd,stroke:#d2d2d7,stroke-width:2px,color:#1d1d1f,rx:12px,ry:12px;
    classDef core fill:#ffffff,stroke:#0066cc,stroke-width:2px,color:#0066cc,rx:12px,ry:12px;
    classDef modal fill:#f5f5f7,stroke:#8b5cf6,stroke-width:2px,color:#5b21b6,rx:12px,ry:12px;
    classDef page fill:#e8f4fc,stroke:#3b82f6,stroke-width:2px,color:#1d4ed8,rx:12px,ry:12px;

    Main[index.jsx / main.jsx\n(Inicializa Providers)]:::shell
    Wrapper[ContentWrapper.jsx\n(El Director de Orquesta)]:::core
    
    Header[Header.jsx]:::shell
    Sidebar[Sidebar.jsx]:::shell
    Footer[Footer.jsx]:::shell
    
    Modals[Modales Globales\nLogin / Transacciones / Firmas]:::modal
    
    App[App.jsx\n(Enrutador Dinámico)]:::core
    Pages[Pages / Rutas\n(Ej: Delivery, Marketing)]:::page

    Main -->|Inyecta appState| Wrapper
    Wrapper -->|Props| Header
    Wrapper -->|Props| Sidebar
    Wrapper -->|Props| Footer
    Wrapper -->|Controla UI| Modals
    
    Wrapper -->|Mejora appState y sidebarWidth| App
    App -->|Pasa appState| Pages
```

---

## 🎭 El Director de Orquesta (`ContentWrapper.jsx`)

Es el componente más importante del Layout. Su función es "envolver" toda la aplicación y manejar el estado global de la interfaz de usuario.

### Sus Responsabilidades:
1. **Montaje del Layout:** Renderiza el `Header`, `Sidebar`, `Footer` y posiciona el `App.jsx` en el centro usando flexbox y espaciados dinámicos.
2. **Animaciones Base:** Usa `Framer Motion` y `FullScreenRipple` para dar las transiciones suaves (Apple-style) al cambiar de página.
3. **Whitelabel de Billeteras (Privy):** Sobrescribe los modales nativos de Privy por nuestros modales estéticos (`CustomLoginModal`, `CustomTransactionModal`, `CustomSignatureModal`). Inyecta en el `appState` los nuevos *handlers* de firma y transacciones.
4. **Calculador de Espacios:** Lee el ancho dinámico del `Sidebar` (ej: 80px) y se lo pasa a `App.jsx` para que las páginas interiores puedan recalcular márgenes si es necesario (`contentPaddingLeft`).

---

## 🛣️ Enrutamiento Dinámico (`App.jsx`)

En lugar de tener un archivo gigante con un `<Route>` estático por cada página, Vanellix utiliza **Enrutamiento Basado en Configuración**.

- Lee el archivo `pages/pagesConfig.js`.
- Por cada objeto allí, genera un `<Route>`.
- Inyecta `Helmet` (Metadata SEO e info de pestaña dinámica).
- **Control de Acceso (RBAC):** Verifica la propiedad `minRoleLevel` de la página contra el `appState.roleLevel`. Si el empleado no tiene el rango necesario, `App.jsx` bloquea la renderización y muestra el componente de "Fallo" (Fallback).
- **Propagación:** Si la ruta es válida, renderiza el componente y le inyecta `<Component appState={appState} sidebarWidth={sidebarWidth} />`.

---

## 🪟 Los Componentes Satélites (UI Shell)

### 1. `Header.jsx`
- Contiene el botón de menú móvil, el avatar del usuario, la red Web3 conectada y el saldo rápido.
- Gatilla el modal de Billetera (`WalletModal`).

### 2. `Sidebar.jsx`
- El menú lateral izquierdo de navegación principal.
- Posee estados anidados y transiciones suaves (`Framer Motion`) para expandirse o contraerse.

### 3. `Footer.jsx`
- Aloja configuraciones de usabilidad globales que no necesitan estar arriba.
- Contiene los *toggles* para cambiar el idioma (`i18n`) y cambiar el tema (Light/Dark Mode).

### 4. Modales Globales (`WalletModal.jsx`, etc.)
- Son componentes anclados en el nivel superior (en el `ContentWrapper`) para asegurar que aparezcan por encima de todo (`z-index` altísimo).
- Tienen sus propios *Hooks* (como `useModalWallet`, `usePriceTokens`) para consultar en tiempo real saldos de Polygon y precios sin hacer re-renderizar toda la aplicación principal.

---

## 📦 ¿Cómo usar `appState` en una página?

Cualquier página dentro de la carpeta `src/pages/` ya recibe `appState` mágicamente gracias a `App.jsx`.

**Ejemplo de uso en un componente Page:**
\`\`\`javascript
const MarketingPage = ({ appState, sidebarWidth }) => {
  const { account, roleLevel, t, signTxData } = appState;

  const firmarContrato = async () => {
    // Esto llamará al CustomSignatureModal (nuestro modal bonito) en vez del de Privy
    const signature = await signTxData("Firmo que soy empleado de nivel " + roleLevel);
  };

  return (
    <div style={{ paddingLeft: sidebarWidth }}>
      <h1>{t('marketing.title')}</h1>
      <p>Bienvenido, wallet {account}</p>
    </div>
  );
};
\`\`\`
