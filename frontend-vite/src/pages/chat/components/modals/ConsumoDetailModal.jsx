// src/pages/chat/components/modals/ConsumoDetailModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scale, Calendar, Thermometer, TrendingUp, Package, Activity } from 'lucide-react';

const numberFormat = (v) => {
  try {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? '');
    return n.toLocaleString('es-CL');
  } catch {
    return String(v ?? '');
  }
};

export default function ConsumoDetailModal({ open, payloadRow, onClose }) {
  if (!open) return null;
  
  const pr = payloadRow || {};
  const row = pr.row || {};
  const columns = pr.columns || [];
  const kpis = pr.kpis || [];
  const details = Array.isArray(row.detail_rows) ? [...row.detail_rows] : [];
  
  // Ordenar detalles por día
  details.sort((a, b) => String(a.dia || '').localeCompare(String(b.dia || '')));

  // Pares de agrupación (excluyendo 'value' que es la métrica principal)
  const groupPairs = columns
    .filter((c) => c && c.key && c.key !== 'value')
    .map((c) => ({ label: c.label || c.key, value: row[c.key] }));

  const metric = typeof row.value === 'number' ? row.value : Number(row.value || 0);
  const unitKpi = (kpis || []).find((k) => (k.label || '').toLowerCase() === 'unidad');
  const unit = (unitKpi && String(unitKpi.value || '').toLowerCase()) || '';

  const weatherIcon = (tag) => {
    const t = String(tag || '').toLowerCase();
    if (t.includes('nieve')) return '❄️';
    if (t.includes('lluvia')) return '🌧️';
    if (t.includes('soleado') || t.includes('despejado')) return '☀️';
    if (t.includes('nublado')) return '☁️';
    if (!t) return '—';
    return '⛅';
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="w-full max-w-lg bg-light-surface dark:bg-dark-surface rounded-[24px] shadow-modal overflow-hidden pointer-events-auto border border-light-border dark:border-dark-border flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* --- HEADER --- */}
              <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20">
                      <Scale size={20} />
                   </div>
                   <div>
                      <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">Detalle de Consumo</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-light-surface-tertiary/30 dark:bg-dark-surface-tertiary/30 text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide border border-light-border/50 dark:border-dark-border/50">
                           {unit || 'Unidades'}
                        </span>
                      </div>
                   </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* --- CONTENT (Scrollable) --- */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-light-surface-tertiary dark:scrollbar-thumb-dark-surface-tertiary">
                
                {/* 1. Context Grid & Metric */}
                <div className="grid grid-cols-2 gap-3">
                   {/* Datos de contexto (Familia, Insumo, etc) */}
                   {groupPairs.map((it, idx) => (
                     <div key={idx} className="p-3 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 truncate opacity-80">
                           {it.label}
                        </div>
                        <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate" title={it.value}>
                           {String(it.value ?? '-')}
                        </div>
                     </div>
                   ))}
                   
                   {/* Card Principal (Valor Total) */}
                   <div className="col-span-2 p-4 rounded-2xl bg-gradient-to-br from-light-surface-secondary to-light-surface dark:from-dark-surface-secondary dark:to-dark-surface border border-light-accent/20 dark:border-dark-accent/20 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                         <Package size={48} className="text-light-text-primary dark:text-dark-text-primary"/>
                      </div>
                      <div className="text-xs font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Consumo Total</div>
                      <div className="text-3xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                         {numberFormat(metric)} <span className="text-lg font-medium opacity-60">{unit}</span>
                      </div>
                   </div>
                </div>

                {/* 2. Detalle Diario (Tabla) */}
                {details.length > 0 && (
                   <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider opacity-80">
                         <Calendar size={14} />
                         <span>Evolución Diaria</span>
                      </div>
                      
                      <div className="rounded-2xl border border-light-border dark:border-dark-border overflow-hidden bg-light-surface dark:bg-dark-surface shadow-sm">
                         <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-light-surface-tertiary dark:scrollbar-thumb-dark-surface-tertiary">
                            <table className="w-full text-xs">
                               <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary sticky top-0 z-10 shadow-sm">
                                  <tr>
                                     <th className="px-4 py-3 text-left font-semibold text-light-text-secondary dark:text-dark-text-secondary">Día</th>
                                     <th className="px-4 py-3 text-center font-semibold text-light-text-secondary dark:text-dark-text-secondary" title="Clima"><Thermometer size={12} className="mx-auto"/></th>
                                     <th className="px-4 py-3 text-right font-semibold text-light-text-secondary dark:text-dark-text-secondary">Cantidad</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-light-border/50 dark:divide-dark-border/50">
                                  {details.map((d, i) => (
                                     <tr key={i} className="group hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
                                        <td className="px-4 py-2.5 font-medium text-light-text-primary dark:text-dark-text-primary">{d.dia}</td>
                                        <td className="px-4 py-2.5 text-center text-base" title={d.weather}>{weatherIcon(d.weather)}</td>
                                        <td className="px-4 py-2.5 text-right font-mono font-medium text-light-text-primary dark:text-dark-text-primary">
                                           {numberFormat(d.value)}
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   </div>
                )}

                {/* 3. Resumen KPIs (Bottom) */}
                {Array.isArray(kpis) && kpis.length > 0 && (
                   <div className="space-y-3 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider opacity-80">
                         <Activity size={14} />
                         <span>Métricas Clave</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                         {kpis.map((k, i) => {
                            const deltaVal = Number(k.delta);
                            const hasDelta = typeof k.delta !== 'undefined';
                            return (
                               <div key={i} className="p-3 rounded-2xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/50 dark:border-dark-border/50 flex flex-col justify-center">
                                  <span className="text-[9px] uppercase tracking-wide text-light-text-secondary dark:text-dark-text-secondary mb-1 truncate opacity-80">{k.label}</span>
                                  <div className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">
                                     {k.isMoney ? `$${numberFormat(k.value)}` : numberFormat(k.value)}
                                  </div>
                                  {hasDelta && (
                                     <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${deltaVal >= 0 ? 'text-light-accent dark:text-dark-accent' : 'text-light-error dark:text-dark-error'}`}>
                                        {deltaVal >= 0 ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180"/>}
                                        {numberFormat(Math.abs(deltaVal))}
                                     </div>
                                  )}
                               </div>
                            )
                         })}
                      </div>
                   </div>
                )}

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}