import { Crown } from 'lucide-react';

// --- Formatters
export const fmtCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
export const fmtNum = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

// --- Tabs KPI
export const KPI_TABS = [
  { key: 'venta_total',       label: 'Venta Total',     head: 'Venta Total (Período)',     value: (e) => e?.kpi?.total_venta || 0,           fmt: (v) => fmtCLP.format(v), align: 'right', sortKey: 'kpi.total_venta',         compKey: 'total_venta' },
  { key: 'promedio_diario',   label: 'Prom. Diario',    head: 'Prom. Venta Diaria',        value: (e) => e?.kpi?.promedio_venta_diaria || 0, fmt: (v) => fmtCLP.format(v), align: 'right', sortKey: 'kpi.promedio_venta_diaria', compKey: 'promedio_venta_diaria' },
  { key: 'personas',          label: 'Personas',        head: 'Personas Atendidas',        value: (e) => e?.kpi?.personas_atendidas || 0,    fmt: (v) => fmtNum.format(v), align: 'right', sortKey: 'kpi.personas_atendidas',    compKey: 'personas_atendidas' },
  { key: 'mesas',             label: 'Mesas',           head: 'Mesas Atendidas',           value: (e) => e?.kpi?.total_mesas || 0,           fmt: (v) => fmtNum.format(v), align: 'right', sortKey: 'kpi.total_mesas',           compKey: 'total_mesas' },
  { key: 'promedio_mesa',     label: 'Prom. Mesa',      head: 'Promedio por Mesa',         value: (e) => e?.kpi?.promedio_mesa || 0,         fmt: (v) => fmtCLP.format(v), align: 'right', sortKey: 'kpi.promedio_mesa',         compKey: 'promedio_mesa' },
  { key: 'promedio_persona',  label: 'Prom. Persona',   head: 'Promedio por Persona',      value: (e) => e?.kpi?.promedio_por_persona || 0,  fmt: (v) => fmtCLP.format(v), align: 'right', sortKey: 'kpi.promedio_por_persona',  compKey: 'promedio_por_persona' },
];

// --- Tab especial Méritos y orden de segmentos
export const MERITS_TAB = { key: 'merits', label: 'Méritos', type: 'merits' };
export const SEG_ORDER = ['INT', 'END', 'LCK', 'CHA', 'STR', 'AGI', 'PER'];

// --- latest_kpi mapeo por KPI
export const LATEST_MAP = {
  total_venta:        { node: ['sales'],                 valKey: 'total' },
  personas_atendidas: { node: ['personas_atendidas'],    valKey: 'valor' },
  total_mesas:        { node: ['total_mesas'],           valKey: 'valor' },
  promedio_mesa:      { node: ['promedio_por_mesa'],     valKey: 'valor' },
  promedio_persona:   { node: ['promedio_por_persona'],  valKey: 'valor' },
  // promedio_venta_diaria: no viene en latest_kpi, usamos cálculos locales.
};

// --- utils básicos
export const getNested = (obj, path) =>
  path.split('.').reduce((o, k) => (o || {})[k], obj);

export const valueOf = (emp, tab) => tab.value(emp) || 0;

export const isTotalOrDaily = (activeKey) =>
  activeKey === 'venta_total' || activeKey === 'promedio_diario';

// --- latest_kpi bundle (si existe)
export const getLatestBundle = (emp, activeKpi) => {
  const ck = activeKpi.compKey;
  const map = LATEST_MAP[ck];
  if (!map) return null;
  const node = getNested(emp, ['latest_kpi', ...map.node].join('.')) || null;
  if (!node) return null;
  return {
    topEmp: node.top_empresa ?? null,
    topLoc: node.top_local ?? null,
    avgEmp: node.promedio_empresa ?? null,
    avgLoc: node.promedio_local ?? null,
    rankEmp: node.puesto_empresa ?? null,
    rankLoc: node.puesto_local ?? null,
  };
};

// --- variación %
export const getVarPct = (emp, activeKpi) => {
  const ck = activeKpi.compKey;
  const v = getNested(emp, `variacion.${ck}`);
  if (typeof v === 'number') return v; // ya %
  const curr = valueOf(emp, activeKpi);
  const prev = getNested(emp, `comparativo.${ck}`);
  if (typeof prev === 'number' && prev !== 0) return ((curr - prev) / prev) * 100;
  return null;
};

export const getPrevVal = (emp, activeKpi) => {
  const ck = activeKpi.compKey;
  const prev = getNested(emp, `comparativo.${ck}`);
  return typeof prev === 'number' ? prev : null;
};

// --- Top empresa (fallback) y top local por local (fallback)
export const computeCompanyTop = (rows, activeKpi) => {
  const vals = rows.map(e => valueOf(e, activeKpi));
  return vals.length ? Math.max(...vals) : 0;
};

export const computeLocalTopMap = (rows, activeKpi) => {
  const map = {};
  for (const e of rows) {
    const loc = e.local || '—';
    const v = valueOf(e, activeKpi);
    if (!map[loc] || v > map[loc]) map[loc] = v;
  }
  return map;
};

// --- Promedios (solo venta total / prom. diario)
export const computeAverages = (rows, activeKpi) => {
  const vals = rows.map(e => valueOf(e, activeKpi)).filter(v => v > 0);
  const empresaAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  const groups = new Map();
  for (const e of rows) {
    const key = e.local || '—';
    const v = valueOf(e, activeKpi);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  const localAvgMap = {};
  for (const [loc, arr] of groups) {
    const arr2 = arr.filter(v => v > 0);
    localAvgMap[loc] = arr2.length ? (arr2.reduce((a,b)=>a+b,0)/arr2.length) : 0;
  }

  return { empresaAvg, localAvgMap };
};

// --- Ranks locales (fallback cuando no hay latest_kpi.puesto_local)
export const computeLocalRanks = (rows, activeKpi) => {
  // retorna: { [rut]: rank_local }
  const byLocal = new Map();
  for (const e of rows) {
    const loc = e.local || '—';
    if (!byLocal.has(loc)) byLocal.set(loc, []);
    byLocal.get(loc).push(e);
  }
  const out = {};
  for (const [loc, list] of byLocal) {
    list.sort((a, b) => valueOf(b, activeKpi) - valueOf(a, activeKpi));
    list.forEach((e, i) => {
      out[e.rut] = i + 1;
    });
  }
  return out;
};

// --- Helpers UI
export const getUniqueLocals = (rows) => {
  const s = new Set(rows.map(e => e.local).filter(Boolean));
  return Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));
};

// --- Rank indicator
export const RankIndicator = ({ rank }) => {
  if (rank === 1) return <Crown size={16} className="text-yellow-400" />;
  if (rank === 2) return <Crown size={16} className="text-gray-300" />;
  if (rank === 3) return <Crown size={16} className="text-amber-600" />;
  return <>{rank ?? '-'}</>;
};
