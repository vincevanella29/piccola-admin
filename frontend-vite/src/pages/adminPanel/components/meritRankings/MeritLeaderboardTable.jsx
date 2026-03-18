// src/pages/adminPanel/components/meritRankings/MeritLeaderboardTable.jsx
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { FaArrowUp, FaArrowDown, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

// ── Helpers ──────────────────────────────────────────────────────────────────

function clp(n) {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v === 0) return '—';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString('es-CL')}`;
}

function fmtMin(n) {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v === 0) return '—';
  const mins = Math.floor(v);
  const secs = Math.round((v - mins) * 60);
  return mins > 0
    ? secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
    : `${secs}s`;
}

function fmtMetric(val, unit) {
  if (!val && val !== 0) return '—';
  if (unit === 'seg' || unit === 'min') return fmtMin(val);
  if (unit === 'muestras' || unit === 'qty') return Number(val).toLocaleString('es-CL');
  if (unit === 'bool') return val ? '✓' : '—';
  return clp(val);
}

function clpFull(n) {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v === 0) return '—';
  return `$${v.toLocaleString('es-CL')}`;
}

function medalEmoji(pos) {
  if (pos === 1) return '👑';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return null;
}

function medalColor(pos) {
  if (pos === 1) return 'text-yellow-400';
  if (pos === 2) return 'text-slate-400';
  if (pos === 3) return 'text-amber-600';
  return 'text-dark-text-secondary';
}

// Barra de progreso vs el líder
const VsLeaderBar = ({ val, top, label }) => {
  if (!top || top === 0) return null;
  const pct = Math.min(100, Math.round((val / top) * 100));
  return (
    <div className="mt-0.5">
      <div className="flex justify-between text-[9px] text-dark-text-secondary/60 mb-0.5">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-0.5 bg-dark-border/20 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-matrix-green' : pct >= 60 ? 'bg-yellow-400' : 'bg-dark-text-secondary/30'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// Badge de puesto compacto
const BadgePuesto = ({ pos }) => {
  if (!pos || pos === 0) return <span className="text-dark-text-secondary/30 text-xs font-mono">—</span>;
  const emoji = medalEmoji(pos);
  const size  = pos <= 3 ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs';
  const bg    = pos === 1 ? 'bg-yellow-400/15 border-yellow-400/30'
              : pos === 2 ? 'bg-slate-400/15 border-slate-400/30'
              : pos === 3 ? 'bg-amber-600/15 border-amber-600/30'
              :             'bg-dark-surface-secondary border-dark-border/20';
  return (
    <div className={`inline-flex items-center justify-center rounded-full border font-bold ${size} ${bg} ${medalColor(pos)} shrink-0`}>
      {emoji || pos}
    </div>
  );
};

// Sort button
const SortBtn = ({ col, label, sortKey, sortDir, onSort, className = '' }) => (
  <button
    onClick={() => onSort(col)}
    className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
      sortKey === col ? 'text-matrix-green' : 'text-dark-text-secondary hover:text-dark-text-primary'
    } ${className}`}
  >
    {label}
    {sortKey === col
      ? sortDir === 'asc' ? <FaArrowUp size={8} /> : <FaArrowDown size={8} />
      : null}
  </button>
);

