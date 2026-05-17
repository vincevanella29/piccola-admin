# Vanellix Piccola: Interfaz de Red (API Layer) 🛰️

Bienvenido a la capa de enrutamiento y controladores del Hub Administrativo (Vanellix Admin). 
Este directorio (`/apis`) es la frontera pública y privada del sistema. Aquí se reciben todas las peticiones HTTP/WebSocket, pero **bajo ninguna circunstancia se debe implementar lógica de negocio compleja aquí**.

> **🌟 EL MANDATO DE LA API LIMPIA (THE CLEAN API MANDATE)**  
> Todo archivo dentro de \`/apis\` debe actuar exclusivamente como un **Controlador/Enrutador (Router)**. Su única responsabilidad es:
> 1. Validar la autenticación (Web3 Session / Dilithium).
> 2. Validar los permisos de acceso (RBAC - Roles).
> 3. Recibir y validar el Payload de entrada (Pydantic).
> 4. **Delegar el trabajo pesado** a un \`Service\`, \`Engine\` o \`Util\`.
> 5. Retornar una respuesta JSON estandarizada.

---

## 🏗️ Arquitectura Basada en Dominios (Domain-Driven)

Para mantener el código mantenible a medida que el ecosistema de La Piccola crece, los endpoints están agrupados lógicamente por "Dominio de Negocio", reflejando exactamente la barra lateral (Sidebar) del panel de administración:

- 🍕 **\`/delivery\`**: Flujo operativo de Delivery (Órdenes, Chat con Cliente, Repartidores, Despacho, Webhooks).
- 📢 **\`/marketing\`**: Comunicaciones salientes (Push FCM, Emails, Chat de Comunidad B2B/Staff, Automation Rules).
- 💳 **\`/finance\`**: Gestión de caja, cierres, gastos, comisiones de venta y reembolsos.
- 👥 **\`/team\`** & **\`/mi_ficha\`**: Recursos Humanos, registro de empleados, asistencia, méritos y sueldos.
- 🍽️ **\`/restaurant\`** & **\`/carta\`**: Sincronización del catálogo público, control de stock y banners promocionales.
- ⚙️ **\`/admin\`**: Configuraciones núcleo, gestión de roles, API Keys (Dilithium) y Hub de satélites.
- 📈 **\`/conversion_tracker\`**: Inyección y orquestación de Meta Pixel y GA4 en el ecosistema.

---

## ⚙️ Inyección de Motores (Engines & Services)

La magia ocurre cuando nuestras APIs limpias consumen los motores centrales del sistema. **Nunca re-inventes la rueda en una ruta**. Si la ruta necesita pensar, debe llamar a un experto:

### 1. Motor de Inteligencia (La Nonna Engine)
**Ubicación:** \`utils.bot.engine\`
Cuando una API necesita procesar lenguaje natural, clasificar un ticket o auto-responder un chat, delega la tarea a "La Nonna".
\`\`\`python
# Ejemplo en apis/delivery/delivery_chat.py
from utils.bot.engine import LaNonnaEngine

response = await LaNonnaEngine.process_message(order_data, user_text)
\`\`\`

### 2. Motor de Automatización (Automation Engine)
**Ubicación:** \`services.automation_engine\`
Cualquier API que ejecute un evento importante (ej: *Pedido Entregado*, *Mensaje de Chat Enviado*, *Usuario Registrado*) debe reportarlo al Automation Engine. Él decidirá, basándose en reglas configurables en el panel, si debe enviar un Email o una Notificación Push.
\`\`\`python
# Ejemplo en apis/delivery/orders.py
from services.automation_engine import trigger_event

await trigger_event("order_status_change", "customers", payload={...})
\`\`\`

### 3. Sincronización Hub-and-Spoke (Dilithium Crypto)
**Ubicación:** \`utils.vanellix_crypto\`
Cuando la API de Administración necesita comunicarse con los satélites (Backend de Delivery, Backend de Carta), o viceversa, se utiliza estrictamente el protocolo criptográfico Dilithium.
\`\`\`python
from utils.vanellix_crypto import verify_dilithium_request

@router.post("/webhook")
async def secure_webhook(request: Request, provider: dict = Depends(verify_dilithium_request)):
    # Petición garantizada, firmada asimétricamente
\`\`\`

---

## 🔒 Control de Acceso Estricto (RBAC)

Las APIs Administrativas operan bajo un modelo de "Confianza Cero" (Zero Trust). Toda ruta que mute estado (POST, PUT, DELETE) o lea información sensible debe estar fortificada.

1. **\`verify_session\`**: Verifica la firma Web3 de la Wallet del empleado.
2. **\`require_admin_level\`**: Comprueba contra la base de datos de empleados que la Wallet tiene el Rango/Cargo específico para ejecutar esa acción.

\`\`\`python
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

@router.delete("/gastos/{id}")
async def delete_gasto(id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "finance") # <--- Bloquea al instante si no es financiero o Gerente
    ...
\`\`\`

---

## 🛠️ Resumen de Reglas de Desarrollo
1. **Evita la lógica spaguetti:** Si tu función de ruta (ej: \`@router.post\`) tiene más de 50 líneas, es una señal de que necesitas mover lógica a \`services/\` o \`utils/\`.
2. **Respuestas Predecibles:** Retorna siempre un JSON con estructuras claras (idealmente Pydantic Models) y no arrojes HTTP 500 para errores de validación de usuario (usa 400).
3. **La Base de Datos:** Las llamadas directas a MongoDB (\`db.collection\`) están permitidas en la API solo para operaciones CRUD simples (Leer, Insertar, Actualizar). Transacciones complejas deben encapsularse.
4. **Timezones:** Usa SIEMPRE \`get_chile_time()\` de \`utils.time_utils\`. Nunca uses \`datetime.utcnow()\`.
