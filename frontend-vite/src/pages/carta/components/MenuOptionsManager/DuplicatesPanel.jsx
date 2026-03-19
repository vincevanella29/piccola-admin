// DuplicatesPanel — scan and clean duplicate product codes across groups.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, ShieldAlert, ScanSearch, Trash2,
  Loader2, AlertTriangle, CheckCircle,
} from 'lucide-react';
import * as cartaApi from '../../../../utils/cartaData';

const DuplicatesPanel = ({ token, account, onRefresh }) => {
  const [open, setOpen]         = useState(false);
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult]     = useState(null);
  const [msg, setMsg]           = useState(null);

  const scan = async () => {
    setScanning(true); setMsg(null);
    try { setResult(await cartaApi.fetchDuplicateOptionCodigos({ token, account })); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setScanning(false); }
  };

  const handleRemove = async () => {
    if (!result) return;
    const extra = result.total_extra_occurrences;
    if (!confirm(`¿Eliminar ${extra} valores duplicados? Se conservará la primera ocurrencia de cada código.`)) return;
    setRemoving(true); setMsg(null);
    try {
      const res = await cartaApi.removeDuplicateOptionValues({ token, account, dryRun: false });
      setMsg({ type: 'success', text: `✓ ${res.deleted_count} valores eliminados` });
      setResult(null); onRefresh();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    finally { setRemoving(false); }
  };

  const dupEntries = result ? Object.entries(result.duplicates || {}) : [];
  const hasDups    = result && result.total_duplicate_codigos > 0;

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${
      hasDups
        ? 'border-light-error/30 dark:border-dark-error/30 bg-light-error/5 dark:bg-dark-error/5'
        : 'border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface'
    }`}>
      {/* Toggle header */}
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/20 transition-colors"
        onClick={() => { setOpen(o => !o); if (!open && !result) scan(); }}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            hasDups ? 'bg-light-error/10 dark:bg-dark-error/10' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary'
          }`}>
            <ShieldAlert className={`w-4 h-4 ${hasDups ? 'text-light-error dark:text-dark-error' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Duplicados en grupos</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
              {result
                ? hasDups
                  ? `${result.total_duplicate_codigos} códigos duplicados — ${result.total_extra_occurrences} valores extra`
                  : '✅ Sin duplicados'
                : 'Un producto solo puede estar en un grupo a la vez'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasDups && (
            <span className="px-1.5 py-0.5 rounded-full bg-light-error dark:bg-dark-error text-white text-[10px] font-bold">
              {result.total_duplicate_codigos}
            </span>
          )}
          {open ? <ChevronDown className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                 : <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-light-border dark:border-dark-border">
            <div className="px-4 py-4 space-y-3">
              {/* Alert */}
              {msg && (
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border ${
                  msg.type === 'success'
                    ? 'bg-light-success/5 dark:bg-dark-success/5 text-light-success dark:text-dark-success border-light-success/20 dark:border-dark-success/20'
                    : 'bg-light-error/5 dark:bg-dark-error/5 text-light-error dark:text-dark-error border-light-error/20 dark:border-dark-error/20'
                }`}>
                  {msg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={scan} disabled={scanning}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:border-light-accent dark:hover:border-dark-accent hover:text-light-accent dark:hover:text-dark-accent transition-all disabled:opacity-50">
                  {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
                  {scanning ? 'Escaneando…' : 'Re-escanear'}
                </button>
                {hasDups && (
                  <button onClick={handleRemove} disabled={removing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-light-error dark:bg-dark-error text-white text-xs font-bold hover:bg-light-error-hover dark:hover:bg-dark-error-hover transition-colors disabled:opacity-50 active:scale-[0.97]">
                    {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    {removing ? 'Eliminando…' : `Eliminar ${result.total_extra_occurrences} duplicados`}
                  </button>
                )}
              </div>

              {/* Duplicates list */}
              {dupEntries.length > 0 && (
                <div className="rounded-xl border border-light-error/20 dark:border-dark-error/20 overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[100px_1fr_1fr_60px] gap-1 px-3 py-2 bg-light-error/5 dark:bg-dark-error/5 border-b border-light-error/15 dark:border-dark-error/15">
                    <span className="text-[10px] font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Código</span>
                    <span className="text-[10px] font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Nombre</span>
                    <span className="text-[10px] font-bold text-light-error dark:text-dark-error uppercase tracking-wider">Grupo</span>
                    <span className="text-[10px] font-bold text-light-error dark:text-dark-error uppercase tracking-wider text-center">#</span>
                  </div>
                  <div className="divide-y divide-light-border/30 dark:divide-dark-border/30">
                    {dupEntries.map(([codigo, entries]) => (
                      <div key={codigo} className="grid grid-cols-[100px_1fr_1fr_60px] gap-1 px-3 py-2 items-center hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/15 transition-colors">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error truncate">{codigo}</span>
                        <span className="text-xs text-light-text-primary dark:text-dark-text-primary truncate">{entries[0]?.value_name || '—'}</span>
                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">{entries[0]?.option_name}</span>
                        <span className="text-center">
                          <span className="px-1.5 py-0.5 rounded-full bg-light-error dark:bg-dark-error text-white text-[10px] font-bold">{entries.length}×</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result && result.total_duplicate_codigos === 0 && (
                <div className="flex items-center gap-2 text-light-success dark:text-dark-success text-xs font-medium">
                  <CheckCircle className="w-4 h-4" /> Sin duplicados — todo limpio
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DuplicatesPanel;