// Expandable detail row
const DetailRow = ({ row, comp }) => {
  const isAdmin  = row.kpi_source === 'admin';
  const isTimes  = row.kpi_category === 'times_employee';
  const topRef   = comp?.ranking_scope === 'local' ? row.top_local   : row.top_empresa;
  const avgRef   = comp?.ranking_scope === 'local' ? row.avg_local   : row.avg_empresa;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-dark-surface-secondary/20"
    >
      <td colSpan={9} className="px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Métrica principal */}
          <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
            <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">
              {row.metric_label || (isTimes ? 'Tiempo promedio' : 'Ventas totales')}
            </p>
            <p className="text-base font-black text-dark-text-primary font-mono">
              {fmtMetric(row.metric_value, row.kpi_unit)}
            </p>
            {topRef > 0 && row.metric_value > 0 && (
              <VsLeaderBar
                val={isTimes ? topRef : row.metric_value}
                top={isTimes ? row.metric_value : topRef}
                label="vs líder"
              />
            )}
            {avgRef > 0 && (
              <p className="text-[9px] text-dark-text-secondary mt-1">
                Promedio: {fmtMetric(avgRef, row.kpi_unit)}
              </p>
            )}
          </div>

          {/* Puestos tiempos */}
          {isTimes && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">Puestos</p>
              <p className="text-sm font-bold text-dark-text-primary">
                #{row.puesto_empresa_tiempos || '—'} empresa
              </p>
              <p className="text-sm font-bold text-dark-text-secondary">
                #{row.puesto_local_tiempos || '—'} local
              </p>
            </div>
          )}

          {/* Muestras / días registro (tiempos) */}
          {isTimes && (row.samples > 0 || row.dias_registro > 0) && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">Producción</p>
              {row.samples > 0 && <p className="text-sm font-bold text-dark-text-primary">{Number(row.samples).toLocaleString('es-CL')} muestras</p>}
              {row.dias_registro > 0 && <p className="text-[9px] text-dark-text-secondary mt-0.5">{row.dias_registro} días c/registro</p>}
            </div>
          )}

          {/* Promedio mesa */}
          {row.promedio_mesa > 0 && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">$/Mesa</p>
              <p className="text-base font-black text-dark-text-primary font-mono">{clpFull(row.promedio_mesa)}</p>
              {row.pm_mesa_puesto_emp > 0 && (
                <p className="text-[9px] text-dark-text-secondary mt-0.5">#{row.pm_mesa_puesto_emp} empresa · #{row.pm_mesa_puesto_local || '—'} local</p>
              )}
            </div>
          )}

          {/* Promedio persona */}
          {row.promedio_persona > 0 && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">$/Persona</p>
              <p className="text-base font-black text-dark-text-primary font-mono">{clpFull(row.promedio_persona)}</p>
              <p className="text-[9px] text-dark-text-secondary mt-0.5">{row.personas_atendidas || '—'} personas</p>
            </div>
          )}

          {/* Avg venta diaria */}
          {row.avg_venta_diaria > 0 && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">Venta/día prom.</p>
              <p className="text-base font-black text-dark-text-primary font-mono">{clp(row.avg_venta_diaria)}</p>
              {row.dias_con_venta > 0 && (
                <p className="text-[9px] text-dark-text-secondary mt-0.5">{row.dias_con_venta} días con venta</p>
              )}
            </div>
          )}

          {/* Admin: días presentes */}
          {isAdmin && row.days_present_admin > 0 && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">Días presentes</p>
              <p className="text-base font-black text-dark-text-primary">{row.days_present_admin}</p>
              <p className="text-[9px] text-dark-text-secondary mt-0.5">Admin KPIs</p>
            </div>
          )}

          {/* Mesas */}
          {row.total_mesas > 0 && (
            <div className="bg-dark-surface border border-dark-border/15 rounded-xl p-2.5">
              <p className="text-[9px] font-bold uppercase text-dark-text-secondary tracking-wider mb-1">Mesas</p>
              <p className="text-base font-black text-dark-text-primary">{row.total_mesas}</p>
              {row.seccion && <p className="text-[9px] text-dark-text-secondary mt-0.5">{row.seccion}</p>}
            </div>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MeritLeaderboardTable = ({ comp, search, t }) => {
  const [sortKey, setSortKey] = useState('puesto_empresa');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedRut, setExpandedRut] = useState(null);

  const rows = useMemo(() => {
    if (!comp?.leaderboard) return [];
    let r = [...comp.leaderboard];

    if (search) {
      const q = search.toLowerCase();
      r = r.filter(e =>
        (e.nombre || '').toLowerCase().includes(q) ||
        (e.apellido || '').toLowerCase().includes(q) ||
        (e.rut || '').includes(q) ||
        (e.local || '').toLowerCase().includes(q) ||
        (e.cargo || '').toLowerCase().includes(q)
      );
    }

    r.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (va === null || va === undefined) va = typeof vb === 'number' ? Infinity : '';
      if (vb === null || vb === undefined) vb = typeof va === 'number' ? Infinity : '';
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return r;
  }, [comp?.leaderboard, search, sortKey, sortDir]);

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key.includes('puesto') ? 'asc' : 'desc');
    }
  };

  const toggleExpand = rut => setExpandedRut(prev => prev === rut ? null : rut);

  // ── Empty states ──────────────────────────────────────────────────────────
  if (!comp) return null;

  if (!comp.has_data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-dark-border/20 rounded-2xl text-center px-4">
        <Award size={36} className="text-dark-text-secondary/25 mb-3" strokeWidth={1.2} />
        <p className="text-sm font-semibold text-dark-text-secondary mb-1">
          {t('merit_rankings.leaderboard.no_data_title')}
        </p>
        <p className="text-xs text-dark-text-secondary/55 max-w-xs">
          {t('merit_rankings.leaderboard.no_data_desc')}
        </p>
        {/* Mostrar info de la regla igual */}
        {comp.include_cargos?.length > 0 && (
          <div className="mt-4 text-[10px] text-dark-text-secondary bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2">
            Cargos elegibles: {comp.include_cargos.join(', ')}
          </div>
        )}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-dark-border/20 rounded-2xl text-center px-4">
        <Award size={36} className="text-dark-text-secondary/25 mb-3" strokeWidth={1.2} />
        <p className="text-sm font-semibold text-dark-text-secondary">
          {t('merit_rankings.leaderboard.no_filter_match')}
        </p>
      </div>
    );
  }

  // Detectar qué columnas tienen datos para no mostrar columnas vacías
  const hasKpiData    = rows.some(r => r.sales_total > 0);
  const hasTimesData  = rows.some(r => r.kpi_category === 'times_employee' && r.metric_value > 0);
  const hasMetric     = hasKpiData || hasTimesData;
  const hasAdminData  = rows.some(r => r.days_present_admin > 0);
  const hasMesaData   = rows.some(r => r.promedio_mesa > 0);
  const hasDiasData   = rows.some(r => r.dias_con_venta > 0 || r.dias_registro > 0);

  // ── Table ─────────────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto rounded-xl border border-dark-border/20 shadow-sm">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="border-b border-dark-border/20 bg-dark-surface-secondary/50">
            {/* Expand */}
            <th className="w-8 px-2 py-2.5" />

            {/* Puesto empresa */}
            <th className="text-left px-3 py-2.5">
              <SortBtn col="puesto_empresa" label={t('merit_rankings.leaderboard.col_rank_emp')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </th>

            {/* Puesto local */}
            <th className="text-left px-2 py-2.5">
              <SortBtn col="puesto_local" label={t('merit_rankings.leaderboard.col_rank_local')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </th>

            {/* Empleado */}
            <th className="text-left px-3 py-2.5 min-w-[170px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_employee')}
              </span>
            </th>

            {/* Local */}
            <th className="text-left px-3 py-2.5 hidden sm:table-cell">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_local')}
              </span>
            </th>

            {/* Métrica principal (ventas o tiempos) */}
            {hasMetric && (
              <th className="text-right px-3 py-2.5">
                <SortBtn
                  col={hasTimesData ? 'metric_value' : 'sales_total'}
                  label={hasTimesData ? (rows[0]?.metric_label || 'Métrica') : t('merit_rankings.leaderboard.col_sales')}
                  sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                />
              </th>
            )}

            {/* $/Mesa */}
            {hasMesaData && (
              <th className="text-right px-3 py-2.5 hidden lg:table-cell">
                <SortBtn col="promedio_mesa" label={t('merit_rankings.leaderboard.col_avg_mesa')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </th>
            )}

            {/* Días */}
            {(hasDiasData || hasAdminData) && (
              <th className="text-right px-3 py-2.5 hidden xl:table-cell">
                <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary">
                  {hasAdminData ? 'Días pres.' : 'Días venta'}
                </span>
              </th>
            )}

            {/* Status */}
            <th className="text-center px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_status')}
              </span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-dark-border/8">
          {rows.map((row, i) => {
            const won      = row.status === 'fulfilled';
            const posEmp   = row.puesto_empresa || 0;
            const posLoc   = row.puesto_local   || 0;
            const expanded = expandedRut === row.rut;
            const topRef   = comp?.ranking_scope === 'local' ? row.top_local : row.top_empresa;

            return (
              <React.Fragment key={row.rut || i}>
                <motion.tr
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.01, 0.25) }}
                  onClick={() => toggleExpand(row.rut)}
                  className={`cursor-pointer transition-colors hover:bg-dark-surface-secondary/20 ${
                    won ? 'bg-matrix-green/[0.025]' : ''
                  } ${expanded ? 'bg-dark-surface-secondary/15' : ''}`}
                >
                  {/* Expand icon */}
                  <td className="w-8 px-2 py-2">
                    <div className="text-dark-text-secondary/30">
                      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  </td>

                  {/* Puesto empresa */}
                  <td className="px-3 py-2.5">
                    <BadgePuesto pos={posEmp} />
                  </td>

                  {/* Puesto local */}
                  <td className="px-2 py-2.5">
                    <span className={`text-xs font-bold font-mono ${posLoc <= 3 ? medalColor(posLoc) : 'text-dark-text-secondary/60'}`}>
                      #{posLoc > 0 ? posLoc : '—'}
                    </span>
                  </td>

                  {/* Empleado */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {row.profile_image_url ? (
                        <img
                          src={row.profile_image_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0 border border-dark-border/20"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-dark-surface-secondary border border-dark-border/20 flex items-center justify-center text-[10px] font-bold text-dark-text-secondary shrink-0 select-none">
                          {(row.nombre || '?')[0]?.toUpperCase()}{(row.apellido || '')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-dark-text-primary truncate leading-tight">
                          {row.nombre} {row.apellido}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-dark-text-secondary truncate">{row.cargo}</p>
                          {row.kpi_source === 'admin' && (
                            <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-dark-accent/10 border border-dark-accent/20 text-dark-accent font-bold leading-none">ADM</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Local */}
                  <td className="px-3 py-2.5 hidden sm:table-cell">
                    <span className="text-[11px] font-medium text-dark-text-secondary bg-dark-surface-secondary border border-dark-border/15 px-2 py-0.5 rounded-md">
                      {row.local || '—'}
                    </span>
                  </td>

                  {/* Métrica principal */}
                  {hasMetric && (
                    <td className="px-3 py-2.5 text-right">
                      <div>
                        <span className={`text-xs font-mono font-bold ${(row.metric_value || row.sales_total) > 0 ? 'text-dark-text-primary' : 'text-dark-text-secondary/30'}`}>
                          {hasTimesData
                            ? fmtMetric(row.metric_value, row.kpi_unit)
                            : clp(row.sales_total)}
                        </span>
                        {!hasTimesData && topRef > 0 && row.sales_total > 0 && (
                          <div className="w-12 h-1 bg-dark-border/20 rounded-full overflow-hidden ml-auto mt-1">
                            <div
                              className={`h-full rounded-full ${
                                row.sales_total / topRef >= 0.9 ? 'bg-matrix-green'
                                : row.sales_total / topRef >= 0.6 ? 'bg-yellow-400'
                                : 'bg-dark-text-secondary/30'
                              }`}
                              style={{ width: `${Math.min(100, (row.sales_total / topRef) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  )}

                  {/* $/Mesa */}
                  {hasMesaData && (
                    <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                      <span className="text-[11px] text-dark-text-secondary font-mono">
                        {clp(row.promedio_mesa)}
                      </span>
                    </td>
                  )}

                  {/* Días */}
                  {(hasDiasData || hasAdminData) && (
                    <td className="px-3 py-2.5 text-right hidden xl:table-cell">
                      <span className="text-[11px] text-dark-text-secondary font-mono">
                        {hasAdminData
                          ? (row.days_present_admin > 0 ? row.days_present_admin : '—')
                          : hasTimesData
                            ? (row.dias_registro > 0 ? row.dias_registro : '—')
                            : (row.dias_con_venta > 0 ? row.dias_con_venta : '—')}
                      </span>
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-3 py-2.5 text-center">
                    {won ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-matrix-green bg-matrix-green/10 border border-matrix-green/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <FaCheckCircle size={8} />
                        {t('merit_rankings.leaderboard.status_won')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-dark-text-secondary bg-dark-surface-secondary border border-dark-border/15 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <FaTimesCircle size={8} />
                        {t('merit_rankings.leaderboard.status_competing')}
                      </span>
                    )}
                  </td>
                </motion.tr>

                {/* Expandable detail */}
                <AnimatePresence>
                  {expanded && <DetailRow key={`detail-${row.rut}`} row={row} comp={comp} />}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2 border-t border-dark-border/10 bg-dark-surface-secondary/20 text-[10px] text-dark-text-secondary/50 flex items-center gap-1.5">
        <Info size={9} />
        Haz clic en una fila para ver detalles completos
      </div>
    </div>
  );
};

export default MeritLeaderboardTable;
