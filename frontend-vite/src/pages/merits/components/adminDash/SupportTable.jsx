// src/pages/merits/components/adminDash/SupportTable.jsx
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Search, MapPin } from 'lucide-react';

// Cargos que son PRIORITARIOS (garzones) — se muestran por defecto
const PRIORITY_CARGOS = new Set(['Garzon', 'Aprendiz Garzon']);

const SupportTable = ({ supportData, loading }) => {
  const [search, setSearch] = useState('');
  const [filterLocal, setFilterLocal] = useState('all');
  const [filterCargo, setFilterCargo] = useState('priority'); // 'priority' = solo garzones, 'all' = todos

  const missing = supportData?.missing || [];
  const totalSalesWorkers = supportData?.total_sales_workers || 0;

  // Cargos únicos disponibles
  const cargoOptions = useMemo(() => {
    const set = new Set(missing.map(w => w.cargo).filter(Boolean));
    return Array.from(set).sort();
  }, [missing]);

  // Conteos
  const priorityCount = useMemo(() => missing.filter(w => PRIORITY_CARGOS.has(w.cargo)).length, [missing]);
  const otherCount = useMemo(() => missing.filter(w => !PRIORITY_CARGOS.has(w.cargo)).length, [missing]);

  // Locales únicos (del set filtrado por cargo)
  const locales = useMemo(() => {
    const base = filterCargo === 'priority'
      ? missing.filter(w => PRIORITY_CARGOS.has(w.cargo))
      : filterCargo === 'all'
        ? missing
        : missing.filter(w => w.cargo === filterCargo);
    const set = new Set(base.map(w => w.local).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [missing, filterCargo]);

  // Filtrado
  const filtered = useMemo(() => {
    let list = missing;

    // Cargo filter
    if (filterCargo === 'priority') {
      list = list.filter(w => PRIORITY_CARGOS.has(w.cargo));
    } else if (filterCargo !== 'all') {
      list = list.filter(w => w.cargo === filterCargo);
    }

    // Local
    if (filterLocal !== 'all') list = list.filter(w => w.local === filterLocal);

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        (w.nombre || '').toLowerCase().includes(q) ||
        (w.apellido || '').toLowerCase().includes(q) ||
        (w.rut || '').includes(q) ||
        (w.local || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [missing, filterCargo, filterLocal, search]);

  // Grouped by local
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(w => {
      const loc = w.local || 'Sin local';
      if (!map[loc]) map[loc] = [];
      map[loc].push(w);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const isPriority = filterCargo === 'priority';

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-dark-surface border border-dark-border/10 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl ${isPriority ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
            <AlertTriangle size={18} className={isPriority ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-dark-text-primary">
              {isPriority ? 'Garzones sin registro de venta' : 'Personal de ventas sin registro'}
            </h3>
            <p className="text-[11px] text-dark-text-secondary">
              {isPriority
                ? <>{priorityCount} garzones sin RUT de venta · <span className="text-dark-text-secondary/50">{otherCount} otros cargos disponibles con filtro</span></>
                : <>{filtered.length} de {totalSalesWorkers} empleados con cargo de venta sin KPIs</>
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-text-secondary/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-dark-surface-secondary border border-dark-border/20 text-dark-text-primary outline-none focus:ring-1 focus:ring-red-400/30 w-36"
            />
          </div>

          {/* Cargo filter */}
          <select
            value={filterCargo}
            onChange={e => { setFilterCargo(e.target.value); setFilterLocal('all'); }}
            className={`px-2.5 py-1.5 text-xs rounded-lg border outline-none font-semibold ${
              isPriority
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-dark-surface-secondary border-dark-border/20 text-dark-text-primary'
            }`}
          >
            <option value="priority">🔴 Solo Garzones</option>
            <option value="all">Todos los cargos</option>
            {cargoOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Local filter */}
          <select
            value={filterLocal}
            onChange={e => setFilterLocal(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-dark-surface-secondary border border-dark-border/20 text-dark-text-primary outline-none"
          >
            {locales.map(l => (
              <option key={l} value={l}>{l === 'all' ? 'Todos locales' : l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-dark-border/15 rounded-2xl text-center">
          <AlertTriangle size={32} className="text-dark-text-secondary/20 mb-3" strokeWidth={1.2} />
          <p className="text-sm font-semibold text-dark-text-secondary">
            {missing.length === 0
              ? '¡Todos los garzones tienen ventas registradas!'
              : isPriority && priorityCount === 0
                ? '¡Todos los garzones tienen ventas! Hay otros cargos pendientes, usa el filtro.'
                : 'Sin resultados con ese filtro'}
          </p>
        </div>
      ) : (
        /* Grouped cards */
        <div className="space-y-4">
          {grouped.map(([local, workers]) => {
            const isRed = isPriority || workers.some(w => PRIORITY_CARGOS.has(w.cargo));
            const borderColor = isRed ? 'border-red-500/15' : 'border-amber-500/15';
            const headerBg = isRed ? 'bg-red-500/5 border-red-500/10' : 'bg-amber-500/5 border-amber-500/10';
            const accentColor = isRed ? 'text-red-400' : 'text-amber-400';
            const badgeBg = isRed ? 'bg-red-500/10 text-red-400/60' : 'bg-amber-500/10 text-amber-400/60';

            return (
              <div key={local} className={`bg-dark-surface border ${borderColor} rounded-xl overflow-hidden`}>
                {/* Local header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 ${headerBg} border-b`}>
                  <MapPin size={12} className={accentColor} />
                  <span className={`text-xs font-bold ${accentColor}`}>{local}</span>
                  <span className={`ml-auto text-[10px] font-bold ${badgeBg} px-2 py-0.5 rounded-full`}>
                    {workers.length} sin venta
                  </span>
                </div>

                <div className="divide-y divide-dark-border/8">
                  {workers.map(w => {
                    const wIsPriority = PRIORITY_CARGOS.has(w.cargo);
                    return (
                      <div key={w.rut} className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${wIsPriority ? 'hover:bg-red-500/[0.02]' : 'hover:bg-amber-500/[0.02]'}`}>
                        {/* Avatar */}
                        {w.profile_image_url ? (
                          <img src={w.profile_image_url} alt="" className="w-8 h-8 rounded-full object-cover border border-dark-border/20 shrink-0" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                            wIsPriority ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {(w.nombre || '?')[0]?.toUpperCase()}{(w.apellido || '')[0]?.toUpperCase()}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-dark-text-primary truncate">
                            {w.nombre} {w.apellido}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-medium ${wIsPriority ? 'text-dark-text-secondary' : 'text-amber-400/70'}`}>
                              {w.cargo}
                            </span>
                            <span className="text-[10px] text-dark-text-secondary/40">RUT: {w.rut}</span>
                          </div>
                        </div>

                        {/* Issue badge */}
                        <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-lg border ${
                          wIsPriority
                            ? 'text-red-400 bg-red-500/10 border-red-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}>
                          ⚠ {w.issue_label || 'Sin ventas'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Exportar conteo de prioridad para el badge del tab
SupportTable.getPriorityCount = (supportData) => {
  const missing = supportData?.missing || [];
  return missing.filter(w => PRIORITY_CARGOS.has(w.cargo)).length;
};

export default SupportTable;
