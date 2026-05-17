# 🪝 Hooks Architecture: Lógica Reutilizable

Bienvenido a la capa de lógica de negocio del Frontend de Vanellix. 
La carpeta `src/hooks/` contiene todos los **Custom React Hooks** de la aplicación. Su objetivo principal es abstraer la complejidad (llamadas a la API, interacción con Web3/Blockchain, manejo de WebSockets) para que los Componentes Visuales (`src/pages/`) se mantengan limpios y se enfoquen solo en pintar la interfaz (Apple-style).

---

## 🚧 TAREA PENDIENTE: Refactorización por Dominios

> [!WARNING]
> **Refactorización en progreso:** Actualmente existe una gran cantidad de archivos planos en la raíz de `src/hooks/`. El objetivo arquitectónico es agrupar todos estos hooks en carpetas por **Tipos de Dominio**, reflejando exactamente la misma estructura que tiene el Backend en su carpeta `apis/`.

**Estado Actual:**
Ya hemos comenzado la migración con las carpetas:
- 📁 `chat/`
- 📁 `conversionTracker/`
- 📁 `delivery/`

**Próximos pasos (Refactor pendiente):**
Debemos mover el resto de los ~60 hooks sueltos a sus respectivas carpetas:
- 📁 `admin/` (Mover: `useAdminData`, `useApiKeysAdmin`, `useEmpresaAdmin`, `useWorkersApi`)
- 📁 `team/` & 📁 `mi_ficha/` (Mover: `useRolesAccess`, `useEmployeeUsers`, `useRegistroBiometrico`, `useMiFicha`)
- 📁 `merits/` (Mover: `useGamification`, `useDaoMeritocracy`, `useMeritRankings`, `useMeritSystem`)
- 📁 `finance/` (Mover: `useSwap`, `useAllowance`, `usePriceTokens`, `useWalletBalances`)
- 📁 `carta/` & 📁 `restaurant/` (Mover: `useCartaAdmin`, `useMenuSearch`, `useCentrosProduccion`, `useKDS`)

---

## 🧠 Categorías de Lógica

A pesar de que el refactor estructural está pendiente, funcionalmente los hooks operan bajo responsabilidades muy estrictas:

### 1. Web3 & Billeteras (Wallet Core)
Garantizan la conexión segura con la Blockchain y la custodia de llaves mediante Privy.
- **`useWallet.jsx`**: Conexión base.
- **`useCustomWallet.jsx`**: Sobrescribe los modales de Privy para usar nuestra UI Whitelabel (Apple-style) al firmar transacciones.
- **`useSwap.jsx` / `useAllowance.jsx`**: Lógica dura para interactuar con Uniswap V3 y aprobar gasto de tokens ERC-20.

### 2. Gamificación y DAO (El Ecosistema Interno)
Convierten la base de datos central en la meritocracia on-chain.
- **`useDaoMeritocracy.jsx`**: Emite las firmas o prepara los payloads para mintear Méritos (Tokens) vía Smart Contracts.
- **`useMeritRankings.jsx`**: Construye el Leaderboard (Ranking de Empleados) cruzando balances de billeteras con avatares de la base de datos.

### 3. Autenticación y RBAC (Acceso)
- **`useVanellixLogin.jsx`**: Orquesta el flujo de inicio de sesión de un empleado (Firma de Reto Criptográfico -> Emisión de Session JWT).
- **`useRolesAccess.jsx`**: Mantiene en caché y verifica el nivel de rol (`role_level`) del empleado conectado para permitir o denegar vistas y botones.

### 4. Comunicaciones y Tiempo Real
- **`useChatClient.jsx`**: Instancia y maneja los WebSockets de La Nonna y los clientes.
- **`useNotifications.jsx`**: Administra la suscripción y recepción de notificaciones Push (Firebase Cloud Messaging / Webpush).

---

## 🛠️ Reglas para Crear un Nuevo Hook

1. **Mantén el encapsulamiento:** Si una función de tu hook supera las 100 líneas, abstrae esa lógica pura en un archivo de la carpeta `src/utils/` e impórtala en tu hook.
2. **Caché Inteligente:** Utiliza `SWR` o manejos de estado en memoria para evitar saturar el backend con peticiones HTTP idénticas.
3. **Manejo de Errores Global:** En lugar de lanzar alertas molestas (`alert()`), usa el sistema global de notificaciones para enviar errores de red de forma sutil.
4. **Respeta la Estructura (Futura):** Si creas un hook nuevo, **no lo tires en la raíz**. Créalo dentro de la subcarpeta del dominio correspondiente (ej: `src/hooks/marketing/useMarketingAnalytics.jsx`).
