// WebhooksTab.jsx — Outgoing webhook configuration for delivery orders
import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaPaperPlane, FaEdit, FaToggleOn, FaToggleOff, FaChevronDown, FaChevronUp, FaSpinner, FaCheckCircle, FaTimesCircle, FaGlobe, FaCopy } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  fetchOutgoingWebhooks, createOutgoingWebhook, updateOutgoingWebhook,
  deleteOutgoingWebhook, testOutgoingWebhook, fetchWebhookLogs, previewWebhookTemplate,
} from '../../../utils/deliveryData';

const EVENTS = [
  { key: 'order.created', label: '📦 Orden creada', desc: 'Cuando llega un pedido nuevo' },
  { key: 'order.status_changed', label: '🔄 Cambio de estado', desc: 'Cualquier transición de estado' },
  { key: 'order.delivered', label: '✅ Entregado', desc: 'Cuando se marca como entregado' },
  { key: 'order.cancelled', label: '❌ Cancelado', desc: 'Cuando se cancela un pedido' },
];

const AVAILABLE_VARS = [
  { path: 'order._id', desc: 'ID interno' },
  { path: 'order.order_number', desc: 'Número de orden' },
  { path: 'order.customer.name', desc: 'Nombre cliente' },
  { path: 'order.customer.email', desc: 'Email cliente' },
  { path: 'order.customer.phone', desc: 'Teléfono' },
  { path: 'order.customer.address', desc: 'Dirección' },
  { path: 'order.items', desc: 'Array de productos' },
  { path: 'order.total_amount', desc: 'Total' },
  { path: 'order.delivery_fee', desc: 'Costo envío' },
  { path: 'order.status', desc: 'Estado actual' },
  { path: 'order.order_type', desc: 'delivery/pickup' },
  { path: 'order.location_name', desc: 'Sucursal' },
  { path: 'order.notes', desc: 'Notas del cliente' },
  { path: 'order.payment_method', desc: 'Método de pago' },
  { path: 'order.created_at', desc: 'Fecha creación' },
  { path: 'event', desc: 'Tipo de evento' },
];

