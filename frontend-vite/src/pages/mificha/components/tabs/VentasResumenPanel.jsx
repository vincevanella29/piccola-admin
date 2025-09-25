// src/pages/employees_register/components/tabs/VentasResumenPanel.jsx

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    DollarSign, Award, Users, Calendar, Store, Building, Trophy, Target, BarChart, UserCheck
} from 'lucide-react';
import KpiCard from '../ui/KpiCard';

// --- Componente de Barra de Progreso (Copiado de HistorialVentasPanel para autonomía) ---
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
            <div className="relative w-full h-4 bg-dark-surface rounded-full overflow-hidden">
                <div className="absolute top-0 h-full border-r-2 border-dashed border-purple-400 z-10" style={{ left: `${avgPercent}%` }} data-tooltip-id="benchmark-tooltip" data-tooltip-content={`${t('mificha.promedio', 'Promedio')}: ${formatValue(safeAvg)}`} />
                <div className={`h-full rounded-full ${colorClass} bg-opacity-40`} style={{ width: `${yourPercent}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1 font-mono text-dark-text-secondary">
                <span>Tú: {formatValue(safeYour)}</span>
                <span className="font-bold text-cyan-400 flex items-center gap-1"><Trophy size={12}/> Top: {formatValue(safeTop)}</span>
            </div>
        </div>
    );
};

// --- Sub-componente para el contenido de cada Tab ---
const KpiTabContent = ({ value, unit, local, empresa }) => {
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
            </div>
            <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between items-center">
                    <span className="text-yellow-400 flex items-center gap-1.5"><Store size={14}/> Local</span>
                    <span>#{local?.puesto || '-'}</span>
                    <span className="text-dark-text-secondary">{formatValue(local?.promedio)}</span>
                    <span className="text-cyan-400">{formatValue(local?.top)}</span>
                </div>
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

// --- Tarjeta para cada mes de los últimos KPIs ---
const KpiMonthCard = ({ kpi }) => {
    const { t } = useTranslation();
    const [activeKpiTab, setActiveKpiTab] = useState('ventas');
    
    const kpiTabs = {
        ventas: { icon: DollarSign, label: 'Venta', data: kpi.sales, unit: '$'},
        mesas: { icon: BarChart, label: 'Mesas', data: kpi.total_mesas, unit: ''},
        personas: { icon: Users, label: 'Personas', data: kpi.personas_atendidas, unit: ''},
        promedio: { icon: UserCheck, label: 'Prom x Pers', data: kpi.promedio_por_persona, unit: '$'}
    };

    const currentKpi = kpiTabs[activeKpiTab];

    return (
        <div className="bg-dark-surface/50 rounded-xl border border-dark-border/10 overflow-hidden">
            <div className="p-4">
                <h3 className="font-bold text-center text-matrix-green flex items-center justify-center gap-2">
                    <Calendar size={16} /> {kpi.periodo}
                </h3>
            </div>
            <div className="flex bg-dark-surface px-2 pt-2">
                {Object.entries(kpiTabs).map(([key, {icon: Icon, label}]) => (
                    <button key={key} onClick={() => setActiveKpiTab(key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 p-2 text-xs font-semibold border-b-2 transition-all ${
                            activeKpiTab === key ? 'border-matrix-green text-matrix-green' : 'border-transparent text-dark-text-secondary hover:text-white'
                        }`}>
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeKpiTab}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <KpiTabContent 
                        value={currentKpi.data?.valor ?? currentKpi.data?.total}
                        unit={currentKpi.unit}
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
        </div>
    );
};

export default function VentasResumenPanel({ ventasTotal, kpisUltimos, isLoading }) {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <section className="bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-4 sm:p-6">
                <h2 className="text-xl font-bold mb-4">{t('mificha.ventas_totales_historicas', 'Ventas Totales Históricas')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard title={t('mificha.kpi.mi_total', 'Mi Total')} value={ventasTotal?.mi_total} unit="$" icon={DollarSign} />
                    <KpiCard title={t('mificha.kpi.ranking_empresa', 'Ranking Empresa')} value={ventasTotal?.puesto_empresa} unit="#" icon={Award} />
                    <KpiCard title={t('mificha.kpi.ranking_local', 'Ranking Local')} value={ventasTotal?.puesto_local} unit="#" icon={Users} />
                </div>
            </section>
            <section className="bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-4 sm:p-6">
                <h2 className="text-xl font-bold mb-4">{t('mificha.kpis_ultimos_periodos', 'Rendimiento Últimos 3 Meses')}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {(kpisUltimos || []).map((kpi) => (
                        <KpiMonthCard key={kpi.periodo} kpi={kpi} />
                    ))}
                </div>
            </section>
        </div>
    );
}