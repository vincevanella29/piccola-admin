# 📄 Pages Architecture: Enrutamiento Dinámico

Bienvenido a la capa de vistas (`pages/`) del Frontend Administrativo.
A diferencia de las aplicaciones React tradicionales donde mantienes un archivo `Routes.jsx` gigante, Vanellix utiliza **Auto-Descubrimiento de Rutas (Auto-Discovery)** a través de Vite.

Cada carpeta aquí (ej: `delivery/`, `marketing/`, `chat/`) representa un dominio visual.

---

## 🧭 ¿Cómo funciona el Auto-Descubrimiento? (`pagesConfig.js`)

El archivo `pagesConfig.js` es el motor del enrutamiento. Utiliza la función de Vite `import.meta.glob('../pages/**/*.jsx')` para escanear recursivamente todos los archivos de esta carpeta.

### 1. El Objeto `pageMetadata`
Para que un componente se convierta automáticamente en una ruta accesible (y aparezca en el `Sidebar`), el archivo `.jsx` **DEBE** exportar una constante llamada `pageMetadata`.

**Ejemplo de un archivo de Página (`pages/finance/FinanceApp.jsx`):**
\`\`\`javascript
export const pageMetadata = {
  path: '/app/finance',
  label: 'finance.title', // Llave de traducción (i18n)
  category: 'finance', // Ubicación en el Sidebar
  minRoleLevel: 5, // 🔒 RBAC: Solo nivel 5+ puede entrar
  order: 1,
  icon: 'FaMoneyBillWave',
  description: 'Módulo de finanzas y cierres de caja'
};

const FinanceApp = ({ appState, sidebarWidth }) => {
  return <div>Finanzas</div>;
};
export default FinanceApp;
\`\`\`

### 2. Compilación del Árbol
Al arrancar, `pagesConfig.js` toma todos los `pageMetadata` encontrados, los mezcla con `navigationLinks.json` (rutas externas o hardcodeadas), y construye un arreglo gigante (`pagesMetadata`).
Ese arreglo es consumido por:
- `App.jsx` para generar los `<Route>` dinámicamente.
- `Sidebar.jsx` para pintar los botones de navegación.

---

## 🗂️ Ordenamiento de Menús (`categoryOrder.json`)

¿Cómo sabe el `Sidebar` en qué orden mostrar las categorías (Delivery, Marketing, Finanzas)?
El archivo `categoryOrder.json` dicta la jerarquía visual de la aplicación.

\`\`\`json
{
  "delivery": {
    "order": 1,
    "icon": "FaMotorcycle"
  },
  "marketing": {
    "order": 2,
    "icon": "FaBullhorn"
  }
}
\`\`\`
Si agregas una nueva categoría en el `pageMetadata` de tu vista, debes asegurarte de registrarla aquí para que tenga un ícono padre y una posición correcta en el menú.

---

## 🔍 SEO y Títulos Dinámicos (`metadataUtils.js`)

Para mantener el estándar "Apple-style", cada vez que cambias de pestaña, el título del navegador y el SEO (`<Helmet>`) cambian suavemente.

`metadataUtils.js` se encarga de:
1. Interceptar la URL actual.
2. Buscar el `pageMetadata` correspondiente.
3. Traducir el `label` usando `i18n` (ej: "finance.title" -> "Finanzas").
4. Formatear el título a: `Finanzas | Vanellix Admin`.
5. Si la página es dinámica (ej: un menú específico), inyectar los metadatos exactos de ese producto.

---

## 🛠️ Creando una Página Nueva (Paso a Paso)

Si necesitas crear un módulo nuevo en Vanellix (ej: "Cámaras de Seguridad"):

1. Crea la carpeta `pages/cameras/` y el archivo `CamerasApp.jsx`.
2. Exporta el componente por defecto (`export default CamerasApp`).
3. Exporta la constante `pageMetadata` con tu `path: '/app/cameras'`.
4. Define el `minRoleLevel` para proteger la ruta de empleados sin rango.
5. (Opcional) Si usas una categoría nueva, regístrala en `categoryOrder.json`.
6. **¡Listo!** Refresca el navegador y el botón aparecerá mágicamente en el menú lateral, con la ruta protegida y el SEO configurado.
