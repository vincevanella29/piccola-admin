// src/pages/chat/components/modals/ConsumoDetailModal.jsx
import React from 'react';

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
  // order details by dia asc
  details.sort((a,b) => String(a.dia||'').localeCompare(String(b.dia||'')));

  // Build display pairs from grouping columns (exclude the metric column 'value')
  const groupPairs = columns
    .filter((c) => c && c.key && c.key !== 'value')
    .map((c) => ({ label: c.label || c.key, value: row[c.key] }));

  const metric = typeof row.value === 'number' ? row.value : Number(row.value || 0);
  const unitKpi = (kpis || []).find((k) => (k.label || '').toLowerCase() === 'unidad');
  const unit = (unitKpi && String(unitKpi.value || '').toLowerCase()) || '';

  const weatherIcon = (tag) => {
    const t = String(tag || '').toLowerCase();
    if (t === 'nieve') return '❄️';
    if (t === 'lluvia') return '🌧️';
    if (t === 'soleado') return '☀️';
    if (!t) return '—';
    return '⛅';
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-dark-surface rounded-md shadow-xl max-w-lg w-[92%] p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold truncate">Detalle de consumo</h3>
            <p className="text-xs opacity-75 truncate">{unit ? `Unidad: ${unit}` : ''}</p>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded border border-light-surface/60 dark:border-dark-surface/60 hover:bg-light-surface/40 dark:hover:bg-dark-surface/40">Cerrar</button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {groupPairs.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-light-surface/30 dark:border-dark-surface/30 py-1">
              <span className="opacity-70">{it.label}</span>
              <span className="font-medium">{String(it.value ?? '-')}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center justify-between border-b border-light-surface/30 dark:border-dark-surface/30 py-1">
            <span className="opacity-70">Valor</span>
            <span className="font-semibold">{unit === 'kg' ? `${numberFormat(metric)} kg` : `${numberFormat(Math.round(metric))} uds`}</span>
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Detalle por día</h4>
            <div className="max-h-64 overflow-auto border border-light-surface/40 dark:border-dark-surface/40 rounded">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-light-surface/60 dark:bg-dark-surface/60">
                    <th className="px-3 py-2 text-left font-semibold">Día</th>
                    <th className="px-3 py-2 text-center font-semibold">Clima</th>
                    <th className="px-3 py-2 text-right font-semibold">{unit === 'kg' ? 'Consumo (kg)' : 'Cantidad (uds)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? 'bg-transparent' : 'bg-light-surface/30 dark:bg-dark-surface/30'}`}>
                      <td className="px-3 py-2 whitespace-nowrap">{String(d.dia || '-')}</td>
                      <td className="px-3 py-2 text-center" title={String(d.weather || '')}><span className="text-base">{weatherIcon(d.weather)}</span></td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{unit === 'kg' ? `${numberFormat(d.value)}` : `${numberFormat(Math.round(d.value || 0))}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KPIs resumen */}
        {Array.isArray(kpis) && kpis.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Resumen</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {kpis.map((k, i) => (
                <div key={i} className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
                  <div className="text-[11px] opacity-70">{k.label}</div>
                  <div className="text-sm font-semibold">{k.isMoney ? `$${numberFormat(k.value)}` : numberFormat(k.value)}</div>
                  {typeof k.delta !== 'undefined' && (
                    <div className={`text-[11px] ${Number(k.delta) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Number(k.delta) >= 0 ? `▲ ${numberFormat(k.delta)}` : `▼ ${numberFormat(Math.abs(k.delta))}`}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
