# 👵 La Nonna Engine: Arquitectura de Inteligencia Artificial

Bienvenido a las entrañas de **La Nonna**, el motor de inteligencia artificial central de Vanellix.
Este sistema NO es un simple chatbot de Q&A. Es un **Agente Resolutivo (LLM Router)** construido sobre la API de X.AI (Grok-2) que entiende las consultas de los usuarios, verifica sus permisos (RBAC), extrae entidades matemáticas (Filtros), ejecuta consultas complejas a MongoDB y luego sintetiza los datos crudos en lenguaje natural.

Todo está diseñado para ser **modular, dinámico y dictatorial**.

---

## 🗂️ Estructura del Motor

El motor está dividido lógicamente en dominios operativos. Cada subcarpeta (ej: `clubnonna`, `consumos`, `delivery`) actúa como un "plugin" independiente para La Nonna.

- 🤖 **`engine.py`**: El cerebro maestro. Intercepta todos los mensajes, resuelve el RBAC, rutea la intención (Intent Routing), invoca filtros y consolida respuestas.
- ⚙️ **`common/`**: Contiene utilidades compartidas:
  - `filters.py`: El sistema de **Extracción de Entidades por LLM**. Extrae fechas, nombres, ruts y códigos de las frases de los usuarios de forma natural.
  - `common.py`: Funciones base de comunicación con la API de Grok.
- 📦 **Carpetas de Dominio (`consumos`, `delivery`, `historynonna`, etc.)**:
  - `*_spec.py`: Declaran qué Intenciones (`Intents`) existen, qué roles se necesitan para ejecutarlas, y con qué filtros se relacionan.
  - `*_handlers.py`: La lógica dura que consulta MongoDB usando los filtros obtenidos.

---

## 🚀 ¿Cómo funciona el ciclo de vida de una consulta? (Workflow)

Cuando un usuario dice: *"¿Cuáles fueron los gastos de luz en Bellavista ayer?"*

1. **Recepción e Identidad (`engine.py`)**: Se recibe el texto y se obtiene el `wallet` / `privy_id` del usuario (parseado desde el contexto oculto de la UI).
2. **Autorización (RBAC)**: Se calcula el `role_level` (1-7) del empleado. Si no tiene nivel, el motor lo bloquea instantáneamente ("Walled Garden").
3. **Clasificación de Intención (`Intent Routing`)**: Grok evalúa la frase y decide que la intención es `gastos_search`.
4. **Validación de Acceso**: `engine.py` revisa el `gastos_spec.py` y verifica si el nivel de acceso del empleado es suficiente. Si es nivel 2 pero se requiere nivel 4, se le deniega el acceso automáticamente (o se redirige a un intent de menor privilegio).
5. **Filtros (`common/filters.py`)**: Grok lee el texto de nuevo y extrae el JSON de filtros: `{"location": "Bellavista", "date_range": "ayer", "query": "luz"}`.
6. **Ejecución (Handler)**: El handler de `gastos` recibe estos filtros limpios, ejecuta los aggregates en MongoDB y retorna un JSON con los datos (ej: `{"total": 45000, "rows": [...]}`).
7. **Síntesis (`_attach_summary`)**: El JSON crudo se resume (para no saturar a Grok) y se envía junto con la frase original. Grok responde: *"Mio caro, los gastos de luz en Bellavista ayer fueron de $45.000"*.

---

## 🧹 Los Filtros (`common/filters.py`) y su Reutilización

El poder real de La Nonna está en **no tener que escribir Regex complejos**.
Si quieres crear una nueva función que necesite buscar por fecha, ¡no escribas un parseador! Reutiliza un filtro existente o declara uno nuevo.

**Ejemplo de declaración de Filtro en `filters.py`:**
\`\`\`python
# En common/filters.py
elif intent == "gastos_search":
    prompt = (
        "Extrae: 'location' (sucursal), 'date_range' (rango de fechas), 'query' (término a buscar).\n"
        f"Texto: {text}"
    )
\`\`\`

**Ejemplo de inyección en tu Spec (`_spec.py`):**
\`\`\`python
ENGINE_ROUTES = {
    "gastos_search": {
        "intent": "gastos_search",
        "kind": "filter_handler",
        "filter_key": "gastos_search", # Llama al filtro de common/filters.py
        "filter_to_context": {"__full__": "filtros_gastos"}, # Inyecta los resultados en context.user_data
        "handler": "utils.bot.gastos.gastos_handlers:buscar_gastos",
        "access": {"min_role_level": 5} # Solo niveles 5, 6 y 7
    }
}
\`\`\`

---

## 🌐 Ejemplos de Inyección en las APIs

La Nonna está diseñada para ser llamada con una sola línea de código desde los endpoints de FastAPI (`apis/`).

### 1. Delivery Chat (El Walled Garden) - `/apis/delivery/delivery_chat.py`
En el chat de delivery el usuario no es empleado, es el cliente final. Aquí La Nonna usa su "Delivery Persona" (Habla como abuela italiana) y se le inyecta el contexto de la orden.
\`\`\`python
from utils.bot.engine import chat_complete

# order_context trae los ítems del pedido, el estado del GPS y los datos del repartidor
reply = await chat_complete(
    messages=request.messages, 
    delivery_mode=True,         # Fuerza el Modo Cliente (Salta RBAC)
    order_context=order_context # Inyecta todo el estado del Pedido
)
# La Nonna responderá algo como: "Bambino, tu pizza va en camino con el repartidor Juan!"
\`\`\`

### 2. Marketing / AI Chat (Modo Admin) - `/apis/marketing/chat.py`
Para el chat de Inteligencia del Hub. Aquí el RBAC está completamente activo.
\`\`\`python
from utils.bot.engine import chat_complete

# Los permisos y roles se leen automáticamente del primer mensaje "system" que envía el frontend
reply = await chat_complete(
    messages=request.messages,
    delivery_mode=False
)
\`\`\`

### 3. Community (Modo Resumen) - `/apis/marketing/community.py`
Podemos usar a La Nonna sin la función `chat_complete`, simplemente llamando a `ask_grok` de `common` para generar resúmenes de chats grupales.
\`\`\`python
from utils.bot.common.common import ask_grok

prompt = f"Resume esta conversación de los trabajadores: {chat_history}"
resumen = await ask_grok(prompt)
\`\`\`

---

## ⚠️ Reglas de Oro de La Nonna
1. **Rendimiento Asíncrono:** Todas las llamadas a Grok y a MongoDB en los handlers **DEBEN** ser asíncronas y estar envueltas en `_with_timeout` dentro del engine para evitar bloquear el Event Loop de FastAPI.
2. **Contexto Limpio:** Nunca pases colecciones enteras a Grok. Usa la función `_attach_summary` en el engine para pre-filtrar los JSON pesados antes de pedir la síntesis.
3. **No Parches el Engine:** Si quieres que La Nonna entienda una intención nueva, crea una carpeta nueva, haz un `_spec.py` y define tus filtros. El engine (`engine.py`) descubrirá tus rutas automáticamente.
