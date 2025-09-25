// src/pages/employees_register/components/tabs/HistorialVentasPanel.jsx

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { 
    Calendar, Store, Award, TrendingUp, DollarSign, LoaderCircle, Users, BarChart,
    ArrowUpRight, ArrowDownRight, Minus, Trophy, Target, Building, Rocket, UserCheck
} from 'lucide-react';

// --- Componente de Variación ---
const VariationStat = ({ value, previousValue }) => {
    if (previousValue === null || typeof previousValue === 'undefined' || value === null) {
        return <span className="text-dark-text-secondary"><Minus size={12} className="inline"/> --%</span>;
    }
    if (previousValue === 0 && value > 0) {
        return <span className="flex items-center font-mono text-xs text-green-400"><ArrowUpRight size={14} className="mr-1"/> ∞%</span>;
    }
    if (previousValue === 0 && value === 0) {
        return <span className="text-dark-text-secondary"><Minus size={12} className="inline"/> 0.0%</span>;
    }
    
    const variation = ((value - previousValue) / previousValue) * 100;
    const isPositive = variation >= 0;
    const color = isPositive ? 'text-green-400' : 'text-red-400';

    return (
        <span className={`flex items-center font-mono text-xs ${color}`}>
            {isPositive ? <ArrowUpRight size={14} className="mr-1"/> : <ArrowDownRight size={14} className="mr-1"/>}
            {variation.toFixed(1)}%
        </span>
    );
};

