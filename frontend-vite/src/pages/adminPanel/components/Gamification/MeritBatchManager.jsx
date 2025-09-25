import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Filter, Send, LoaderCircle, UserCheck } from 'lucide-react';
import { toast } from 'react-toastify';

// Un pequeño helper para los colores de los segmentos
const getSegmentStyle = (symbol) => {
  const styles = {
    'STR': 'bg-red-500/10 text-red-400 border-red-500/30',
    'PER': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'END': 'bg-green-500/10 text-green-400 border-green-500/30',
    'CHA': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    'INT': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'AGI': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'LCK': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  };
  return styles[symbol] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
};

const MeritBatchManager = ({ api, appState }) => {
  const { t } = useTranslation();
  const { meritResults, listMeritResults, buildBatch, isLoading } = api;

  // Estado local del componente
  const [filters, setFilters] = useState({
    periodo_start: '',
    periodo_end: '',
  });
  const [selectedResultIds, setSelectedResultIds] = useState(new Set());
  const [activePeriod, setActivePeriod] = useState(null); // Solo se permite seleccionar un periodo
  const [expandedPeriods, setExpandedPeriods] = useState(new Set()); // acordeones abiertos
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Cargar los resultados iniciales cuando el componente se monta
  useEffect(() => {
    listMeritResults({ mint_status: 'pending', status: 'fulfilled' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => {
    listMeritResults({ ...filters, mint_status: 'pending', status: 'fulfilled' });
  };

  const handleSelect = (result) => {
    const resultId = result.result_id;
    const period = result.periodo;
    // Si no hay periodo activo, fijarlo al del primer elemento seleccionado
    if (!activePeriod) {
      setActivePeriod(period);
    } else if (activePeriod !== period) {
      toast.warn(t('gamification.merit.single_period_only') || 'Solo puedes seleccionar un período a la vez.');
      return;
    }
    const newSelection = new Set(selectedResultIds);
    if (newSelection.has(resultId)) {
      newSelection.delete(resultId);
      // Si quedó vacío, limpiar activePeriod
      if (newSelection.size === 0) setActivePeriod(null);
    } else {
      newSelection.add(resultId);
    }
    setSelectedResultIds(newSelection);
  };

  const handleSelectAll = (period) => {
    const idsInPeriod = meritResults.filter(r => r.periodo === period).map(r => r.result_id);
    const allSelected = idsInPeriod.every(id => selectedResultIds.has(id));
    if (allSelected) {
      const newSelection = new Set([...selectedResultIds].filter(id => !idsInPeriod.includes(id)));
      setSelectedResultIds(newSelection);
      if (newSelection.size === 0) setActivePeriod(null);
    } else {
      setActivePeriod(period);
      setSelectedResultIds(new Set(idsInPeriod));
    }
  };

  // Agrupar resultados por período
  const resultsByPeriod = useMemo(() => {
    const groups = {};
    for (const r of meritResults) {
      const p = r.periodo || 'N/A';
      if (!groups[p]) groups[p] = [];
      groups[p].push(r);
    }
    // Ordenar periodos desc
    const ordered = Object.keys(groups).sort().reverse();
    return { keys: ordered, map: groups };
  }, [meritResults]);

  // Resumen por periodo: empleados únicos y conteo por segmento (CHA 10, INT 40, ...)
  const periodSummaries = useMemo(() => {
    const summary = {};
    for (const p of resultsByPeriod.keys) {
      const arr = resultsByPeriod.map[p];
      const uniqueEmployees = new Set(arr.map(a => a.rut)).size;
      const bySegment = {};
      for (const a of arr) {
        const symbol = a.segment_info?.symbol || 'SEG';
        bySegment[symbol] = (bySegment[symbol] || 0) + 1; // conteo de méritos por segmento
      }
      summary[p] = { uniqueEmployees, bySegment, count: arr.length };
    }
    return summary;
  }, [resultsByPeriod]);

  const togglePeriod = (period) => {
    const set = new Set(expandedPeriods);
    if (set.has(period)) set.delete(period); else set.add(period);
    setExpandedPeriods(set);
  };

  const selectedMerits = useMemo(() => {
    return meritResults.filter(r => selectedResultIds.has(r.result_id));
  }, [meritResults, selectedResultIds]);

  const totals = useMemo(() => {
    const bySegment = selectedMerits.reduce((acc, merit) => {
      const segName = merit.segment_info?.name || 'Desconocido';
      acc[segName] = (acc[segName] || 0) + merit.merit_points;
      return acc;
    }, {});
    const totalPoints = Object.values(bySegment).reduce((sum, pts) => sum + pts, 0);
    const uniqueEmployees = new Set(selectedMerits.map(m => m.rut)).size;
    return { totalPoints, uniqueEmployees, bySegment };
  }, [selectedMerits]);

  const handleGenerateBatch = async () => {
    if (selectedMerits.length === 0) {
      toast.warn(t('gamification.merit.no_selection_warn'));
      return;
    }
    setIsProcessingBatch(true);
    try {
      // Enviar solo para el período activo
      const period = activePeriod || selectedMerits[0].periodo;
      const employees = selectedMerits
        .filter(m => m.periodo === period)
        .map(merit => ({ rut: merit.rut, wallet: merit.wallet }));
      toast.info(t('gamification.merit.processing_period', { period }) || `Procesando batch para ${period}...`);
      const plan = { ym: period, employees };
      await buildBatch({ plan });

      // Refrescar la lista para remover los que ya se pagaron (dar tiempo a indexación)
      setTimeout(() => {
        applyFilters();
        setSelectedResultIds(new Set());
        setActivePeriod(null);
      }, 8000);
    } catch (error) {
      toast.error(error.message || t('gamification.merit.batch_error'));
    } finally {
      setIsProcessingBatch(false);
    }
  };


  return (
    <div className="space-y-8">
      {/* Panel de Filtros */}
      <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter size={20} />
          <h3 className="text-lg font-bold">{t('gamification.merit.filter_title') || 'Filtrar Méritos Pendientes'}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <input type="month" name="periodo_start" value={filters.periodo_start} onChange={handleFilterChange} className="input-field" />
          <input type="month" name="periodo_end" value={filters.periodo_end} onChange={handleFilterChange} className="input-field" />
          <button onClick={applyFilters} disabled={isLoading} className="btn-primary h-10">
            {isLoading ? <LoaderCircle className="animate-spin" /> : t('gamification.merit.apply_filters') || 'Aplicar'}
          </button>
        </div>
      </div>

      {/* Panel de Resumen y Acción */}
      <AnimatePresence>
        {selectedMerits.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-matrix-green/10 border border-matrix-green/30 rounded-xl p-6"
          >
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className='flex-grow'>
                    <h4 className="font-bold text-matrix-green">{t('gamification.merit.selection_summary')}</h4>
                    <div className="text-sm text-dark-text-secondary mt-2 flex flex-wrap gap-x-4 gap-y-2">
                        <span className="flex items-center gap-1.5"><UserCheck size={14} /> {t('gamification.merit.selected_employees', { count: totals.uniqueEmployees })}</span>
                        <span className="flex items-center gap-1.5"><Gift size={14} /> {t('gamification.merit.total_points', { count: totals.totalPoints.toLocaleString() })}</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-matrix-green/20 flex flex-wrap gap-2">
                        {Object.entries(totals.bySegment).map(([name, points]) => (
                            <span key={name} className="px-2 py-1 text-xs font-medium rounded bg-gray-600/20 text-gray-300">
                                {name}: <span className='font-bold text-white'>{points.toLocaleString()}</span>
                            </span>
                        ))}
                    </div>
                </div>
              <motion.button
                onClick={handleGenerateBatch}
                disabled={isProcessingBatch}
                whileHover={{ scale: isProcessingBatch ? 1 : 1.02 }}
                whileTap={{ scale: isProcessingBatch ? 1 : 0.98 }}
                className={`relative group w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-dark transition-all duration-300 overflow-hidden
                  ${isProcessingBatch ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                  bg-gradient-to-r from-matrix-green to-emerald-500 ring-1 ring-matrix-green/50 shadow-[0_0_18px_rgba(0,255,170,0.35)] hover:shadow-[0_0_28px_rgba(0,255,170,0.55)]`}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="absolute -inset-px rounded-full blur-lg opacity-30 group-hover:opacity-40 bg-matrix-green/60" />
                <span className="relative z-10 flex items-center gap-2">
                  {isProcessingBatch ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  <span className="font-semibold tracking-wide">
                    {t('gamification.merit.generate_batch') || 'Generar Batch de Pago'}
                  </span>
                </span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultados por Período (Acordeones) */}
      <div className="space-y-4">
        {resultsByPeriod.keys.map((period) => {
          const arr = resultsByPeriod.map[period];
          const summary = periodSummaries[period] || { uniqueEmployees: 0, bySegment: {}, count: 0 };
          const isExpanded = expandedPeriods.has(period);
          const idsInPeriod = arr.map(r => r.result_id);
          const allSelected = idsInPeriod.length > 0 && idsInPeriod.every(id => selectedResultIds.has(id));
          return (
            <div key={period} className={`border rounded-xl overflow-hidden ${activePeriod && activePeriod !== period ? 'opacity-60' : ''}`}>
              {/* Header del periodo */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-dark-surface-secondary px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePeriod(period)}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-dark-surface hover:bg-dark-surface/60 border border-dark-border/30"
                  >
                    {isExpanded ? (t('gamification.collapse') || 'Cerrar') : (t('gamification.expand') || 'Abrir')}
                  </button>
                  <div className="text-lg font-bold">{period}</div>
                  <div className="text-sm text-dark-text-secondary">{summary.count} méritos • {summary.uniqueEmployees} empleados</div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {Object.entries(summary.bySegment).map(([symbol, count]) => (
                    <span key={symbol} className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getSegmentStyle(symbol)}`}>
                      {symbol}: {count}
                    </span>
                  ))}
                  <button
                    onClick={() => handleSelectAll(period)}
                    className={`ml-2 px-3 py-1.5 text-xs font-semibold rounded ${allSelected ? 'bg-matrix-green/20 text-matrix-green border-matrix-green/40' : 'bg-dark-surface border border-dark-border/30'}`}
                  >
                    {allSelected ? (t('gamification.merit.unselect_all') || 'Quitar selección') : (t('gamification.merit.select_all') || 'Seleccionar todo')}
                  </button>
                </div>
              </div>

              {/* Contenido del periodo */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-dark-surface">
                        <th className="p-4 text-left">{t('gamification.merit.select') || 'Sel'}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('gamification.merit.employee') || 'Empleado'}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('gamification.merit.rule') || 'Regla de Mérito'}</th>
                        <th className="px-4 py-3 text-left font-semibold">{t('gamification.merit.segment') || 'Segmento'}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('gamification.merit.points') || 'Puntos'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border/20">
                      {arr.map((r) => (
                        <tr key={r.result_id} className={`hover:bg-dark-surface-secondary/40 transition-colors ${selectedResultIds.has(r.result_id) ? 'bg-matrix-green/5' : ''}`}>
                          <td className="p-4">
                            <input type="checkbox" checked={selectedResultIds.has(r.result_id)} onChange={() => handleSelect(r)} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={r.employee_photo || `https://ui-avatars.com/api/?name=${r.employee_name}&background=222&color=fff`} alt={r.employee_name} className="w-9 h-9 rounded-full object-cover ring-2 ring-dark-surface" />
                              <div>
                                <div className="font-semibold text-white">{r.employee_name}</div>
                                <div className="text-xs text-dark-text-secondary">{r.employee_cargo || t('gamification.merit.no_cargo') || 'Sin cargo'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-dark-text-secondary">{r.rule_name}</td>
                          <td className="px-4 py-3">
                            {r.segment_info && (
                              <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getSegmentStyle(r.segment_info.symbol)}`}>
                                {r.segment_info.name} ({r.segment_info.symbol})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-matrix-green text-base">{r.merit_points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {resultsByPeriod.keys.length === 0 && !isLoading && (
          <div className="text-center py-12 text-dark-text-secondary">{t('gamification.merit.no_pending') || 'No hay méritos pendientes que coincidan con los filtros.'}</div>
        )}
        {isLoading && (
          <div className="text-center py-12 flex justify-center items-center gap-2 text-dark-text-secondary"><LoaderCircle className="animate-spin" /> {t('common.loading') || 'Cargando…'}</div>
        )}
      </div>
    </div>
  );
};

export default MeritBatchManager;