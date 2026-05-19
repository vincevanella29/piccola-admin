export const EVENTS = [
  { key: 'order.created', label: '📦 Orden creada' },
  { key: 'order.status_changed', label: '🔄 Cambio de estado' },
  { key: 'order.delivered', label: '✅ Entregado' },
  { key: 'order.cancelled', label: '❌ Cancelado' },
];

export const AVAILABLE_VARS = [
  { path: 'order.order_number', desc: 'Número de orden (string)' },
  { path: 'order.pos_order_id', desc: 'ID numérico único (para POS)' },
  { path: 'order.customer.name', desc: 'Nombre cliente' },
  { path: 'order.customer.email', desc: 'Email' },
  { path: 'order.customer.phone', desc: 'Teléfono' },
  { path: 'order.customer.address', desc: 'Dirección' },
  { path: 'order.items', desc: 'Productos anidados (array)' },
  { path: 'order.items_flattened', desc: 'Productos + Modificadores aplanados (array)' },
  { path: 'order.total_amount', desc: 'Total' },
  { path: 'order.delivery_fee', desc: 'Costo envío' },
  { path: 'order.status', desc: 'Estado (en)' },
  { path: 'order.translated_status', desc: 'Estado POS (es)' },
  { path: 'order.order_type', desc: 'delivery/pickup' },
  { path: 'order.location_name', desc: 'Sucursal' },
  { path: 'order.location_id', desc: 'ID sucursal' },
  { path: 'order.notes', desc: 'Notas' },
  { path: 'order.payment_method', desc: 'Método pago' },
  { path: 'order.created_at', desc: 'Fecha' },
  { path: 'event', desc: 'Tipo evento' },
];

export const DEFAULT_TEMPLATE = `{
  "event": "{{event}}",
  "order_number": "{{order.order_number}}",
  "customer": {
    "name": "{{order.customer.name}}",
    "phone": "{{order.customer.phone}}",
    "email": "{{order.customer.email}}",
    "address": "{{order.customer.address}}"
  },
  "items": {{order.items}},
  "total": {{order.total_amount}},
  "delivery_fee": {{order.delivery_fee}},
  "location": "{{order.location_name}}",
  "status": "{{order.status}}",
  "notes": "{{order.notes}}",
  "payment": "{{order.payment_method}}",
  "created_at": "{{order.created_at}}"
}`;

export const PICCOLA_POS_TEMPLATE = `{
  "order": {
    "order_id": "{{order.order_number}}",
    "hash": "",
    "first_name": "{{order.customer.name}}",
    "last_name": "",
    "email": "{{order.customer.email}}",
    "status": {
      "color": "#32CD32",
      "status_id": 2,
      "created_at": "{{order.created_at}}",
      "status_for": "order",
      "updated_at": "{{order.created_at}}",
      "status_name": "{{order.translated_status}}",
      "status_comment": "",
      "notify_customer": false
    },
    "telephone": "{{order.customer.phone}}",
    "order_date_time": "{{order.created_at}}",
    "order_date": "{{order.created_at}}",
    "order_time": "",
    "created_at": "{{order.created_at}}",
    "updated_at": "{{order.created_at}}",
    "order_type": "{{order.order_type}}",
    "payment": "{{order.payment_method}}",
    "user_agent": "Vanellix",
    "ip_address": "",
    "comment": "{{order.notes}}",
    "location_id": "{{order.location_id}}",
    "location": {
      "location_id": "{{order.location_id}}",
      "location_name": "{{order.location_name}}"
    },
    "customer_id": "",
    "customer": {
      "email": "{{order.customer.email}}",
      "last_name": "",
      "telephone": "{{order.customer.phone}}",
      "first_name": "{{order.customer.name}}",
      "customer_id": ""
    },
    "order_totals": [
      {"code": "subtotal", "title": "Sub Total", "value": {{order.total_amount}}, "priority": 1},
      {"code": "delivery", "title": "Envío", "value": {{order.delivery_fee}}, "priority": 2},
      {"code": "total", "title": "Total", "value": {{order.total_amount}}, "priority": 99}
    ]
  },
  "order_menus": {{order.items_flattened}},
  "order_totals": [
    {"code": "subtotal", "title": "Sub Total", "value": {{order.total_amount}}, "priority": 1},
    {"code": "delivery", "title": "Envío", "value": {{order.delivery_fee}}, "priority": 2},
    {"code": "total", "title": "Total", "value": {{order.total_amount}}, "priority": 99}
  ]
}`;

export const PRESETS = [
  { key: 'piccola', label: '🍕 POS Piccola', template: PICCOLA_POS_TEMPLATE, url: 'https://shopify.piccolaitalia.cl/api/ordenti_v2', events: ['order.created', 'order.status_changed'] },
  { key: 'generic', label: '📋 Genérico', template: DEFAULT_TEMPLATE, url: '', events: ['order.created'] },
  { key: 'custom', label: '⚙️ Custom', template: '', url: '', events: ['order.created'] },
];