// --- Componente de Barra de Progreso para el resumen ---
const BenchmarkBar = ({ title, yourValue, average, top, icon: Icon, colorClass, unit = '' }) => {
    const { t } = useTranslation();
    const formatValue = (val) => {
        if (typeof val !== 'number' || !isFinite(val)) return '-';
        if (unit === '$') return val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
        return val.toLocaleString('es-CL');
    };
    
    const safeYour = yourValue || 0;
    const safeAvg = average || 0;
    const safeTop = top || 1;
    const barMax = Math.max(safeYour, safeTop);

    const yourPercent = Math.min((safeYour / barMax) * 100, 100);
    const avgPercent = Math.min((safeAvg / barMax) * 100, 100);

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-dark-text-secondary flex items-center gap-2">
                <Icon size={16} className={colorClass} /> {title}
            </p>
            <div className="relative w-full h-4 bg-dark-surface-secondary rounded-full overflow-hidden">
                <div className="absolute top-0 h-full border-r-2 border-dashed border-purple-400 z-10" style={{ left: `${avgPercent}%` }} data-tooltip-id="historial-tooltip" data-tooltip-content={`${t('mificha.promedio', 'Promedio')}: ${formatValue(safeAvg)}`} />
                <div className={`h-full rounded-full ${colorClass} bg-opacity-40`} style={{ width: `${yourPercent}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1 font-mono text-dark-text-secondary">
                <span>Tú: {formatValue(safeYour)}</span>
                <span className="font-bold text-cyan-400 flex items-center gap-1"><Trophy size={12}/> Top: {formatValue(safeTop)}</span>
            </div>
        </div>
    );
};

// --- Sub-componente para el contenido de cada Tab en el historial ---
const KpiTabContent = ({ value, unit, previousValue, local, empresa }) => {
    const { t } = useTranslation();
    const formatValue = (val) => {
        if (typeof val !== 'number' || !isFinite(val)) return '-';
        if (unit === '$') return val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
        return val.toLocaleString('es-CL');
    };
    
    return (
        <div className="p-3 bg-dark-surface-secondary/50 rounded-b-lg rounded-r-lg">
             <div className="flex justify-between items-baseline mb-2">
                <span className="font-mono text-3xl text-matrix-green">{formatValue(value)}</span>
                <VariationStat value={value} previousValue={previousValue} />
            </div>
            <div className="space-y-3 text-xs font-mono">
                {/* Local */}
                <div className="flex justify-between items-center">
                    <span className="text-yellow-400 flex items-center gap-1.5"><Store size={14}/> Local</span>
                    <span>#{local?.puesto || '-'}</span>
                    <span className="text-dark-text-secondary">{formatValue(local?.promedio)}</span>
                    <span className="text-cyan-400">{formatValue(local?.top)}</span>
                </div>
                {/* Empresa */}
                <div className="flex justify-between items-center">
                    <span className="text-cyan-400 flex items-center gap-1.5"><Building size={14}/> Empresa</span>
                    <span>#{empresa?.puesto || '-'}</span>
                    <span className="text-dark-text-secondary">{formatValue(empresa?.promedio)}</span>
                    <span className="text-purple-400">{formatValue(empresa?.top)}</span>
                </div>
            </div>
        </div>
    );
}

// --- Tarjeta para cada mes del historial, ahora con PESTAÑAS ---
const HistorialRow = ({ item, previousItem, index }) => {
    const { t } = useTranslation();
    const [activeKpiTab, setActiveKpiTab] = useState('ventas');
    
    const kpis = {
        ventas: { icon: DollarSign, label: 'Venta', data: item.ventas, prev: previousItem?.ventas, unit: '$'},
        mesas: { icon: BarChart, label: 'Mesas', data: item.total_mesas, prev: previousItem?.total_mesas, unit: ''},
        personas: { icon: Users, label: 'Personas', data: item.personas_atendidas, prev: previousItem?.personas_atendidas, unit: ''},
        promedios: { icon: UserCheck, label: 'Promedios', data: item.promedio_por_persona, prev: previousItem?.promedio_por_persona, unit: '$'}
    };

    const currentKpi = kpis[activeKpiTab];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-dark-surface/50 rounded-xl border border-dark-border/10 overflow-hidden"
        >
            <div className="p-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 font-bold text-matrix-green text-lg">
                        <Calendar size={18} />
                        <span>{item.periodo}</span>
                    </div>
                    <div className="text-xs font-mono px-2 py-1 bg-dark-surface-secondary rounded-md flex items-center gap-1.5 text-dark-text-secondary">
                        <Store size={14} /> {item.local}
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas de KPIs */}
            <div className="flex bg-dark-surface px-2 pt-2">
                {Object.entries(kpis).map(([key, {icon: Icon, label}]) => (
                    <button 
                        key={key} 
                        onClick={() => setActiveKpiTab(key)}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 text-xs font-semibold border-b-2 transition-all ${
                            activeKpiTab === key 
                            ? 'border-matrix-green text-matrix-green' 
                            : 'border-transparent text-dark-text-secondary hover:text-white'
                        }`}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {/* Contenido de la Pestaña Activa */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeKpiTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                >
                    <KpiTabContent 
                        value={currentKpi.data?.valor ?? currentKpi.data?.total}
                        unit={currentKpi.unit}
                        previousValue={currentKpi.prev?.valor ?? currentKpi.prev?.total}
                        local={{
                            puesto: currentKpi.data?.puesto_local,
                            promedio: currentKpi.data?.promedio_local,
                            top: currentKpi.data?.top_local
                        }}
                        empresa={{
                            puesto: currentKpi.data?.puesto_empresa,
                            promedio: currentKpi.data?.promedio_empresa,
                            top: currentKpi.data?.top_empresa
                        }}
                    />
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

export default function HistorialVentasPanel({ historial, isLoading }) {
    const { t } = useTranslation();

    const summaryData = useMemo(() => {
        if (!historial || historial.length === 0) return null;
        return { currentMonth: historial[0] };
    }, [historial]);

    if (isLoading && !historial) {
        return <div className="flex justify-center p-8"><LoaderCircle className="animate-spin text-matrix-green" /></div>;
    }

    if (!historial || historial.length === 0) {
        return <p className="text-center text-dark-text-secondary py-8">{t('mificha.no_hay_historial', 'No se encontró historial de ventas.')}</p>;
    }

    return (
        <div className="space-y-6">
             <ReactTooltip 
                id="historial-tooltip" 
                style={{ backgroundColor: '#2A2A2A', color: '#fff', zIndex: 50, border: '1px solid #444', fontSize: '12px' }} 
             />

            {summaryData && (
                <section className="bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-4 sm:p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <Rocket size={24} className="text-matrix-green"/>
                        <h3 className="text-xl font-bold">{t('mificha.resumen_rendimiento_mes', 'Rendimiento del Mes Actual')}</h3>
                    </div>
                    <div className="p-4 rounded-lg bg-dark-surface/30 space-y-4">
                        <BenchmarkBar 
                            title={t('mificha.benchmark_local', 'Benchmark Local')}
                            icon={Store}
                            colorClass="text-yellow-400"
                            yourValue={summaryData.currentMonth.ventas?.total}
                            average={summaryData.currentMonth.ventas?.promedio_local}
                            top={summaryData.currentMonth.ventas?.top_local}
                            unit="$"
                        />
                        <BenchmarkBar 
                            title={t('mificha.benchmark_empresa', 'Benchmark Empresa')}
                            icon={Building}
                            colorClass="text-cyan-400"
                            yourValue={summaryData.currentMonth.ventas?.total}
                            average={summaryData.currentMonth.ventas?.promedio_empresa}
                            top={summaryData.currentMonth.ventas?.top_empresa}
                            unit="$"
                        />
                    </div>
                </section>
            )}

            <section className="bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-4 sm:p-6">
                <h3 className="text-xl font-bold mb-4">{t('mificha.historial_mensual_ventas', 'Historial Mensual Detallado')}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {historial.map((item, index) => {
                        const previousItem = historial[index + 1] || null;
                        return (
                            <HistorialRow 
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