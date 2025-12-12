// src/pages/employees_register/components/tabs/AnalisisProductosPanel.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LoaderCircle, Info, BarChart2, FileText, 
    Store, Building, Trophy, ArrowUpRight, 
    ArrowDownRight, Minus, Calendar, Filter, Sparkles
} from 'lucide-react';
import { Tooltip as ReactTooltip } from 'react-tooltip';

// --- Helper: Formateo de Moneda ---
const formatCurrency = (val) => 
    Number(val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

// --- COMPONENTE: Variation Badge ---
const VariationBadge = ({ value }) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isNeutral = value === 0;

    if (isNeutral) return <span className="text-[10px] text-light-text-tertiary dark:text-gray-500 font-mono flex items-center gap-1"><Minus size={10} /> 0%</span>;

    return (
        <div className={`flex items-center gap-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
            isPositive 
                ? 'text-light-success dark:text-dark-success bg-light-success/10 border-light-success/20' 
                : 'text-light-error dark:text-dark-error bg-light-error/10 border-light-error/20'
        }`}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(value).toFixed(1)}%
        </div>
    );
};

// --- COMPONENTE: Slim Benchmark Bar ---
const SlimBenchmark = ({ value, top, avg, label, colorClass, icon: Icon }) => {
    const percent = Math.min(((value || 0) / (top || 1)) * 100, 100);
    const avgPercent = Math.min(((avg || 0) / (top || 1)) * 100, 100);

    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-1">
                <span className="text-[9px] uppercase font-bold text-light-text-tertiary dark:text-gray-500 tracking-wider flex items-center gap-1">
                    <Icon size={10} className={colorClass} /> {label}
                </span>
                <div className="text-[9px] font-mono text-light-text-secondary dark:text-gray-400 flex gap-2">
                    <span className="opacity-70">Avg: {formatCurrency(avg)}</span>
                    <span className="font-bold">Top: {formatCurrency(top)}</span>
                </div>
            </div>
            <div className="relative h-1.5 w-full bg-light-surface-secondary dark:bg-white/10 rounded-full overflow-hidden">
                {/* Marker Promedio */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-light-text-secondary/40 dark:bg-dark-text-secondary/50 z-10" style={{ left: `${avgPercent}%` }} />
                {/* Barra Principal */}
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${colorClass === 'text-light-accent' ? 'bg-light-accent shadow-neon' : 'bg-vanellix-cyan shadow-neon'}`}
                />
            </div>
        </div>
    );
};

// --- COMPONENTE: Ranking Box (Mini Card) ---
const RankingBox = ({ periodKey, ranks }) => {
    const { t } = useTranslation();
    // ranks = { puesto_local, puesto_empresa }
    const hasLocal = ranks?.puesto_local != null;
    const hasEmpresa = ranks?.puesto_empresa != null;
    
    if (!hasLocal && !hasEmpresa) return null;

    return (
        <div className="flex-1 bg-light-surface-secondary/30 dark:bg-white/5 rounded-lg border border-light-border/5 dark:border-white/5 p-2 flex flex-col items-center">
            <span className="text-[8px] font-bold text-light-text-tertiary dark:text-gray-500 uppercase tracking-wide mb-1">{t(periodKey)}</span>
            <div className="flex gap-2">
                {hasLocal && (
                    <span className="text-xs font-black text-yellow-600 dark:text-yellow-500" title="Local">
                        L#{ranks.puesto_local}
                    </span>
                )}
                {hasEmpresa && (
                    <span className="text-xs font-black text-cyan-600 dark:text-cyan-400" title="Empresa">
                        E#{ranks.puesto_empresa}
                    </span>
                )}
            </div>
        </div>
    );
};

// --- TARJETA DE ANÁLISIS (Card Principal) ---
const AnalysisCard = ({ title, data, index }) => {
    const { t } = useTranslation();
    const { tus_ventas, comparativo_anual, benchmark_local, benchmark_empresa, ranking } = data;
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group flex flex-col bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/20 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
        >
            {/* Header: Título y Venta Principal */}
            <div className="p-5 relative">
                {/* Decoration */}
                <div className="absolute top-0 right-0 p-8 bg-light-accent/5 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none group-hover:bg-light-accent/10 transition-colors" />

                <div className="relative z-10 flex justify-between items-start mb-3">
                    <h4 className="text-sm font-bold text-light-text-primary dark:text-white leading-tight max-w-[70%]">
                        {title}
                    </h4>
                    <div className="flex flex-col items-end">
                        <VariationBadge value={comparativo_anual?.variacion_porcentual || 0} />
                        <span className="text-[9px] text-light-text-tertiary dark:text-gray-500 mt-0.5">{t('mificha.analisis_vs_anio_anterior', 'vs Año Ant.')}</span>
                    </div>
                </div>

                <div className="relative z-10 mb-4">
                    <div className="text-[10px] font-bold text-light-text-tertiary dark:text-gray-500 uppercase tracking-wide">{t('mificha.analisis_tus_ventas', 'Tus Ventas')}</div>
                    <div className="text-2xl font-black text-light-text-primary dark:text-white tabular-nums tracking-tight">
                        {formatCurrency(tus_ventas)}
                    </div>
                </div>

                {/* Benchmarks Section */}
                <div className="relative z-10 space-y-3">
                    {benchmark_local && (
                        <SlimBenchmark 
                            value={tus_ventas} 
                            avg={benchmark_local.promedio} 
                            top={benchmark_local.top} 
                            label={t('mificha.comparativa_local', 'Local')} 
                            icon={Store} 
                            colorClass="text-yellow-500" 
                        />
                    )}
                    {benchmark_empresa && (
                        <SlimBenchmark 
                            value={tus_ventas} 
                            avg={benchmark_empresa.promedio} 
                            top={benchmark_empresa.top} 
                            label={t('mificha.comparativa_empresa', 'Empresa')} 
                            icon={Building} 
                            colorClass="text-cyan-400" 
                        />
                    )}
                </div>
            </div>

            {/* Footer: Rankings Grid */}
            <div className="mt-auto p-3 bg-light-surface-tertiary/10 dark:bg-dark-surface-secondary/40 border-t border-light-border/5 dark:border-dark-border/20 flex gap-2">
                <RankingBox periodKey="mificha.analisis_periodo_actual" ranks={ranking?.actual} />
                <RankingBox periodKey="mificha.analisis_periodo_anterior" ranks={ranking?.anterior} />
                <RankingBox periodKey="mificha.analisis_periodo_historico" ranks={ranking?.historico} />
            </div>
        </motion.div>
    );
};

// --- CONTROLES DE FECHA (Integrado) ---
const DateControls = ({ onApply, isLoading }) => {
    const today = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultEnd.getDate() - 29);

    const [start, setStart] = useState(defaultStart.toISOString().split('T')[0]);
    const [end, setEnd] = useState(defaultEnd.toISOString().split('T')[0]);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/10 dark:border-dark-border/20 w-full sm:w-auto shadow-sm">
            <div className="flex items-center gap-2 px-2 w-full sm:w-auto">
                <Calendar size={14} className="text-light-text-tertiary dark:text-dark-text-secondary" />
                <div className="flex items-center gap-2 text-xs">
                    <input 
                        type="date" 
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        max={today}
                        className="bg-transparent text-light-text-primary dark:text-white focus:outline-none font-mono w-[85px] appearance-none"
                    />
                    <span className="text-light-text-tertiary dark:text-dark-text-secondary/70">-</span>
                    <input 
                        type="date" 
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        max={today}
                        className="bg-transparent text-light-text-primary dark:text-white focus:outline-none font-mono w-[85px] appearance-none"
                    />
                </div>
            </div>
            
            <button 
                onClick={() => onApply(start, end)}
                disabled={isLoading}
                className="w-full sm:w-auto h-8 px-4 bg-light-text-primary dark:bg-white text-light-surface dark:text-black text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
                {isLoading ? <LoaderCircle size={12} className="animate-spin" /> : <Filter size={12} />}
                <span>{useTranslation().t('mificha.aplicar', 'Filtrar')}</span>
            </button>
        </div>
    );
};

export default function AnalisisProductosPanel({ ventasDetalle, fetchVentasDetalleProductos, isLoading }) {
    const { t } = useTranslation();
    const [analysisTab, setAnalysisTab] = useState('familia');

    const handleFetchDetails = useCallback(async (start, end) => {
        await fetchVentasDetalleProductos({ periodo_start: start, periodo_end: end, force: true });
    }, [fetchVentasDetalleProductos]);

    useEffect(() => {
        if (!ventasDetalle) {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 29);
            handleFetchDetails(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        }
    }, [ventasDetalle, handleFetchDetails]);

    // Data selector logic
    const activeData = analysisTab === 'familia' 
        ? ventasDetalle?.analisis_por_familia 
        : ventasDetalle?.analisis_por_subfamilia;

    return (
        <div className="space-y-6 min-h-[500px]">
            <ReactTooltip id="analysis-tooltip" className="!bg-black !text-white !text-xs !rounded-md !px-2 !py-1 !z-50" />

            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-light-text-primary dark:text-white leading-none">
                            {t('mificha.coaching_productos_title', 'Coaching de Productos')}
                        </h3>
                        <p className="text-xs text-light-text-secondary dark:text-gray-400 mt-1">
                            {ventasDetalle 
                              ? t('mificha.coaching_productos_subtitle_periodo', { periodo: ventasDetalle.periodo_analisis })
                              : t('mificha.coaching_productos_subtitle', 'Selecciona un rango')}
                        </p>
                    </div>
                </div>
                <DateControls onApply={handleFetchDetails} isLoading={isLoading} />
            </div>

            {/* Content Area */}
            {isLoading && !ventasDetalle ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <LoaderCircle className="animate-spin text-light-text-secondary dark:text-white" size={32} />
                    <span className="text-sm text-light-text-secondary dark:text-gray-500 animate-pulse">{t('mificha.analizando_ventas', 'Analizando ventas...')}</span>
                </div>
            ) : ventasDetalle ? (
                <div className="space-y-6">
                    {/* Tab Switcher (Integrated Look) */}
                    <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-[#1a1a1a] rounded-xl border border-light-border/10 dark:border-white/10 w-full sm:w-auto self-start">
                        <button 
                            onClick={() => setAnalysisTab('familia')}
                            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                analysisTab === 'familia' 
                                ? 'bg-white dark:bg-white text-black shadow-sm' 
                                : 'text-light-text-secondary dark:text-gray-400 hover:text-light-text-primary dark:hover:text-white'
                            }`}
                        >
                            <BarChart2 size={14} /> {t('mificha.analisis_tab_familia', 'Por Familia')}
                        </button>
                        <button 
                            onClick={() => setAnalysisTab('subfamilia')}
                            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                                analysisTab === 'subfamilia' 
                                ? 'bg-white dark:bg-white text-black shadow-sm' 
                                : 'text-light-text-secondary dark:text-gray-400 hover:text-light-text-primary dark:hover:text-white'
                            }`}
                        >
                            <FileText size={14} /> {t('mificha.analisis_tab_subfamilia', 'Por Subfamilia')}
                        </button>
                    </div>

                    {/* Grid de Tarjetas */}
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={analysisTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
                        >
                            {(activeData || []).map((item, idx) => (
                                <AnalysisCard 
                                    key={`${analysisTab}-${idx}`} 
                                    title={analysisTab === 'familia' ? item.familia : `${item.familia} / ${item.subfamilia}`} 
                                    data={item} 
                                    index={idx}
                                />
                            ))}
                            
                            {(!activeData || activeData.length === 0) && (
                                <div className="col-span-full py-12 text-center border border-dashed border-light-border/20 dark:border-white/10 rounded-2xl">
                                    <p className="text-light-text-secondary dark:text-gray-500 text-sm">
                                        {t('mificha.analisis_sin_datos', 'No hay datos de ventas para este filtro.')}
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            ) : null}
        </div>
    );
}