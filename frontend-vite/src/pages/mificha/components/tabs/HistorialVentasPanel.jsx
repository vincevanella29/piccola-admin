// src/pages/employees_register/components/tabs/HistorialVentasPanel.jsx

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { 
    Calendar, Store, Building, Trophy, Rocket, 
    ArrowUpRight, ArrowDownRight, Minus, 
    BarChart3, Users, UserCheck, DollarSign 
} from 'lucide-react';

// --- Helper: Formateo de Moneda/Números ---
const formatCurrency = (val) => 
    Number(val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const formatNumber = (val) => 
    Number(val || 0).toLocaleString('es-CL');

// --- COMPONENTE: Indicador de Variación (Trend) ---
const VariationBadge = ({ current, previous }) => {
    if (previous == null || current == null) return <span className="text-light-text-tertiary dark:text-dark-text-secondary text-[10px] font-mono">--</span>;
    
    // Evitar división por cero
    if (previous === 0) return current > 0 
        ? <span className="text-matrix-green text-[10px] font-bold font-mono flex items-center bg-matrix-green/10 px-1 rounded"><ArrowUpRight size={10} /> Nuevo</span> 
        : <span className="text-light-text-tertiary text-[10px]">-</span>;

    const delta = ((current - previous) / previous) * 100;
    const isPositive = delta >= 0;
    const isNeutral = delta === 0;

    if (isNeutral) return <span className="text-light-text-tertiary dark:text-dark-text-secondary text-[10px] font-mono flex items-center"><Minus size={10} /> 0%</span>;

    return (
        <div className={`flex items-center gap-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border ${
            isPositive 
                ? 'text-light-success dark:text-dark-success bg-light-success/10 border-light-success/20' 
                : 'text-light-error dark:text-dark-error bg-light-error/10 border-light-error/20'
        }`}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(delta).toFixed(1)}%
        </div>
    );
};

// --- COMPONENTE: Barra de Progreso Compacta (Benchmark) ---
const SlimBenchmark = ({ value, top, label }) => {
    const percent = Math.min(((value || 0) / (top || 1)) * 100, 100);
    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-1">
                <span className="text-[9px] uppercase font-bold text-light-text-tertiary dark:text-dark-text-secondary tracking-wider flex items-center gap-1">
                    <Trophy size={10} className="text-light-accent" /> {label}
                </span>
                <span className="text-[9px] font-mono text-light-text-secondary dark:text-gray-400">
                    Top: {formatCurrency(top)}
                </span>
            </div>
            <div className="h-1.5 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-light-accent to-matrix-green rounded-full shadow-neon"
                />
            </div>
        </div>
    );
};

