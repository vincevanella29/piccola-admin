import React, { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import useMeritDisplay from '../../../../hooks/useMeritDisplay';

// piezas
import { Th, Td } from './TableParts.jsx';
import KpiRow from './KpiRow.jsx';
import MeritsRow from './MeritsRow.jsx';

// config/helpers
import {
  KPI_TABS,
  MERITS_TAB,
  SEG_ORDER,
  getLatestBundle,
  computeCompanyTop,
  computeLocalTopMap,
  computeAverages,
  computeLocalRanks,
  getVarPct,
  getPrevVal,
  valueOf,
  isTotalOrDaily,
  fmtNum,
  getUniqueLocals,
} from './kpiConfig';

export default function EmployeeTable({
  employees,
  onSort,
  sortConfig,
  onSelectEmployee,
  loading,
  compareLabel, // opcional
}) {
  // Estado general
  const [activeTab, setActiveTab] = useState('venta_total'); // KPI_TABS.key | 'merits'
  const [onlyCompetitors, setOnlyCompetitors] = useState(false);

  // Filtros UI
  const [filterLocal, setFilterLocal] = useState('Todos');
  const [filterText, setFilterText] = useState('');

  // Paginación
  const [pageSize, setPageSize] = useState(20); // 10 / 20 / 50 / 100
  const [page, setPage] = useState(1);

  // Méritos: modo y sort local
  const [mode, setMode] = useState('wallet'); // 'wallet' | 'simulated'
  const [meritsSort, setMeritsSort] = useState({ key: 'total', direction: 'desc' });

  // KPI: sort local (para columnas nuevas # Emp / # Local)
  const [kpiLocalSort, setKpiLocalSort] = useState(null); // { key:'rankEmp'|'rankLoc'|'nombre', direction:'asc'|'desc' } | null

  // Hooks de méritos preparados
  const { enrichedEmployees } = useMeritDisplay(employees);
  const baseEmployees = useMemo(
    () => (enrichedEmployees?.length ? enrichedEmployees : (employees || [])),
    [enrichedEmployees, employees]
  );

  // Filtro competidores
  const filteredByComp = useMemo(
    () => (onlyCompetitors ? baseEmployees.filter(e => !!e.es_competidor) : baseEmployees),
    [baseEmployees, onlyCompetitors]
  );

  const isMerits = activeTab === 'merits';
  const activeKpi = KPI_TABS.find(t => t.key === activeTab) || KPI_TABS[0];

  // Locales para selector
  const localOptions = useMemo(() => ['Todos', ...getUniqueLocals(filteredByComp)], [filteredByComp]);

  // Filtrar por local + texto
  const textMatch = (e, q) => {
    if (!q) return true;
    const s = `${e?.nombre || ''} ${e?.apellido || ''}`.toLowerCase();
    return s.includes(q.toLowerCase());
  };
  const localMatch = (e, loc) => loc === 'Todos' || (e.local || '') === loc;

  // DATA base para el tab actual
  const baseForTab = useMemo(() => {
    const arr = filteredByComp.filter(e => localMatch(e, filterLocal) && textMatch(e, filterText));
    return arr;
  }, [filteredByComp, filterLocal, filterText]);

  // ---- MÉRITOS: orden local (por columna de segmento o total / rank / nombre / wallet)
  const toggleMeritsSort = (key) => {
    setMeritsSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const meritsEmployeesSorted = useMemo(() => {
    if (!isMerits) return [];
    const dir = meritsSort.direction === 'asc' ? 1 : -1;
    return [...baseForTab].sort((a, b) => {
      const by = (emp) => {
        const disp = (emp?.__meritDisplay?.[mode]) || null; // no cache, se calcula inline abajo
        return disp;
      };
      // inline: obtenemos puntos por símbolo
      const getBySym = (emp) => {
        const rows = (emp?.__merit?.rowsCache?.[mode]) || null;
        if (rows) return rows;
        // construir simple desde __merit
        const wm = emp.__merit?.walletBySegment || {};
        const pm = emp.__merit?.pendingBySegment || {};
        const all = [...new Set([...Object.keys(wm), ...Object.keys(pm)])];
        const map = {};
        all.forEach(s => {
          const w = Number(wm[s] || 0), p = Number(pm[s] || 0);
          map[s] = mode === 'wallet' ? w : (w + p);
        });
        return map;
      };

      const mapA = getBySym(a);
      const mapB = getBySym(b);
      const totA = Object.values(mapA).reduce((s, v) => s + v, 0);
      const totB = Object.values(mapB).reduce((s, v) => s + v, 0);

      const k = meritsSort.key;
      if (k === 'total') return (totA - totB) * dir;
      if (SEG_ORDER.includes(k)) return ((mapA[k] || 0) - (mapB[k] || 0)) * dir;
      if (k === 'rank') {
        const ra = a.puesto_empresa ?? Number.POSITIVE_INFINITY;
        const rb = b.puesto_empresa ?? Number.POSITIVE_INFINITY;
        return (ra - rb) * dir;
      }
      if (k === 'nombre') {
        const na = `${a.nombre || ''} ${a.apellido || ''}`.trim();
        const nb = `${b.nombre || ''} ${b.apellido || ''}`.trim();
        return na.localeCompare(nb) * dir;
      }
      if (k === 'wallet') {
        const wa = a.wallet || a.merit_profile?.wallet ? 1 : 0;
        const wb = b.wallet || b.merit_profile?.wallet ? 1 : 0;
        return (wa - wb) * dir;
      }
      return 0;
    });
  }, [isMerits, baseForTab, meritsSort, mode]);

  // ---- KPI: agregados para top/promedios/ranks (TODAS las filas KPI) ----
  const companyTopFallback = useMemo(() => {
    if (isMerits) return 0;
    return computeCompanyTop(baseForTab, activeKpi);
  }, [baseForTab, isMerits, activeKpi]);

  const localTopMapFallback = useMemo(() => {
    if (isMerits) return {};
    return computeLocalTopMap(baseForTab, activeKpi);
  }, [baseForTab, isMerits, activeKpi]);

  const localRanksFallback = useMemo(() => {
    if (isMerits) return {};
    return computeLocalRanks(baseForTab, activeKpi);
  }, [baseForTab, isMerits, activeKpi]);

  const { empresaAvg, localAvgMap } = useMemo(() => {
    if (isMerits || !isTotalOrDaily(activeKpi.key)) return { empresaAvg: 0, localAvgMap: {} };
    return computeAverages(baseForTab, activeKpi);
  }, [baseForTab, isMerits, activeKpi]);

  // Orden headers (KPI externo vs Méritos local)
  const getSortIcon = (key) => {
    if (isMerits) return null;
    if (sortConfig?.key !== key) return <ArrowUpDown size={14} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const handleTab = (key) => {
    setActiveTab(key);
    setKpiLocalSort(null);
    setPage(1);
    if (key === 'merits') return;
    const tab = KPI_TABS.find(t => t.key === key);
    if (tab && onSort) onSort(tab.sortKey);
  };

  const toggleKpiLocalSort = (key) => {
    setKpiLocalSort(prev => {
      const dir = prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction: dir };
    });
    setPage(1);
  };

  // KPI rows (aplicamos sort local si se pidió por # Emp / # Local / nombre)
  const kpiRowsSorted = useMemo(() => {
    if (isMerits) return [];
    if (!kpiLocalSort) return baseForTab;
    const dir = kpiLocalSort.direction === 'asc' ? 1 : -1;
    return [...baseForTab].sort((a, b) => {
      const latestA = getLatestBundle(a, activeKpi);
      const latestB = getLatestBundle(b, activeKpi);
      const rankEmpA = latestA?.rankEmp ?? a.puesto_empresa ?? Number.POSITIVE_INFINITY;
      const rankEmpB = latestB?.rankEmp ?? b.puesto_empresa ?? Number.POSITIVE_INFINITY;
      const rankLocA = latestA?.rankLoc ?? localRanksFallback[a.rut] ?? Number.POSITIVE_INFINITY;
      const rankLocB = latestB?.rankLoc ?? localRanksFallback[b.rut] ?? Number.POSITIVE_INFINITY;

      if (kpiLocalSort.key === 'rankEmp') return (rankEmpA - rankEmpB) * dir;
      if (kpiLocalSort.key === 'rankLoc') return (rankLocA - rankLocB) * dir;
      if (kpiLocalSort.key === 'nombre') {
        const na = `${a.nombre || ''} ${a.apellido || ''}`.trim();
        const nb = `${b.nombre || ''} ${b.apellido || ''}`.trim();
        return na.localeCompare(nb) * dir;
      }
      return 0;
    });
  }, [isMerits, baseForTab, kpiLocalSort, activeKpi, localRanksFallback]);

  // Paginación
  const totalRows = isMerits ? meritsEmployeesSorted.length : kpiRowsSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = (rows) => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const displayRows = isMerits ? pageSlice(meritsEmployeesSorted) : pageSlice(kpiRowsSorted);

  // colSpan dinámico en el tab de Méritos
  const MERITS_COLS = 2 /*#Emp + Colaborador*/ + SEG_ORDER.length + 1 /*total*/ + 1 /*wallet*/;

  const handleChangePageSize = (n) => {
    setPageSize(n);
    setPage(1);
  };

  return (
    <div className="rounded-xl border border-dark-border/20 bg-dark-surface">
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-2 text-xs">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider text-dark-text-secondary">Ranking por:</span>
            <div className="flex flex-wrap gap-2">
              {[...KPI_TABS, MERITS_TAB].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs border ${activeTab === tab.key ? 'border-matrix-green/40 bg-matrix-green/10 text-matrix-green' : 'border-dark-border/30 text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
                  title={tab.key === 'merits' ? 'Ver puntos por segmento (fila por empleado)' : `Ordenar por ${tab.label}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro Competidores */}
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider text-dark-text-secondary">Mostrar:</span>
            <div className="inline-flex rounded-lg overflow-hidden border border-dark-border/30">
              <button
                onClick={() => setOnlyCompetitors(false)}
                className={`px-3 py-1.5 transition-colors ${!onlyCompetitors ? 'bg-matrix-green/20 text-matrix-green font-semibold' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
                title="Mostrar todos"
              >Todos</button>
              <button
                onClick={() => setOnlyCompetitors(true)}
                className={`px-3 py-1.5 border-l border-dark-border/30 transition-colors ${onlyCompetitors ? 'bg-matrix-green/20 text-matrix-green font-semibold' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
                title="Sólo competidores"
              >Competidores</button>
            </div>
          </div>
        </div>

        {/* Toolbar específica de cada tab */}
        {isMerits ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Wallet / Simulado */}
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-dark-text-secondary">Puntos:</span>
              <div className="inline-flex rounded-lg overflow-hidden border border-dark-border/30">
                <button
                  onClick={() => setMode('wallet')}
                  className={`px-3 py-1.5 transition-colors ${mode === 'wallet' ? 'bg-matrix-green/20 text-matrix-green font-semibold' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
                  title="Mostrar sólo méritos minteados (en wallet)"
                >Wallet</button>
                <button
                  onClick={() => setMode('simulated')}
                  className={`px-3 py-1.5 border-l border-dark-border/30 transition-colors ${mode === 'simulated' ? 'bg-matrix-green/20 text-matrix-green font-semibold' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
                  title="Mostrar wallet + pendientes"
                >Simulado</button>
              </div>
            </div>
          </div>
        ) : (
          // Filtros de tabla para KPI
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wider text-dark-text-secondary">Local:</span>
              <select
                value={filterLocal}
                onChange={(e) => { setFilterLocal(e.target.value); setPage(1); }}
                className="bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1 text-xs"
                title="Filtrar por local"
              >
                {localOptions.map(loc => <option key={`loc-${loc}`} value={loc}>{loc}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wider text-dark-text-secondary">Buscar:</span>
              <input
                type="text"
                value={filterText}
                onChange={(e) => { setFilterText(e.target.value); setPage(1); }}
                placeholder="Nombre del colaborador..."
                className="bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1 text-xs min-w-[220px]"
                title="Buscar por nombre"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="uppercase tracking-wider text-dark-text-secondary">Filas:</span>
              <select
                value={pageSize}
                onChange={(e) => handleChangePageSize(Number(e.target.value))}
                className="bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1 text-xs"
                title="Filas por página"
              >
                {[10, 20, 50, 100].map(n => <option key={`ps-${n}`} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          {/* Header de columnas */}
          <thead className="bg-dark-surface-secondary/50">
            <tr>
              {/* # Emp */}
              {!isMerits ? (
                <Th
                  onSort={() => toggleKpiLocalSort('rankEmp')}
                  align="center"
                  title="Posición empresa"
                ># Emp</Th>
              ) : (
                <Th align="center" title="Puesto empresa">#</Th>
              )}

              {/* # Local (solo KPI) */}
              {!isMerits && (
                <Th
                  onSort={() => toggleKpiLocalSort('rankLoc')}
                  align="center"
                  title="Posición local"
                ># Local</Th>
              )}

              {/* Colaborador */}
              <Th
                onSort={!isMerits ? () => toggleKpiLocalSort('nombre') : () => toggleMeritsSort('nombre')}
                title="Colaborador"
              >
                Colaborador
              </Th>

              {/* KPI vs Méritos (encabezados) */}
              {!isMerits ? (
                <Th
                  onSort={() => { setKpiLocalSort(null); onSort?.(activeKpi.sortKey); }}
                  icon={!kpiLocalSort ? (sortConfig?.key ? undefined : undefined) : null}
                  align={activeKpi.align}
                  title={activeKpi.head}
                >
                  {activeKpi.head}
                </Th>
              ) : (
                // Méritos: columnas por segmento + Total + Wallet
                <>
                  {SEG_ORDER.map(sym => (
                    <Th
                      key={`thm-${sym}`}
                      align="right"
                      onSort={() => toggleMeritsSort(sym)}
                      title={`Ordenar por ${sym}`}
                    >{sym}</Th>
                  ))}
                  <Th
                    align="right"
                    onSort={() => toggleMeritsSort('total')}
                    title={`Puntos (${mode === 'simulated' ? 'Simulado' : 'Wallet'})`}
                  >Total ({mode === 'simulated' ? 'Sim' : 'Wallet'})</Th>
                  <Th align="center" title="Tiene wallet asociada">Wallet</Th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {/* Loading / vacíos */}
            {loading && (
              <tr>
                <td colSpan={isMerits ? MERITS_COLS : 4 /* #Emp + #Local + Colaborador + KPI */} className="text-center p-8 text-dark-text-secondary">
                  Cargando ranking...
                </td>
              </tr>
            )}

            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={isMerits ? MERITS_COLS : 4} className="text-center p-8 text-dark-text-secondary">
                  No se encontraron resultados.
                </td>
              </tr>
            )}

            {/* --- Filas KPI --- */}
            {!loading && !isMerits && displayRows.map((emp) => {
              const val = valueOf(emp, activeKpi);
              const varPct = getVarPct(emp, activeKpi);
              const prevVal = getPrevVal(emp, activeKpi);
              const latest = getLatestBundle(emp, activeKpi);

              // ranks prefer latest, fallback
              const rankEmp = latest?.rankEmp ?? emp.puesto_empresa ?? null;
              const rankLoc = latest?.rankLoc ?? localRanksFallback[emp.rut] ?? null;

              // promedios: sólo si aplica
              const useEmpresaAvg = isTotalOrDaily(activeKpi.key) ? (empresaAvg || latest?.avgEmp || null) : null;
              const useLocalAvgMap = isTotalOrDaily(activeKpi.key) ? (localAvgMap || {}) : {};

              return (
                <KpiRow
                  key={emp.rut}
                  emp={emp}
                  activeKpi={activeKpi}
                  latest={latest}
                  companyTopFallback={companyTopFallback}
                  localTopMapFallback={localTopMapFallback}
                  empresaAvg={useEmpresaAvg}
                  localAvgMap={useLocalAvgMap}
                  val={val}
                  varPct={varPct}
                  prevVal={prevVal}
                  compareLabel={compareLabel}
                  onClickRow={() => onSelectEmployee?.(emp)}
                  rankEmp={rankEmp}
                  rankLoc={rankLoc}
                />
              );
            })}

            {/* --- Filas Méritos: UNA FILA POR EMPLEADO CON COLUMNAS POR SEGMENTO --- */}
            {!loading && isMerits && displayRows.map((emp) => (
              <MeritsRow
                key={`merits-emp-${emp.rut}`}
                emp={emp}
                mode={mode}
                getDisplayFor={(e, m) => {
                  // reutilizamos hook de manera segura: a esta altura __merit existe
                  const wm = e.__merit?.walletBySegment || {};
                  const pm = e.__merit?.pendingBySegment || {};
                  const all = [...new Set([...Object.keys(wm), ...Object.keys(pm)])];
                  const rows = all.map(symbol => ({
                    symbol,
                    points: m === 'wallet' ? Number(wm[symbol] || 0) : Number(wm[symbol] || 0) + Number(pm[symbol] || 0),
                  }));
                  const total = rows.reduce((s, r) => s + r.points, 0);
                  return { rows, total };
                }}
                onClickRow={() => onSelectEmployee?.(emp)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between px-4 py-3 text-xs border-t border-dark-border/10">
        <div className="text-dark-text-secondary">
          Mostrando{' '}
          <b>{Math.min((currentPage - 1) * pageSize + 1, totalRows)}</b>–<b>{Math.min(currentPage * pageSize, totalRows)}</b>{' '}
          de <b>{fmtNum.format(totalRows)}</b>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border border-dark-border/30 rounded disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <span className="px-2">Página {currentPage} / {totalPages}</span>
          <button
            className="px-2 py-1 border border-dark-border/30 rounded disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Siguiente →
          </button>
          {!isMerits && (
            <select
              value={pageSize}
              onChange={(e) => handleChangePageSize(Number(e.target.value))}
              className="ml-2 bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1 text-xs"
              title="Filas por página"
            >
              {[10, 20, 50, 100].map(n => <option key={`ps2-${n}`} value={n}>{n} / pág</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
