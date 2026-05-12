import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from 'lucide-react';
import { Td } from './TableParts.jsx';
import { RankIndicator } from './kpiConfig.jsx';

function VarBadge({ pct }) {
  if (pct == null) return null;
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-2">
        <ArrowUpRight size={12}/>{pct.toFixed(2)}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 ml-2">
        <ArrowDownRight size={12}/>{Math.abs(pct).toFixed(2)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-dark-text-secondary ml-2">
      <Minus size={12}/>0%
    </span>
  );
}

function AvisoBadge({ ok }) {
  if (ok) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-2">
      <AlertTriangle size={12}/> Aviso &lt;85% emp.
    </span>
  );
}

export default function KpiRow({
  emp,
  activeKpi,
  latest,
  companyTopFallback,
  localTopMapFallback,
  empresaAvg,
  localAvgMap,
  val,
  varPct,
  prevVal,
  compareLabel,
  onClickRow,
  rankEmp, // prefer latest.rankEmp, sino emp.puesto_empresa
  rankLoc, // prefer latest.rankLoc, sino fallback
}) {
  // Top & gaps (preferimos latest si viene)
  const topEmp = latest?.topEmp ?? companyTopFallback;
  const topLoc = latest?.topLoc ?? (emp.local ? (localTopMapFallback[emp.local] || 0) : 0);
  const gapEmp = Math.max(0, (topEmp || 0) - val);
  const gapLoc = Math.max(0, (topLoc || 0) - val);

  // Promedios & vs %
  const empAvg = empresaAvg || null;
  const locAvg = localAvgMap?.[emp.local || '—'] ?? null;
  const vsEmpPct = empAvg ? (val / empAvg) : null;
  const vsLocPct = locAvg ? (val / locAvg) : null;
  const warn85 = vsEmpPct == null ? true : (vsEmpPct >= 0.85);

  return (
    <tr
      className={`border-t border-dark-border/10 hover:bg-dark-surface-secondary cursor-pointer group ${(activeKpi.key === 'venta_total' || activeKpi.key === 'promedio_diario') && !warn85 ? 'bg-amber-500/5' : ''}`}
      onClick={onClickRow}
    >
      {/* # Emp */}
      <Td align="center" className="font-bold w-16" title="Posición empresa">
        <RankIndicator rank={rankEmp}/>
      </Td>

      {/* # Local */}
      <Td align="center" className="font-bold w-16" title={`Posición en ${emp.local || '—'}`}>
        {rankLoc ?? '—'}
      </Td>

      {/* Colaborador */}
      <Td>
        <div className="flex items-start gap-4">
          <img
            src={emp.profile_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nombre || 'E')}&background=random`}
            alt={`${emp.nombre} ${emp.apellido}`}
            className="w-10 h-10 rounded-full object-cover mt-1"
          />
          <div className="flex-grow">
            <p className="font-semibold text-dark-text-primary group-hover:text-matrix-green transition-colors">
              {emp.nombre || 'N/A'} {emp.apellido}
            </p>
            <p className="text-xs text-dark-text-secondary">
              {emp.cargo} en <span className="font-semibold">{emp.local || '—'}</span>
            </p>
          </div>
        </div>
      </Td>

      {/* KPI + comparativos (sólo info de ventas/KPI) */}
      <Td align={activeKpi.align} className="font-mono text-base">
        {/* Valor actual + variación */}
        {activeKpi.fmt(val)}
        <VarBadge pct={varPct}/>
        {prevVal != null && (
          <div className="text-[11px] text-dark-text-secondary mt-1" title={compareLabel || 'Comparativo'}>
            vs {compareLabel || 'período anterior'}:&nbsp;
            <span className="font-semibold">{activeKpi.fmt(prevVal)}</span>
          </div>
        )}

        {/* Top Empresa / Local + gaps */}
        <div className="text-[11px] text-dark-text-secondary mt-1">
          {topEmp
            ? <>Top emp: <b>{activeKpi.fmt(topEmp)}</b> {gapEmp === 0 ? <span className="text-emerald-400 ml-1">— Top</span> : <>· faltan <b>{activeKpi.fmt(gapEmp)}</b></>}</>
            : <>Top emp: —</>
          }
        </div>
        <div className="text-[11px] text-dark-text-secondary">
          {topLoc
            ? <>Top local: <b>{activeKpi.fmt(topLoc)}</b> {gapLoc === 0 ? <span className="text-emerald-400 ml-1">— Top</span> : <>· faltan <b>{activeKpi.fmt(gapLoc)}</b></>}</>
            : <>Top local: —</>
          }
        </div>

        {/* Solo venta total y prom. diario: vs promedios + aviso */}
        {(activeKpi.key === 'venta_total' || activeKpi.key === 'promedio_diario') && (
          <div className="text-[11px] mt-1 flex flex-wrap gap-2 items-center">
            <span className="text-dark-text-secondary">
              vs Emp: <b className={vsEmpPct != null && vsEmpPct >= 1 ? 'text-emerald-400' : 'text-rose-400'}>
                {vsEmpPct == null ? '—' : ((vsEmpPct - 1) * 100).toFixed(1) + '%'}
              </b>
            </span>
            <span className="text-dark-text-secondary">
              vs Local: <b className={vsLocPct != null && vsLocPct >= 1 ? 'text-emerald-400' : 'text-rose-400'}>
                {vsLocPct == null ? '—' : ((vsLocPct - 1) * 100).toFixed(1) + '%'}
              </b>
            </span>
            <AvisoBadge ok={vsEmpPct == null ? true : (vsEmpPct >= 0.85)}/>
          </div>
        )}
      </Td>
    </tr>
  );
}
