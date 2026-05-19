import React, { useState, useEffect } from 'react';
import { FaToggleOn, FaToggleOff, FaPlay, FaEdit, FaTrash, FaChevronDown, FaChevronUp, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { fetchWebhookLogs } from '../../../../utils/deliveryData';

const LogPanel = ({ webhookId, appState }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const r = await fetchWebhookLogs({ token: appState?.token, walletAddress: appState?.account, webhookId }); setLogs(r?.logs || []); }
      catch { /* */ } finally { setLoading(false); }
    })();
  }, [webhookId]);
  if (loading) return <div className="py-3 text-center"><FaSpinner className="animate-spin text-matrix-green mx-auto" size={12} /></div>;
  if (!logs.length) return <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary py-2 text-center">Sin envíos aún</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto">
      {logs.map((l, i) => (
        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] ${l.success ? 'bg-light-success/5 dark:bg-dark-success/5' : 'bg-light-error/5 dark:bg-dark-error/5'}`}>
          {l.success ? <FaCheckCircle className="text-light-success dark:text-dark-success" size={9} /> : <FaTimesCircle className="text-light-error dark:text-dark-error" size={9} />}
          <span className="font-mono text-light-text-secondary dark:text-dark-text-secondary">{l.status_code}</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">{l.event}</span>
          <span className="ml-auto text-light-text-secondary dark:text-dark-text-secondary">{l.elapsed_ms}ms</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">{new Date(l.created_at).toLocaleTimeString()}</span>
          {l.error && <span className="text-light-error dark:text-dark-error truncate max-w-[200px]">{l.error}</span>}
        </div>
      ))}
    </div>
  );
};

const WebhookCard = ({ wh, onToggle, onPlayground, onEdit, onDelete, appState }) => {
  const [showLogs, setShowLogs] = useState(false);
  return (
    <div className={`rounded-2xl border p-4 transition-all ${wh.active ? 'bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl border-light-border/10 dark:border-dark-border/10' : 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-light-border/5 dark:border-dark-border/5 opacity-50'}`}>
      <div className="flex items-center gap-3">
        <button onClick={() => onToggle(wh)} className="text-lg shrink-0">
          {wh.active ? <FaToggleOn className="text-matrix-green" /> : <FaToggleOff className="text-light-text-secondary dark:text-dark-text-secondary" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{wh.name}</p>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary font-mono truncate">{wh.url}</p>
        </div>
        <div className="flex items-center gap-1">
          {wh.events?.map(ev => <span key={ev} className="px-1.5 py-0.5 bg-matrix-green/10 text-matrix-green text-[8px] font-bold rounded-md">{ev.split('.')[1]}</span>)}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onPlayground(wh)} className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 transition-colors" title="Playground">
            <FaPlay size={10} />
          </button>
          <button onClick={() => onEdit(wh)} className="p-1.5 rounded-lg hover:bg-matrix-green/10 text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green transition-colors"><FaEdit size={11} /></button>
          <button onClick={() => onDelete(wh._id)} className="p-1.5 rounded-lg hover:bg-light-error/10 dark:hover:bg-dark-error/10 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"><FaTrash size={11} /></button>
          <button onClick={() => setShowLogs(!showLogs)} className="p-1.5 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors">
            {showLogs ? <FaChevronUp size={11} /> : <FaChevronDown size={11} />}
          </button>
        </div>
      </div>
      {showLogs && <div className="mt-3 pt-3 border-t border-light-border/10 dark:border-dark-border/10"><LogPanel webhookId={wh._id} appState={appState} /></div>}
    </div>
  );
};

export default WebhookCard;
