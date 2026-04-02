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
  if (pos === 1) return '🏆';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return null;
}

function medalColor(pos) {
  if (pos === 1) return 'text-yellow-600 dark:text-yellow-400';
  if (pos === 2) return 'text-slate-600 dark:text-slate-300';
  if (pos === 3) return 'text-amber-700 dark:text-amber-500';
  return 'text-light-text-secondary dark:text-dark-text-secondary';
}

// Barra de progreso vs el líder
const VsLeaderBar = ({ val, top, label }) => {
  if (!top || top === 0) return null;
  const pct = Math.min(100, Math.round((val / top) * 100));
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[10px] font-bold text-light-text-secondary/60 dark:text-dark-text-secondary/60 uppercase tracking-widest mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-dark-border/30 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)] ${pct >= 90 ? 'bg-matrix-green' : pct >= 60 ? 'bg-yellow-400' : 'bg-gray-400 dark:bg-dark-text-secondary/50'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// Badge de puesto compacto
const BadgePuesto = ({ pos }) => {
  if (!pos || pos === 0) return <span className="text-light-text-secondary/30 dark:text-dark-text-secondary/30 text-xs font-mono font-bold">—</span>;
  const emoji = medalEmoji(pos);
  const size  = pos <= 3 ? 'w-8 h-8 text-sm' : 'w-7 h-7 text-xs';
  const bg    = pos === 1 ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-400/20 dark:to-yellow-400/5 border-yellow-200 dark:border-yellow-400/30 shadow-sm'
              : pos === 2 ? 'bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-400/20 dark:to-slate-400/5 border-slate-200 dark:border-slate-400/30 shadow-sm'
              : pos === 3 ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-600/20 dark:to-amber-600/5 border-amber-200 dark:border-amber-600/30 shadow-sm'
              :             'bg-gray-50 dark:bg-dark-surface-secondary border-gray-200 dark:border-dark-border/20';
  return (
    <div className={`inline-flex items-center justify-center rounded-full border font-black shadow-inner ${size} ${bg} ${medalColor(pos)} shrink-0`}>
      {emoji || pos}
    </div>
  );
};

// Sort button
const SortBtn = ({ col, label, sortKey, sortDir, onSort, className = '' }) => (
  <button
    onClick={() => onSort(col)}
    className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors whitespace-nowrap ${
      sortKey === col ? 'text-matrix-green' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-white'
    } ${className}`}
  >
    {label}
    {sortKey === col
      ? sortDir === 'asc' ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />
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
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-gray-50/80 dark:bg-dark-surface-secondary/20 border-b border-gray-100 dark:border-dark-border/10 overflow-hidden"
    >
      <td colSpan={9} className="px-4 py-4 md:px-6 md:py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Métrica principal */}
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5 flex items-center gap-1.5">
              <Award size={12} className="text-matrix-green" />
              {row.metric_label || (isTimes ? 'Tiempo promedio' : 'Ventas totales')}
            </p>
            <p className="text-xl font-black text-light-text-primary dark:text-white font-mono tracking-tight">
              {fmtMetric(row.metric_value, row.kpi_unit)}
            </p>
            {topRef > 0 && row.metric_value > 0 && (
              <div className="mt-2">
                <VsLeaderBar
                  val={isTimes ? topRef : row.metric_value}
                  top={isTimes ? row.metric_value : topRef}
                  label="vs líder"
                />
              </div>
            )}
            {avgRef > 0 && (
              <p className="text-[10px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-2">
                Promedio: {fmtMetric(avgRef, row.kpi_unit)}
              </p>
            )}
          </div>

          {/* Puestos tiempos */}
          {isTimes && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-2">Puestos</p>
              <div className="space-y-1.5">
                <p className="text-[13px] font-bold text-light-text-primary dark:text-gray-300 flex items-center justify-between bg-gray-50 dark:bg-dark-surface-secondary px-2 py-1 rounded-md">
                  <span>Empresa</span>
                  <span className="font-mono text-matrix-green">#{row.puesto_empresa_tiempos || '—'}</span>
                </p>
                <p className="text-[13px] font-bold text-light-text-primary dark:text-gray-400 flex items-center justify-between bg-gray-50 dark:bg-dark-surface-secondary px-2 py-1 rounded-md">
                  <span>Local</span>
                  <span className="font-mono text-indigo-500">#{row.puesto_local_tiempos || '—'}</span>
                </p>
              </div>
            </div>
          )}

          {/* Muestras / días registro (tiempos) */}
          {isTimes && (row.samples > 0 || row.dias_registro > 0) && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5">Producción</p>
              {row.samples > 0 && <p className="text-lg font-black text-light-text-primary dark:text-white font-mono">{Number(row.samples).toLocaleString('es-CL')} <span className="text-[11px] text-light-text-secondary font-semibold ml-1">muestras</span></p>}
              {row.dias_registro > 0 && <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">{row.dias_registro} días registrados</p>}
            </div>
          )}

          {/* Promedio mesa */}
          {row.promedio_mesa > 0 && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5">Ticket Promedio</p>
              <p className="text-xl font-black text-light-text-primary dark:text-white font-mono tracking-tight">{clpFull(row.promedio_mesa)}</p>
              {row.pm_mesa_puesto_emp > 0 && (
                <div className="flex gap-2 mt-2">
                  <span className="text-[9px] font-black uppercase bg-gray-100 dark:bg-dark-surface-secondary px-1.5 py-0.5 rounded text-light-text-secondary">#EM: {row.pm_mesa_puesto_emp}</span>
                  <span className="text-[9px] font-black uppercase bg-gray-100 dark:bg-dark-surface-secondary px-1.5 py-0.5 rounded text-light-text-secondary">#LO: {row.pm_mesa_puesto_local || '—'}</span>
                </div>
              )}
            </div>
          )}

          {/* Promedio persona */}
          {row.promedio_persona > 0 && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5">Venta Persona</p>
              <p className="text-xl font-black text-light-text-primary dark:text-white font-mono tracking-tight">{clpFull(row.promedio_persona)}</p>
              <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">{row.personas_atendidas || '—'} cubiertos totales</p>
            </div>
          )}

          {/* Avg venta diaria */}
          {row.avg_venta_diaria > 0 && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5">Venta Día Prom</p>
              <p className="text-xl font-black text-light-text-primary dark:text-white font-mono tracking-tight">{clp(row.avg_venta_diaria)}</p>
              {row.dias_con_venta > 0 && (
                <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1">{row.dias_con_venta} días con venta</p>
              )}
            </div>
          )}

          {/* Admin: días presentes */}
          {isAdmin && row.days_present_admin > 0 && (
            <div className="bg-white dark:bg-dark-surface border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-indigo-500/80 dark:text-indigo-400/80 tracking-widest mb-1.5">Días presentes</p>
              <p className="text-xl font-black text-indigo-600 dark:text-white tracking-tight">{row.days_present_admin}</p>
              <p className="text-[10px] font-bold text-indigo-400/80 dark:text-indigo-400 mt-1 uppercase tracking-widest">Ajuste Admin</p>
            </div>
          )}

          {/* Mesas */}
          {row.total_mesas > 0 && (
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-widest mb-1.5">Mesas Atendidas</p>
              <p className="text-xl font-black text-light-text-primary dark:text-white font-mono">{row.total_mesas}</p>
              {row.seccion && <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary mt-1 uppercase">{row.seccion}</p>}
            </div>
          )}
        </div>
      </td>
    </motion.tr>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

const MeritLeaderboardTable = ({ comp, search, t }) => {
  const isLive = comp?.is_live === true;
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
      <div className="flex flex-col items-center justify-center py-20 border border-gray-200 dark:border-dark-border/20 rounded-[32px] text-center px-6 bg-white/40 dark:bg-dark-surface-secondary/20 shadow-sm backdrop-blur-md">
        <div className="p-4 bg-gray-100 dark:bg-dark-surface rounded-2xl mb-5 shadow-inner">
          <Award size={48} className="text-light-text-secondary/30 dark:text-dark-text-secondary/40" strokeWidth={1} />
        </div>
        <p className="text-lg font-black text-light-text-primary dark:text-dark-text-primary tracking-tight mb-2">
          {t('merit_rankings.leaderboard.no_data_title')}
        </p>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-sm mb-6">
          {t('merit_rankings.leaderboard.no_data_desc')}
        </p>
        {/* Mostrar info de la regla igual */}
        {comp.include_cargos?.length > 0 && (
          <div className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary bg-gray-50 flex items-center justify-center gap-2 dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/20 rounded-xl px-4 py-2 shadow-sm">
            <span className="uppercase tracking-widest opacity-60">Filtros:</span>
            {comp.include_cargos.join(', ')}
          </div>
        )}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 border border-gray-200 dark:border-dark-border/20 rounded-[32px] text-center px-4 bg-white/40 dark:bg-dark-surface-secondary/20 shadow-sm backdrop-blur-md">
        <div className="p-4 bg-gray-100 dark:bg-dark-surface rounded-2xl mb-4 shadow-inner">
          <Award size={40} className="text-light-text-secondary/30 dark:text-dark-text-secondary/40" strokeWidth={1.5} />
        </div>
        <p className="text-lg font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
          {t('merit_rankings.leaderboard.no_filter_match')}
        </p>
        <p className="text-sm font-medium text-light-text-secondary mt-1 max-w-sm">
           Ningún usuario coincide con los parámetros de búsqueda.
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
    <div className="overflow-x-auto rounded-[24px] border border-gray-200 dark:border-dark-border/20 shadow-sm bg-white/70 dark:bg-dark-surface-secondary/40 backdrop-blur-xl">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-dark-border/20 bg-gray-50/80 dark:bg-dark-surface/60">
            {/* Expand */}
            <th className="w-8 px-3 py-4" />

            {/* Puesto empresa */}
            <th className="text-left px-4 py-4">
              <SortBtn col="puesto_empresa" label={t('merit_rankings.leaderboard.col_rank_emp')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </th>

            {/* Puesto local */}
            <th className="text-left px-3 py-4">
              <SortBtn col="puesto_local" label={t('merit_rankings.leaderboard.col_rank_local')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </th>

            {/* Empleado */}
            <th className="text-left px-4 py-4 min-w-[200px]">
              <span className="text-[11px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_employee')}
              </span>
            </th>

            {/* Local */}
            <th className="text-left px-4 py-4 hidden sm:table-cell">
              <span className="text-[11px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_local')}
              </span>
            </th>

            {/* Métrica principal (ventas o tiempos) */}
            {hasMetric && (
              <th className="text-right px-4 py-4">
                <SortBtn
                  col={hasTimesData ? 'metric_value' : 'sales_total'}
                  label={hasTimesData ? (rows[0]?.metric_label || 'Métrica') : t('merit_rankings.leaderboard.col_sales')}
                  sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
                  className="justify-end"
                />
              </th>
            )}

            {/* $/Mesa */}
            {hasMesaData && (
              <th className="text-right px-4 py-4 hidden lg:table-cell">
                <SortBtn col="promedio_mesa" label={t('merit_rankings.leaderboard.col_avg_mesa')} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="justify-end" />
              </th>
            )}

            {/* Días */}
            {(hasDiasData || hasAdminData) && (
              <th className="text-right px-4 py-4 hidden xl:table-cell">
                <span className="text-[11px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                  {hasAdminData ? 'Días pres.' : 'Días venta'}
                </span>
              </th>
            )}

            {/* Status */}
            <th className="text-center px-4 py-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                {t('merit_rankings.leaderboard.col_status')}
              </span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100 dark:divide-dark-border/10">
          {rows.map((row, i) => {
            const won      = row.status === 'fulfilled';
            const posEmp   = row.puesto_empresa || 0;
            const posLoc   = row.puesto_local   || 0;
            const expanded = expandedRut === row.rut;
            const topRef   = comp?.ranking_scope === 'local' ? row.top_local : row.top_empresa;

            // Live: fulfilled = "podría ganar" (provisional)
            const rowBg = won
              ? isLive ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06] dark:bg-amber-400/[0.05] dark:hover:bg-amber-400/[0.08]' : 'bg-matrix-green/[0.03] hover:bg-matrix-green/[0.06] dark:bg-matrix-green/[0.05] dark:hover:bg-matrix-green/[0.08]'
              : 'bg-white/40 dark:bg-transparent hover:bg-gray-50/80 dark:hover:bg-dark-surface-secondary/30';

            return (
              <React.Fragment key={row.rut || i}>
                <motion.tr
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.25), ease: 'easeOut' }}
                  onClick={() => toggleExpand(row.rut)}
                  className={`cursor-pointer transition-colors border-l-4 ${
                    won ? (isLive ? 'border-l-amber-400/80' : 'border-l-matrix-green') : 'border-l-transparent'
                  } ${rowBg}`}
                >
                  {/* Expand icon */}
                  <td className="w-8 px-3 py-3.5">
                    <div className={`p-1 rounded-full transition-colors ${expanded ? 'bg-gray-200 dark:bg-dark-surface' : 'text-light-text-secondary/40 dark:text-dark-text-secondary/50 group-hover:bg-gray-100 dark:group-hover:bg-dark-surface-secondary'}`}>
                      {expanded ? <ChevronUp size={14} className="text-light-text-primary dark:text-dark-text-primary" /> : <ChevronDown size={14} />}
                    </div>
                  </td>

                  {/* Puesto empresa */}
                  <td className="px-4 py-3.5">
                    <BadgePuesto pos={posEmp} />
                  </td>

                  {/* Puesto local */}
                  <td className="px-3 py-3.5">
                    <span className={`text-[13px] font-black font-mono px-2 py-1 rounded-lg ${posLoc <= 3 ? `${medalColor(posLoc)} bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border/20` : 'text-light-text-secondary/60 dark:text-dark-text-secondary/60'}`}>
                      #{posLoc > 0 ? posLoc : '—'}
                    </span>
                  </td>

                  {/* Empleado */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3.5">
                      {row.profile_image_url ? (
                        <img
                          src={row.profile_image_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200 dark:border-dark-border/20 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-surface-secondary dark:to-dark-surface border border-gray-300 dark:border-dark-border/40 flex items-center justify-center text-xs font-black text-light-text-secondary dark:text-dark-text-secondary shrink-0 select-none shadow-sm shadow-inner text-shadow-sm">
                          {(row.nombre || '?')[0]?.toUpperCase()}{(row.apellido || '')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[14px] font-black text-light-text-primary dark:text-white truncate leading-tight tracking-tight">
                          {row.nombre} {row.apellido}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary truncate">{row.cargo}</p>
                          {row.kpi_source === 'admin' && (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest leading-none shadow-sm">ADM</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Local */}
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="text-[11px] font-bold tracking-wide uppercase text-light-text-secondary dark:text-dark-text-secondary bg-white dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/20 px-2.5 py-1 rounded-lg shadow-sm">
                      {row.local || '—'}
                    </span>
                  </td>

                  {/* Métrica principal */}
                  {hasMetric && (
                    <td className="px-4 py-3.5 text-right w-36">
                      <div className="flex flex-col items-end">
                        <span className={`text-[14px] font-mono font-black ${(row.metric_value || row.sales_total) > 0 ? 'text-light-text-primary dark:text-white' : 'text-light-text-secondary/30 dark:text-dark-text-secondary/30'}`}>
                          {hasTimesData
                            ? fmtMetric(row.metric_value, row.kpi_unit)
                            : clp(row.sales_total)}
                        </span>
                        {!hasTimesData && topRef > 0 && row.sales_total > 0 && (
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-dark-border/30 rounded-full overflow-hidden mt-1.5 shadow-inner">
                            <div
                              className={`h-full rounded-full shadow-[0_0_5px_rgba(255,255,255,0.4)] ${
                                row.sales_total / topRef >= 0.9 ? 'bg-matrix-green'
                                : row.sales_total / topRef >= 0.6 ? 'bg-yellow-400'
                                : 'bg-gray-400 dark:bg-dark-text-secondary/50'
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
                    <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                      <span className="text-[13px] font-black tracking-tight text-light-text-secondary dark:text-dark-text-secondary font-mono">
                        {clp(row.promedio_mesa)}
                      </span>
                    </td>
                  )}

                  {/* Días */}
                  {(hasDiasData || hasAdminData) && (
                    <td className="px-4 py-3.5 text-right hidden xl:table-cell">
                      <span className="text-[13px] font-black text-light-text-secondary dark:text-dark-text-secondary font-mono">
                        {hasAdminData
                          ? (row.days_present_admin > 0 ? row.days_present_admin : '—')
                          : hasTimesData
                            ? (row.dias_registro > 0 ? row.dias_registro : '—')
                            : (row.dias_con_venta > 0 ? row.dias_con_venta : '—')}
                      </span>
                    </td>
                  )}

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    {won ? (
                      isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm shadow-amber-500/5">
                          <FaCheckCircle size={10} />
                          Podría ganar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-matrix-green bg-matrix-green/10 border border-matrix-green/20 px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm shadow-matrix-green/5">
                          <FaCheckCircle size={10} />
                          {t('merit_rankings.leaderboard.status_won')}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary bg-white dark:bg-dark-surface-secondary border border-gray-200 dark:border-dark-border/20 px-2.5 py-1.5 rounded-xl whitespace-nowrap shadow-sm">
                        <FaTimesCircle size={10} />
                        {isLive ? 'En carrera' : t('merit_rankings.leaderboard.status_competing')}
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

      <div className="px-5 py-3 border-t border-gray-200 dark:border-dark-border/20 bg-gray-50 dark:bg-dark-surface-secondary/30 text-[11px] font-bold text-light-text-secondary/70 dark:text-dark-text-secondary/60 flex items-center gap-2">
        <Info size={12} />
        Haz clic en cualquier fila para expandir métricas completas y ver comparaciones
      </div>
    </div>
  );
};

export default MeritLeaderboardTable;