// --- COMPONENTE: Celda de Grid de Métricas (El corazón de "Toda la data") ---
const MetricGridCell = ({ icon: Icon, label, value, prevValue, ranks, unit = '' }) => {
    // ranks = { puesto_local, puesto_empresa }
    const format = unit === '$' ? formatCurrency : formatNumber;
    
    return (
        <div className="flex flex-col p-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/40 rounded-xl border border-light-border/5 dark:border-dark-border/20 relative group hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/60 transition-colors">
            {/* Header: Label + Icon */}
            <div className="flex items-center gap-1.5 mb-1 text-light-text-tertiary dark:text-dark-text-secondary">
                <Icon size={12} />
                <span className="text-[9px] uppercase font-bold tracking-wide">{label}</span>
            </div>
            
            {/* Main Value */}
            <div className="text-sm font-bold text-light-text-primary dark:text-white font-mono tabular-nums mb-1">
                {format(value)}
            </div>

            {/* Variation */}
            <div className="mb-2">
                <VariationBadge current={value} previous={prevValue} />
            </div>

            {/* Footer: Rankings (Mini Badges) */}
            <div className="mt-auto flex gap-1 pt-2 border-t border-light-border/5 dark:border-dark-border/20">
                {ranks?.puesto_local && (
                    <div className="flex-1 flex flex-col items-center bg-light-accent/5 rounded py-0.5 border border-light-accent/20" title="Ranking Local">
                        <span className="text-[8px] text-light-accent dark:text-dark-accent font-bold uppercase">LOC</span>
                        <span className="text-[10px] font-black text-light-accent dark:text-dark-accent">#{ranks.puesto_local}</span>
                    </div>
                )}
                {ranks?.puesto_empresa && (
                    <div className="flex-1 flex flex-col items-center bg-vanellix-cyan/5 rounded py-0.5 border border-vanellix-cyan/20" title="Ranking Empresa">
                        <span className="text-[8px] text-vanellix-cyan font-bold uppercase">EMP</span>
                        <span className="text-[10px] font-black text-vanellix-cyan">#{ranks.puesto_empresa}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- TARJETA PRINCIPAL: Historial Mes (Layout Bento) ---
const HistoryMonthCard = ({ item, previousItem, index }) => {
    const { t } = useTranslation();

    // Extraer datos de forma segura
    const sales = item.ventas || {};
    const prevSales = previousItem?.ventas || {};
    
    const mesas = item.total_mesas || {};
    const prevMesas = previousItem?.total_mesas || {};
    
    const personas = item.personas_atendidas || {};
    const prevPersonas = previousItem?.personas_atendidas || {};
    
    const ticket = item.promedio_por_persona || item.promedio_por_mesa || {};
    const prevTicket = previousItem?.promedio_por_persona || previousItem?.promedio_por_mesa || {};

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-light-surface dark:bg-[#151515] rounded-2xl border border-light-border/10 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
        >
            {/* 1. Header & Sales Hero */}
            <div className="p-5 border-b border-light-border/10 dark:border-white/5 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-matrix-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-light-surface-secondary dark:bg-white/5 flex flex-col items-center justify-center border border-white/5 shadow-inner">
                            <Calendar size={14} className="text-light-text-secondary dark:text-gray-400 mb-0.5" />
                            <span className="text-[9px] font-bold text-light-text-primary dark:text-white uppercase tracking-tighter leading-none">
                                {item.periodo.slice(0, 3)}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-light-text-primary dark:text-white">{item.periodo}</h3>
                            <div className="flex items-center gap-1 text-[10px] text-light-text-secondary dark:text-gray-400">
                                <Store size={10} /> {item.local}
                            </div>
                        </div>
                    </div>
                    {/* Sales Badge */}
                    <div className="text-right">
                         <VariationBadge current={sales.valor ?? sales.total} previous={prevSales.valor ?? prevSales.total} />
                    </div>
                </div>

                <div className="relative z-10 mb-3">
                     <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-light-text-primary dark:text-white tabular-nums tracking-tight">
                            {formatCurrency(sales.valor ?? sales.total)}
                        </span>
                     </div>
                </div>

                {/* Sales Context (Rankings & Benchmarks) */}
                <div className="relative z-10">
                    <SlimBenchmark value={sales.valor ?? sales.total} top={sales.top_local} label="Vs. Top Local" />
                    <div className="flex gap-2 mt-2">
                         {sales.puesto_local && <span className="text-[9px] font-bold bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">#{sales.puesto_local} Local</span>}
                         {sales.puesto_empresa && <span className="text-[9px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">#{sales.puesto_empresa} Empresa</span>}
                    </div>
                </div>
            </div>

            {/* 2. Detailed Grid (No Tabs, All Data) */}
            <div className="p-3 bg-light-surface-tertiary/10 dark:bg-black/20 grid grid-cols-3 gap-2">
                <MetricGridCell 
                    icon={BarChart3} 
                    label="Mesas" 
                    value={mesas.valor} 
                    prevValue={prevMesas.valor}
                    ranks={{ puesto_local: mesas.puesto_local, puesto_empresa: mesas.puesto_empresa }}
                />
                <MetricGridCell 
                    icon={Users} 
                    label="Personas" 
                    value={personas.valor} 
                    prevValue={prevPersonas.valor}
                    ranks={{ puesto_local: personas.puesto_local, puesto_empresa: personas.puesto_empresa }}
                />
                <MetricGridCell 
                    icon={UserCheck} 
                    label="Ticket" 
                    value={ticket.valor} 
                    prevValue={prevTicket.valor}
                    ranks={{ puesto_local: ticket.puesto_local, puesto_empresa: ticket.puesto_empresa }}
                    unit="$"
                />
            </div>
        </motion.div>
    );
};

export default function HistorialVentasPanel({ historial, isLoading }) {
    const { t } = useTranslation();

    const currentMonth = useMemo(() => {
        if (!historial || historial.length === 0) return null;
        return historial[0];
    }, [historial]);

    // Loading State
    if (isLoading && !historial) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Rocket className="animate-bounce text-matrix-green" size={32} />
                <span className="text-sm text-light-text-tertiary dark:text-gray-500 animate-pulse">Cargando historial...</span>
            </div>
        );
    }

    // Empty State
    if (!historial || historial.length === 0) {
        return (
            <div className="text-center py-16 border border-dashed border-light-border/20 dark:border-dark-border/30 rounded-3xl bg-light-surface/50 dark:bg-dark-surface/50">
                <p className="text-light-text-secondary dark:text-dark-text-secondary font-medium">
                    {t('mificha.no_hay_historial', 'No se encontró historial de ventas.')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <ReactTooltip id="historial-tooltip" className="!bg-dark-surface !text-white !text-xs !rounded-md !px-2 !py-1" />

            {/* HERO: Mes Actual (Resumen Rápido) */}
            {currentMonth && (
                <section className="bg-gradient-to-br from-light-surface to-light-surface-secondary dark:from-dark-surface dark:to-dark-surface-secondary border border-light-border/10 dark:border-dark-border/20 rounded-2xl p-6 shadow-md relative overflow-hidden group">
                     {/* Decor */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-light-accent/5 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />
                    
                    <div className="relative z-10 flex items-center gap-3 mb-6">
                        <div className="p-2.5 bg-matrix-green/10 rounded-xl text-matrix-green ring-1 ring-matrix-green/20 shadow-sm">
                            <Rocket size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-light-text-primary dark:text-white leading-tight">
                                {t('mificha.resumen_rendimiento_mes', 'Rendimiento Actual')}
                            </h3>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                Comparativa en tiempo real vs Benchmarks
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Reutilizamos el SlimBenchmark para el Hero */}
                        <div className="bg-light-surface dark:bg-dark-surface p-4 rounded-xl border border-light-border/5 dark:border-dark-border/20">
                             <SlimBenchmark 
                                value={currentMonth.ventas?.total} 
                                top={currentMonth.ventas?.top_local} 
                                label={t('mificha.benchmark_local', 'Vs. Top Local')} 
                             />
                             <div className="mt-2 text-xs text-light-text-secondary dark:text-gray-400 text-right">
                                Promedio: {formatCurrency(currentMonth.ventas?.promedio_local)}
                             </div>
                        </div>
                        <div className="bg-light-surface dark:bg-white/5 p-4 rounded-xl border border-light-border/5 dark:border-white/5">
                             <SlimBenchmark 
                                value={currentMonth.ventas?.total} 
                                top={currentMonth.ventas?.top_empresa} 
                                label={t('mificha.benchmark_empresa', 'Vs. Top Empresa')} 
                             />
                              <div className="mt-2 text-xs text-light-text-secondary dark:text-gray-400 text-right">
                                Promedio: {formatCurrency(currentMonth.ventas?.promedio_empresa)}
                             </div>
                        </div>
                    </div>
                </section>
            )}

            {/* LISTA: Historial Completo */}
            <section>
                <div className="flex items-center gap-2 mb-4 px-1">
                    <div className="w-1 h-5 rounded-full bg-light-accent dark:bg-white"></div>
                    <h3 className="text-lg font-bold text-light-text-primary dark:text-white tracking-tight">
                        {t('mificha.historial_mensual_ventas', 'Historial Detallado')}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {historial.map((item, index) => {
                        // Comparar con el mes anterior (que está en index + 1 en orden descendente)
                        const previousItem = historial[index + 1] || null;
                        return (
                            <HistoryMonthCard 
                                key={`${item.periodo}-${item.local}`} 
                                item={item}
                                previousItem={previousItem} 
                                index={index} 
                            />
                        )
                    })}
                </div>
            </section>
        </div>
    );
}