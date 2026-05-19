import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaSpinner, FaGlobe } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  fetchOutgoingWebhooks, createOutgoingWebhook, updateOutgoingWebhook,
  deleteOutgoingWebhook,
} from '../../../utils/deliveryData';
import WebhookForm from './webhooks/WebhookForm';
import WebhookCard from './webhooks/WebhookCard';
import WebhookPlayground from './webhooks/WebhookPlayground';

const WebhooksTab = ({ appState }) => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPlayground, setShowPlayground] = useState(null); // stores the specific webhook to test
  const [editing, setEditing] = useState(null);
  const auth = { token: appState?.token, walletAddress: appState?.account };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetchOutgoingWebhooks(auth); setWebhooks(r?.webhooks || []); }
    catch { /* */ } finally { setLoading(false); }
  }, [appState?.token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => { await createOutgoingWebhook({ ...auth, data }); toast.success('✅ Webhook creado'); setShowForm(false); load(); };
  const handleUpdate = async (data) => { await updateOutgoingWebhook({ ...auth, webhookId: editing._id, data }); toast.success('✅ Actualizado'); setEditing(null); load(); };
  const handleDelete = async (id) => { if (!confirm('¿Eliminar?')) return; await deleteOutgoingWebhook({ ...auth, webhookId: id }); toast.success('Eliminado'); load(); };
  const handleToggle = async (wh) => { await updateOutgoingWebhook({ ...auth, webhookId: wh._id, data: { active: !wh.active } }); load(); };

  if (loading) return <div className="flex items-center justify-center py-20"><FaSpinner className="animate-spin text-matrix-green" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2"><FaGlobe className="text-matrix-green" /> Webhooks</h3>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Reenvía órdenes a POS, ERP u otros sistemas</p>
        </div>
        {!showForm && !editing && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 bg-matrix-green text-black rounded-xl text-xs font-bold hover:bg-matrix-green/80 transition-colors"><FaPlus size={10} /> Nuevo</button>
        )}
      </div>

      {showPlayground && <WebhookPlayground appState={appState} webhook={showPlayground} onClose={() => setShowPlayground(null)} />}
      {showForm && <WebhookForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}
      {editing && <WebhookForm webhook={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}

      {!webhooks.length && !showForm ? (
        <div className="text-center py-16 border border-dashed border-light-border/20 dark:border-dark-border/20 rounded-xl">
          <FaGlobe size={28} className="mx-auto text-light-text-secondary dark:text-dark-text-secondary mb-3 opacity-30" />
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">Sin webhooks</p>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">Crea uno para enviar órdenes al POS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <WebhookCard key={wh._id} wh={wh} onToggle={handleToggle} onPlayground={setShowPlayground}
              onEdit={(w) => { setEditing(w); setShowForm(false); }} onDelete={handleDelete}
              appState={appState} />
          ))}
        </div>
      )}
    </div>
  );
};

export default WebhooksTab;
