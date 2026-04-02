import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Send, LoaderCircle, UserCheck, CalendarDays, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';

// Segment colors helper (Apple-style variants)
const getSegmentStyle = (symbol) => {
  const styles = {
    'STR': 'bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
    'PER': 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
    'END': 'bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
    'CHA': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
    'INT': 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
    'AGI': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
    'LCK': 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30',
  };
  return styles[symbol] || 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
};

const isValidEvmAddress = (wallet) => {
  if (!wallet || typeof wallet !== 'string') return false;
  const trimmed = wallet.trim();
  if (!trimmed || trimmed.startsWith('did:')) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
};

const MeritBatchManager = ({ api, appState }) => {
  const { t } = useTranslation();
  const { listMeritPeriods, listMeritResults, buildBatch, meritResults, isLoading } = api;

  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null); // The Currently expanded and queried period
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  
  // Selection state
  const [selectedResultIds, setSelectedResultIds] = useState(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // 1. Fetch available periods on mount
  useEffect(() => {
    const fetchPeriods = async () => {
      setLoadingPeriods(true);
      try {
        const data = await listMeritPeriods({ forceRefresh: true });
        setPeriods(data || []);
      } catch (err) {
        console.error('Error fetching periods', err);
      } finally {
        setLoadingPeriods(false);
      }
    };
    fetchPeriods();
  }, [listMeritPeriods]);

  // 2. Fetch details ONLY for the active period when selected
  useEffect(() => {
    if (activePeriod) {
      listMeritResults({ 
        periodo_start: activePeriod, 
        periodo_end: activePeriod, 
        mint_status: 'pending', 
        status: 'fulfilled' 
      });
      // Clear selection when changing period to avoid mixing
      setSelectedResultIds(new Set());
    }
  }, [activePeriod, listMeritResults]);

  const handleSelect = (resultId) => {
    const newSelection = new Set(selectedResultIds);
    if (newSelection.has(resultId)) {
      newSelection.delete(resultId);
    } else {
      newSelection.add(resultId);
    }
    setSelectedResultIds(newSelection);
  };

  const handleSelectAll = () => {
    const idsInPeriodValid = meritResults
      .filter(r => isValidEvmAddress(r.wallet))
      .map(r => r.result_id);
    
    if (idsInPeriodValid.length === 0) {
      toast.warn(t('gamification.merit.no_valid_wallets') || 'No hay empleados con wallet válida en este período.');
      return;
    }

    const allSelected = idsInPeriodValid.every(id => selectedResultIds.has(id));
    if (allSelected) {
      setSelectedResultIds(new Set());
    } else {
      setSelectedResultIds(new Set(idsInPeriodValid));
    }
  };

  // Derive stats for current active period
  const currentSummary = useMemo(() => {
    if (!meritResults || meritResults.length === 0) return { uniqueEmployees: 0, bySegment: {}, count: 0 };
    
    const activeResults = meritResults.filter(r => r.periodo === activePeriod);
    const uniqueEmployees = new Set(activeResults.map(a => a.rut)).size;
    const bySegment = {};
    for (const a of activeResults) {
      const symbol = a.segment_info?.symbol || 'SEG';
      bySegment[symbol] = (bySegment[symbol] || 0) + 1;
    }
    return { uniqueEmployees, bySegment, count: activeResults.length, results: activeResults };
  }, [meritResults, activePeriod]);

  // Derive selection totals
  const selectedMerits = useMemo(() => {
    return meritResults.filter(r => selectedResultIds.has(r.result_id));
  }, [meritResults, selectedResultIds]);

  const totals = useMemo(() => {
    const bySegment = selectedMerits.reduce((acc, merit) => {
      const segName = merit.segment_info?.name || 'Desc';
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
      const employees = selectedMerits
        .filter(m => isValidEvmAddress(m.wallet))
        .map(merit => ({ rut: merit.rut, wallet: merit.wallet }));
        
      if (employees.length === 0) {
        toast.warn(t('gamification.merit.no_valid_wallets') || 'Ningún empleado seleccionado posee wallet EVM válida.');
        setIsProcessingBatch(false);
        return;
      }

      toast.info(t('gamification.merit.processing_period', { period: activePeriod }) || `Procesando ${activePeriod}...`);
      const plan = { ym: activePeriod, employees };
      await buildBatch({ plan });

      // Refresh data
      setTimeout(async () => {
        await listMeritResults({ 
          periodo_start: activePeriod, 
          periodo_end: activePeriod, 
          mint_status: 'pending', 
          status: 'fulfilled' 
        });
        setSelectedResultIds(new Set());
      }, 5000);
      
    } catch (error) {
      toast.error(error.message || t('gamification.merit.batch_error'));
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Periods Selection Strip (Apple Style Horizontal Scroll or Grid) */}
      <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border-b border-dark-border/10 dark:border-dark-border/20 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-matrix-green/10 text-matrix-green rounded-xl">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">
              {t('gamification.merit.periods_title') || 'Períodos Pendientes'}
            </h3>
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
              Selecciona un mes para cargar los méritos por procesar.
            </p>
          </div>
        </div>

        {loadingPeriods ? (
          <div className="flex justify-center items-center py-6 text-matrix-green">
            <LoaderCircle className="animate-spin" />
            <span className="ml-3 font-semibold text-sm">Buscando períodos...</span>
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-8 px-4 text-light-text-secondary dark:text-dark-text-secondary border-2 border-dashed border-dark-border/20 dark:border-dark-border/30 rounded-2xl">
            <CheckCircle2 className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm font-medium">No hay méritos pendientes registrados.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {periods.map(p => {
              const isActive = activePeriod === p;
              return (
                <button
                  key={p}
                  onClick={() => setActivePeriod(isActive ? null : p)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 border shadow-sm flex items-center gap-2 ${
                    isActive 
                      ? 'bg-matrix-green text-black border-matrix-green scale-105 shadow-matrix-green/20' 
                      : 'bg-white dark:bg-dark-surface border-dark-border/10 dark:border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary hover:border-matrix-green/50 hover:text-matrix-green'
                  }`}
                >
                  <Zap size={14} className={isActive ? 'text-black/70' : 'opacity-0 hidden'} />
                  {p}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Selection Summary & Action Bar (Animated) */}
      <AnimatePresence mode="popLayout">
        {selectedMerits.length > 0 && activePeriod && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="bg-white dark:bg-dark-surface-secondary border border-matrix-green/30 rounded-3xl p-5 shadow-xl shadow-matrix-green/5"
          >
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-matrix-green text-sm uppercase tracking-wider mb-2">
                  {t('gamification.merit.selection_summary') || 'Resumen de Selección'}
                </h4>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <span className="flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary font-medium">
                    <UserCheck className="text-matrix-green" size={16} /> 
                    {totals.uniqueEmployees} Empleados
                  </span>
                  <span className="flex items-center gap-2 text-light-text-primary dark:text-dark-text-primary font-medium">
                    <Gift className="text-matrix-green" size={16} /> 
                    {totals.totalPoints.toLocaleString()} Puntos Totales
                  </span>
                </div>
                {/* Segment breakdown pills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(totals.bySegment).map(([name, points]) => (
                    <span key={name} className="px-2 py-1 text-[10px] font-bold rounded-lg bg-gray-100 dark:bg-gray-800 text-light-text-primary dark:text-dark-text-primary border border-dark-border/10">
                      {name}: <span className="text-matrix-green">{points.toLocaleString()}</span>
                    </span>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleGenerateBatch}
                disabled={isProcessingBatch}
                className={`relative group w-full lg:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-black font-bold transition-all duration-300 overflow-hidden shadow-lg
                  ${isProcessingBatch ? 'opacity-70 cursor-not-allowed bg-matrix-green/80' : 'cursor-pointer bg-matrix-green hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]'}`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isProcessingBatch ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />}
                  <span>{t('gamification.merit.generate_batch') || 'Generar Batch'}</span>
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Detail View for the Active Period */}
      <AnimatePresence mode="wait">
        {activePeriod && (
          <motion.div
            key={activePeriod}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-dark-surface rounded-3xl overflow-hidden border border-dark-border/10 dark:border-dark-border/20 shadow-sm"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-dark-border/10 dark:border-dark-border/20 bg-gray-50/50 dark:bg-dark-surface-secondary/20">
              <div>
                <h4 className="text-xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
                  {activePeriod}
                </h4>
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                  {currentSummary.count} méritos guardados • {currentSummary.uniqueEmployees} empleados
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(currentSummary.bySegment).map(([symbol, count]) => (
                  <span key={symbol} className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${getSegmentStyle(symbol)}`}>
                    {symbol}: {count}
                  </span>
                ))}
                
                <button
                  onClick={handleSelectAll}
                  disabled={isLoading || currentSummary.count === 0}
                  className="ml-2 px-4 py-1.5 text-xs font-bold rounded-xl bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-light-text-primary dark:text-dark-text-primary transition-colors disabled:opacity-50"
                >
                  {currentSummary.results?.every(r => selectedResultIds.has(r.result_id)) && currentSummary.count > 0
                    ? 'Quitar todo' 
                    : 'Seleccionar Válidos'}
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto min-h-[300px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-48 text-light-text-secondary dark:text-dark-text-secondary gap-3">
                  <LoaderCircle className="animate-spin text-matrix-green" size={28} />
                  <span className="text-sm font-medium">Cargando detalles del período...</span>
                </div>
              ) : currentSummary.results?.length > 0 ? (
                <table className="min-w-full text-sm text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-100/50 dark:bg-dark-surface-secondary/40 text-[11px] uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
                      <th className="py-3 px-6 font-bold w-12">Sel</th>
                      <th className="py-3 px-6 font-bold">Empleado</th>
                      <th className="py-3 px-6 font-bold">Motivo (Regla)</th>
                      <th className="py-3 px-6 font-bold">Segmento</th>
                      <th className="py-3 px-6 font-bold text-right">Recompensa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border/10 dark:divide-dark-border/20">
                    {[...currentSummary.results].sort((a, b) => {
                      const aOk = isValidEvmAddress(a.wallet);
                      const bOk = isValidEvmAddress(b.wallet);
                      if (aOk === bOk) return 0;
                      return aOk ? -1 : 1; 
                    }).map((r) => {
                      const walletOk = isValidEvmAddress(r.wallet);
                      const isSelected = selectedResultIds.has(r.result_id);
                      return (
                        <tr 
                          key={r.result_id} 
                          onClick={() => { if(walletOk) handleSelect(r.result_id); }}
                          className={`group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-dark-surface-secondary/60 ${isSelected ? 'bg-matrix-green/[0.03] dark:bg-matrix-green/[0.05]' : 'bg-white dark:bg-transparent'}`}
                        >
                          <td className="py-4 px-6 relative" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => handleSelect(r.result_id)} 
                                disabled={!walletOk} 
                                className="w-4 h-4 text-matrix-green rounded border-gray-300 focus:ring-matrix-green dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <img src={r.employee_photo || `https://ui-avatars.com/api/?name=${r.employee_name}&background=222&color=fff`} alt={r.employee_name} className="w-10 h-10 rounded-full object-cover shadow-sm bg-gray-200 dark:bg-gray-800" />
                              <div>
                                <div className={`font-bold ${!walletOk ? 'text-light-text-secondary dark:text-dark-text-secondary line-through opacity-70' : 'text-light-text-primary dark:text-dark-text-primary'}`}>{r.employee_name}</div>
                                <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mt-0.5">{r.employee_cargo || 'Sin cargo'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 max-w-[200px] truncate text-light-text-secondary dark:text-dark-text-secondary font-medium">
                            {r.rule_name}
                          </td>
                          <td className="py-4 px-6">
                            {r.segment_info && (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-lg border ${getSegmentStyle(r.segment_info.symbol)}`}>
                                {r.segment_info.name}
                              </span>
                            )}
                            {!walletOk && (
                              <div className="mt-1.5 text-[10px] text-red-500 dark:text-red-400 font-bold flex items-center gap-1">
                                🚫 Requiere Wallet Ligada
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right font-black text-matrix-green text-base">
                            +{r.merit_points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-16 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                  No se encontraron méritos listos para procesar en este mes.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MeritBatchManager;