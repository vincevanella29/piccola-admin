# Universal Automation Engine & Plugin Architecture

El **Universal Automation Engine** de Vanellix Piccola está diseñado bajo una arquitectura de *Plugins* que permite la máxima flexibilidad, escalabilidad y, sobre todo, integración nativa con la **Inteligencia Artificial (La Nonna / Grok)**.

## Filosofía: Triggers Inteligentes (AI-First)

A diferencia de los motores de automatización tradicionales que solo reaccionan con condiciones binarias (`if estado == 'entregado'`), nuestra arquitectura permite que **cada Trigger sea un cerebro en sí mismo**. 

Al ser archivos Python independientes (`backend/services/automations/triggers/`), cada Trigger tiene la libertad absoluta de:
1. **Consumir APIs externas**: Obtener información de ventas del día, méritos de los empleados, o cruzar datos del POS (Punto de Venta).
2. **Razonar con Inteligencia Artificial**: Importar el motor de La Nonna (`utils.bot.engine`) y pasarle toda esa data cruda para que Grok la procese, resuma o la redacte de manera "bonita y humana".
3. **Inyectar Payload Dinámico**: Devolver esa respuesta estructurada por la IA para inyectarla automáticamente en las plantillas de Push Notifications o Mailing.

### Casos de Uso Esperados

- **Resumen Diario (Cron)**: Un trigger que se ejecuta una vez al día, recopila cuánto se vendió en el local, cuántos pedidos se hicieron por Delivery y cuántos clientes nuevos hay. Le pasa la data cruda a La Nonna (`ask_grok`), le pide que redacte un resumen ejecutivo amigable, y lo despacha por Email a los gerentes.
- **Notificaciones de Méritos Semanales**: Un trigger que revisa los méritos de los empleados. La Nonna analiza quién fue el empleado más destacado y redacta un Push de felicitación ultra-personalizado.
- **Engagement de Clientes Inactivos**: Un trigger que detecta clientes que no han comprado en 2 meses, cruza sus platos favoritos y le pide a La Nonna que genere un "Asunto" de email tentador y único para cada cliente.

## ¿Cómo Funciona la Estructura?

### 1. El Directorio de Plugins
Cada nuevo evento disparador se debe crear en la carpeta `triggers/`:
```text
backend/services/automations/triggers/
├── base_trigger.py           # Interfaz que todos los triggers deben seguir
├── order_status_change.py    # Trigger convencional
└── daily_ai_summary.py       # Ejemplo de Trigger con IA (La Nonna)
```

### 2. El Contrato de un Trigger
Todo plugin hereda de `BaseTrigger` y define su metadata (la cual el Frontend consume dinámicamente) y su función principal `evaluate()`.

```python
from typing import Dict, Any
from .base_trigger import BaseTrigger
from utils.bot.common.common import ask_grok # Integración con La Nonna

class DailyAISummaryTrigger(BaseTrigger):
    id = "daily_ai_summary"
    label = "Resumen de Ventas IA (Diario)"
    emoji = "🤖"
    segment = "employees"

    @classmethod
    async def evaluate(cls, rule: Dict[str, Any], payload: Dict[str, Any]) -> bool:
        # 1. Recopilar Data Cruda del POS / Delivery
        raw_data = payload.get("daily_sales", {})
        
        # 2. Razonar con La Nonna (Grok)
        prompt = f"Resume estas ventas del día para el administrador de manera ejecutiva: {raw_data}"
        ai_summary = await ask_grok(prompt)
        
        # 3. Inyectar la respuesta generada al payload para que llegue a la plantilla
        payload["ai_generated_content"] = ai_summary
        
        # Retornar True significa: "Sí, dispara el Push/Email con este payload"
        return True
```

### 3. El Motor Orquestador
`automation_engine.py` es ciego. No sabe nada de ventas, de IA o de pedidos. Solo lee la regla guardada en la base de datos, busca el Plugin correspondiente en la carpeta `triggers/`, y le dice: *"Toma el payload. ¿Deberíamos disparar esto?"*.

Si el Plugin retorna `True` (después de haber pensado y procesado la IA), el orquestador toma el `payload` resultante (ahora enriquecido con textos dinámicos generados por Grok) y se encarga del despacho técnico por FCM (Push) o SMTP (Email).

## Reglas de Desarrollo
1. **Nunca** "hardcodear" lógica específica en `automation_engine.py` ni en el Frontend (`React`).
2. Todo evento debe existir como un archivo independiente en `triggers/`.
3. El frontend siempre debe descubrir las opciones disponibles preguntándole a la API `GET /automations/config/triggers`.
4. Si un trigger necesita razonar, importa `utils.bot` libremente. El motor soportará la latencia necesaria para la IA.