const DEFAULT_TEMPLATE = `{
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

// ── Webhook Modal ──────────────────────────────────────────────
const WebhookModal = ({ webhook, onClose, onSave, appState }) => {
  const [name, setName] = useState(webhook?.name || '');
  const [url, setUrl] = useState(webhook?.url || '');
  const [events, setEvents] = useState(webhook?.events || ['order.created']);
  const [template, setTemplate] = useState(webhook?.payload_template || DEFAULT_TEMPLATE);
  const [secret, setSecret] = useState('');
  const [headers, setHeaders] = useState(webhook?.headers || {});
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');
  const [retryCount, setRetryCount] = useState(webhook?.retry_count ?? 3);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showVars, setShowVars] = useState(false);

  const toggleEvent = (e) => setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  const addHeader = () => {
    if (!headerKey.trim()) return;
    setHeaders(prev => ({ ...prev, [headerKey.trim()]: headerVal }));
    setHeaderKey(''); setHeaderVal('');
  };

  const removeHeader = (k) => setHeaders(prev => { const n = { ...prev }; delete n[k]; return n; });

  const handlePreview = async () => {
    try {
      const res = await previewWebhookTemplate({
        token: appState?.token, walletAddress: appState?.account,
        template, event: events[0] || 'order.created',
      });
      setPreview(res?.result ? JSON.stringify(res.result, null, 2) : res?.error || 'Error');
    } catch (e) { setPreview(`Error: ${e.message}`); }
  };

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) return toast.error('Nombre y URL son obligatorios');
    if (!events.length) return toast.error('Selecciona al menos un evento');
    setSaving(true);
    try {
      const data = { name, url, events, payload_template: template || null, headers, retry_count: retryCount };
      if (secret) data.secret = secret;
      await onSave(data);
      onClose();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary';
  const labelCls = 'block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
          <FaGlobe className="text-matrix-green" /> {webhook ? 'Editar Webhook' : 'Nuevo Webhook'}
        </h2>

        {/* Name + URL */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Nombre</label><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="POS Piccola" /></div>
          <div><label className={labelCls}>URL destino</label><input className={inputCls} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://pos.ejemplo.com/webhook" /></div>
        </div>

        {/* Events */}
        <div>
          <label className={labelCls}>Eventos</label>
          <div className="grid grid-cols-2 gap-2">
            {EVENTS.map(ev => (
              <button key={ev.key} onClick={() => toggleEvent(ev.key)}
                className={`px-3 py-2 rounded-xl border text-left text-xs transition-all ${events.includes(ev.key) ? 'bg-matrix-green/10 border-matrix-green/30 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 text-light-text-secondary'}`}>
                <span className="font-bold block">{ev.label}</span>
                <span className="text-[9px] text-light-text-tertiary">{ev.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Payload Template */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>Payload Template (JSON)</label>
            <div className="flex gap-2">
              <button onClick={() => setShowVars(!showVars)} className="text-[9px] text-matrix-green hover:underline">{showVars ? 'Ocultar' : 'Ver'} variables</button>
              <button onClick={handlePreview} className="text-[9px] text-blue-400 hover:underline flex items-center gap-1"><FaPaperPlane size={8} /> Preview</button>
            </div>
          </div>

          {showVars && (
            <div className="mb-2 p-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl grid grid-cols-2 gap-1">
              {AVAILABLE_VARS.map(v => (
                <button key={v.path} onClick={() => { navigator.clipboard.writeText(`{{${v.path}}}`); toast.success(`Copiado: {{${v.path}}}`); }}
                  className="flex items-center gap-1 text-[10px] text-light-text-secondary hover:text-matrix-green px-1.5 py-0.5 rounded hover:bg-matrix-green/5">
                  <FaCopy size={7} /> <code className="text-matrix-green">{`{{${v.path}}}`}</code> <span className="text-light-text-tertiary">— {v.desc}</span>
                </button>
              ))}
            </div>
          )}

          <textarea className={`${inputCls} font-mono text-xs h-48 resize-y`} value={template} onChange={e => setTemplate(e.target.value)}
            placeholder='{"event": "{{event}}", "data": {{order.items}}}' />

          {preview && (
            <div className="mt-2 p-3 bg-dark-surface-secondary rounded-xl">
              <p className="text-[9px] text-matrix-green font-bold mb-1">Preview del payload:</p>
              <pre className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{preview}</pre>
            </div>
          )}
        </div>

        {/* Security */}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Secret (HMAC-SHA256)</label><input className={inputCls} type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder={webhook ? '••• (dejar vacío para no cambiar)' : 'Opcional'} /></div>
          <div><label className={labelCls}>Reintentos</label><input className={inputCls} type="number" min={0} max={10} value={retryCount} onChange={e => setRetryCount(parseInt(e.target.value) || 0)} /></div>
        </div>

        {/* Custom Headers */}
        <div>
          <label className={labelCls}>Headers custom</label>
          {Object.entries(headers).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 mb-1">
              <code className="text-xs text-matrix-green">{k}</code><span className="text-light-text-tertiary text-xs">:</span>
              <span className="text-xs text-light-text-secondary flex-1 truncate">{v}</span>
              <button onClick={() => removeHeader(k)} className="text-red-400 hover:text-red-300"><FaTrash size={9} /></button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input className={`${inputCls} flex-1`} value={headerKey} onChange={e => setHeaderKey(e.target.value)} placeholder="Header name" />
            <input className={`${inputCls} flex-1`} value={headerVal} onChange={e => setHeaderVal(e.target.value)} placeholder="Value" />
            <button onClick={addHeader} className="px-3 py-2 bg-matrix-green/10 text-matrix-green rounded-xl text-xs font-bold hover:bg-matrix-green/20">+</button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-light-border/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-light-text-secondary hover:text-light-text-primary transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2.5 text-sm font-bold bg-matrix-green text-black rounded-xl hover:bg-matrix-green/80 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <FaSpinner className="animate-spin" size={11} /> : <FaCheckCircle size={11} />} {webhook ? 'Guardar cambios' : 'Crear webhook'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Log Panel ──────────────────────────────────────────────────
const LogPanel = ({ webhookId, appState }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchWebhookLogs({ token: appState?.token, walletAddress: appState?.account, webhookId });
        setLogs(res?.logs || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [webhookId]);

  if (loading) return <div className="py-3 text-center"><FaSpinner className="animate-spin text-matrix-green mx-auto" size={14} /></div>;
  if (!logs.length) return <p className="text-[10px] text-light-text-tertiary py-2 text-center">Sin envíos aún</p>;

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {logs.map((log, i) => (
        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${log.success ? 'bg-green-500/5' : 'bg-red-500/5'}`}>
          {log.success ? <FaCheckCircle className="text-green-500" size={9} /> : <FaTimesCircle className="text-red-400" size={9} />}
          <span className="font-mono text-light-text-secondary">{log.status_code}</span>
          <span className="text-light-text-tertiary">{log.event}</span>
          <span className="text-light-text-tertiary ml-auto">{log.elapsed_ms}ms</span>
          <span className="text-light-text-tertiary">{log.attempt > 1 ? `(retry ${log.attempt})` : ''}</span>
          <span className="text-light-text-tertiary">{new Date(log.created_at).toLocaleTimeString()}</span>
          {log.error && <span className="text-red-400 truncate max-w-[200px]">{log.error}</span>}
        </div>
      ))}
    </div>
  );
};

