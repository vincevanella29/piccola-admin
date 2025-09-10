// src/pages/chat/components/common/DataTable.jsx
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

export default function DataTable({ title, subtitle, kpis = [], columns = [], rows = [], totals = null, charts = [], compact = true, onRowClick = null, pageSize = 20 }) {
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState('');
  const [sortDir, setSortDir] = React.useState('asc'); // 'asc' | 'desc'
  const size = Math.max(5, pageSize);
  // Sorting
  const sortedRows = React.useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];
    if (!sortKey) return arr;
    const col = (columns || []).find(c => c.key === sortKey) || {};
    const isNumber = col.format === 'number' || col.format === 'money';
    arr.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      if (isNumber) {
        const na = Number(va) || 0;
        const nb = Number(vb) || 0;
        return sortDir === 'asc' ? na - nb : nb - na;
      }
      const sa = String(va ?? '').toLowerCase();
      const sb = String(vb ?? '').toLowerCase();
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil((sortedRows?.length || 0) / size));
  const pageSafe = Math.min(page, totalPages - 1);
  const start = pageSafe * size;
  const end = start + size;
  const pageRows = Array.isArray(sortedRows) ? sortedRows.slice(start, end) : [];

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <div className="w-full max-w-full overflow-x-auto border border-light-surface/40 dark:border-dark-surface/40 rounded-md">
      {(title || subtitle) && (
        <div className="px-3 py-2 border-b border-light-surface/40 dark:border-dark-surface/40">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {subtitle && <p className="text-xs opacity-75">{subtitle}</p>}
        </div>
      )}

      {Array.isArray(kpis) && kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3">
          {kpis.map((k, idx) => (
            <div key={idx} className="p-2 rounded bg-light-surface/50 dark:bg-dark-surface/50">
              <div className="text-[11px] opacity-70">{k.label}</div>
              <div className="text-base font-semibold">{k.isMoney ? `$${numberFormat(k.value)}` : numberFormat(k.value)}</div>
              {typeof k.delta !== 'undefined' && (
                <div className={`text-[11px] ${Number(k.delta) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Number(k.delta) >= 0 ? `▲ ${numberFormat(k.delta)}` : `▼ ${numberFormat(Math.abs(k.delta))}`}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {Array.isArray(charts) && charts.length > 0 && (
        <div className="p-3 pt-0">
          {charts.map((ch, idx) => (
            <div key={idx} className="mb-3">
              {ch.title && <div className="text-xs font-semibold mb-1 opacity-80">{ch.title}</div>}
              {ch.type === 'pie' ? (
                <div className="flex items-start gap-4">
                  {/* Simple SVG pie */}
                  <svg width="120" height="120" viewBox="0 0 32 32" className="shrink-0">
                    {(() => {
                      const data = (ch.data || []).filter(d => Number(d.value) > 0);
                      const total = data.reduce((s, d) => s + Number(d.value || 0), 0) || 1;
                      let acc = 0;
                      const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#22c55e','#06b6d4','#fde047','#fb7185'];
                      return data.map((d, i) => {
                        const val = Number(d.value || 0);
                        const frac = val / total;
                        const start = acc * 2 * Math.PI;
                        const end = (acc + frac) * 2 * Math.PI;
                        acc += frac;
                        const large = end - start > Math.PI ? 1 : 0;
                        const x1 = 16 + 16 * Math.cos(start);
                        const y1 = 16 + 16 * Math.sin(start);
                        const x2 = 16 + 16 * Math.cos(end);
                        const y2 = 16 + 16 * Math.sin(end);
                        const path = `M16,16 L${x1},${y1} A16,16 0 ${large} 1 ${x2},${y2} z`;
                        return <path key={i} d={path} fill={colors[i % colors.length]} />;
                      });
                    })()}
                  </svg>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {(ch.data || []).map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded" style={{backgroundColor: ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#22c55e','#06b6d4','#fde047','#fb7185'][i % 10]}} />
                        <span className="opacity-70">{d.label}</span>
                        <span className="ml-auto font-medium">{numberFormat(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <table className={`min-w-full text-xs ${compact ? 'table-fixed' : ''}`}>
        <thead>
          <tr className="bg-light-surface/60 dark:bg-dark-surface/60">
            {columns.map((c, idx) => {
              const active = sortKey === c.key;
              const arrow = active ? (sortDir === 'asc' ? '▲' : '▼') : '';
              return (
                <th
                  key={idx}
                  className={`px-3 py-2 text-left font-semibold whitespace-nowrap select-none ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'} ${'cursor-pointer'}`}
                  onClick={() => {
                    if (active) {
                      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setSortKey(c.key);
                      setSortDir('asc');
                    }
                    setPage(0);
                  }}
                  title="Ordenar"
                >
                  <span className="inline-flex items-center gap-1">{c.label} <span className="opacity-60">{arrow}</span></span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r, ridx) => (
            <tr
              key={ridx}
              className={`${(start + ridx) % 2 === 0 ? 'bg-transparent' : 'bg-light-surface/30 dark:bg-dark-surface/30'} ${onRowClick ? 'hover:bg-light-surface/60 dark:hover:bg-dark-surface/60 cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(r, start + ridx) : undefined}
            >
              {columns.map((c, cidx) => {
                const raw = r[c.key];
                const alignCls = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
                if (c.format === 'image') {
                  const url = typeof raw === 'string' ? raw : '';
                  return (
                    <td key={cidx} className={`px-3 py-2 whitespace-nowrap ${alignCls}`}>
                      {url ? (
                        <img
                          src={url}
                          alt={r.name || r.nombre || ''}
                          className={`w-7 h-7 ${c.round === false ? '' : 'rounded-full'} object-cover`}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : null}
                    </td>
                  );
                }
                if (c.format === 'weather') {
                  const tag = String(raw || '').toLowerCase();
                  const icon = tag === 'nieve' ? '❄️' : tag === 'lluvia' ? '🌧️' : tag === 'soleado' ? '☀️' : tag ? '⛅' : '—';
                  const label = tag ? tag : 'sin dato';
                  return (
                    <td key={cidx} className={`px-3 py-2 whitespace-nowrap ${alignCls}`} title={label}>
                      <span className="text-base" aria-label={label}>{icon}</span>
                    </td>
                  );
                }
                const val = c.format === 'money' ? `$${numberFormat(raw)}` : (c.format === 'number' ? numberFormat(raw) : (raw ?? ''));
                return (
                  <td key={cidx} className={`px-3 py-2 whitespace-nowrap ${alignCls}`}>{val}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="bg-light-surface/60 dark:bg-dark-surface/60 font-semibold">
              {columns.map((c, idx) => {
                if (idx === 0) return <td key={idx} className="px-3 py-2">Totales</td>;
                const raw = totals[c.key];
                const val = c.format === 'money' ? `$${numberFormat(raw)}` : (c.format === 'number' ? numberFormat(raw) : (raw ?? ''));
                const alignCls = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
                return <td key={idx} className={`px-3 py-2 ${alignCls}`}>{val}</td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 p-2 text-xs">
          <button
            onClick={handlePrev}
            disabled={pageSafe === 0}
            className={`px-2 py-1 rounded border border-light-surface/50 dark:border-dark-surface/50 ${pageSafe === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-light-surface/40 dark:hover:bg-dark-surface/40'}`}
            aria-label="Anterior"
          >
            ◀
          </button>
          <span className="opacity-75">Página {pageSafe + 1} / {totalPages}</span>
          <button
            onClick={handleNext}
            disabled={pageSafe >= totalPages - 1}
            className={`px-2 py-1 rounded border border-light-surface/50 dark:border-dark-surface/50 ${pageSafe >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-light-surface/40 dark:hover:bg-dark-surface/40'}`}
            aria-label="Siguiente"
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