// ── Main Tab ───────────────────────────────────────────────────
const WebhooksTab = ({ appState }) => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const auth = { token: appState?.token, walletAddress: appState?.account };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOutgoingWebhooks(auth);
      setWebhooks(res?.webhooks || []);
    } catch {} finally { setLoading(false); }
  }, [appState?.token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => { await createOutgoingWebhook({ ...auth, data }); toast.success('✅ Webhook creado'); load(); };
  const handleUpdate = async (data) => { await updateOutgoingWebhook({ ...auth, webhookId: editing._id, data }); toast.success('✅ Webhook actualizado'); load(); };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este webhook?')) return;
    await deleteOutgoingWebhook({ ...auth, webhookId: id });
    toast.success('Webhook eliminado');
    load();
  };

  const handleToggle = async (wh) => {
    await updateOutgoingWebhook({ ...auth, webhookId: wh._id, data: { active: !wh.active } });
    toast.success(wh.active ? 'Webhook desactivado' : 'Webhook activado');
    load();
  };

  const handleTest = async (id) => {
    setTestingId(id);
    try {
      const res = await testOutgoingWebhook({ ...auth, webhookId: id });
      if (res?.success) toast.success(`✅ Test enviado — ${res.status_code} (${res.elapsed_ms}ms)`);
      else toast.error(`❌ Test falló: ${res?.error || res?.response_preview?.slice(0, 100)}`);
    } catch (e) { toast.error(e.message); }
    setTestingId(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><FaSpinner className="animate-spin text-matrix-green" size={20} /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaGlobe className="text-matrix-green" /> Webhooks de salida
          </h3>
          <p className="text-[10px] text-light-text-tertiary mt-0.5">Reenvía las órdenes automáticamente a sistemas externos (POS, ERP, etc.)</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-matrix-green text-black rounded-xl text-xs font-bold hover:bg-matrix-green/80 transition-colors">
          <FaPlus size={10} /> Nuevo webhook
        </button>
      </div>

      {/* Webhook list */}
      {!webhooks.length ? (
        <div className="text-center py-16 border border-dashed border-light-border/20 dark:border-dark-border/20 rounded-xl">
          <FaGlobe size={28} className="mx-auto text-light-text-tertiary mb-3" />
          <p className="text-sm text-light-text-secondary font-medium">Sin webhooks configurados</p>
          <p className="text-xs text-light-text-tertiary mt-1">Crea uno para enviar automáticamente las órdenes a tu POS u otro sistema</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh._id} className={`rounded-xl border p-4 transition-all ${wh.active ? 'bg-light-surface dark:bg-dark-surface border-light-border/10 dark:border-dark-border/10' : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border-light-border/5 opacity-60'}`}>
              {/* Top row */}
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(wh)} className="text-lg" title={wh.active ? 'Desactivar' : 'Activar'}>
                  {wh.active ? <FaToggleOn className="text-matrix-green" /> : <FaToggleOff className="text-light-text-tertiary" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{wh.name}</p>
                  <p className="text-[10px] text-light-text-tertiary font-mono truncate">{wh.url}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {wh.events?.map(ev => (
                    <span key={ev} className="px-1.5 py-0.5 bg-matrix-green/10 text-matrix-green text-[8px] font-bold rounded-md">{ev.split('.')[1]}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleTest(wh._id)} disabled={testingId === wh._id}
                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 transition-colors" title="Enviar test">
                    {testingId === wh._id ? <FaSpinner className="animate-spin" size={11} /> : <FaPaperPlane size={11} />}
                  </button>
                  <button onClick={() => { setEditing(wh); setModalOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-matrix-green/10 text-light-text-secondary hover:text-matrix-green transition-colors" title="Editar">
                    <FaEdit size={11} />
                  </button>
                  <button onClick={() => handleDelete(wh._id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-light-text-secondary hover:text-red-400 transition-colors" title="Eliminar">
                    <FaTrash size={11} />
                  </button>
                  <button onClick={() => setExpandedLogs(expandedLogs === wh._id ? null : wh._id)}
                    className="p-1.5 rounded-lg hover:bg-light-surface-secondary text-light-text-secondary transition-colors" title="Ver logs">
                    {expandedLogs === wh._id ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
                  </button>
                </div>
              </div>

              {/* Logs */}
              {expandedLogs === wh._id && (
                <div className="mt-3 pt-3 border-t border-light-border/10">
                  <LogPanel webhookId={wh._id} appState={appState} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <WebhookModal
          webhook={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={editing ? handleUpdate : handleCreate}
          appState={appState}
        />
      )}
    </div>
  );
};

export default WebhooksTab;
