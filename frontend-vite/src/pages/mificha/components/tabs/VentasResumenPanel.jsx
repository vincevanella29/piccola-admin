// src/pages/employees_register/components/tabs/VentasResumenPanel.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
    DollarSign, Award, Users, Calendar, Store, Building, 
    BarChart3, UserCheck, TrendingUp, Trophy, Target
} from 'lucide-react';
import KpiCard from '../ui/KpiCard';

// --- Helpers de Formato ---
const formatCurrency = (val) => 
    Number(val || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

const formatNumber = (val) => 
    Number(val || 0).toLocaleString('es-CL');

// --- ATOM: Fila de Métrica Detallada (Compacta pero Completa) ---
// Muestra: Icono, Título, Valor Usuario, y en pequeño: Promedio y Top Local/Empresa
const DetailedMetricRow = ({ icon: Icon, label, value, unit = '', data }) => {
    // data espera: { promedio_local, top_local, promedio_empresa, top_empresa }
    const format = unit === '$' ? formatCurrency : formatNumber;
    
    return (
        <div className="flex flex-col py-2 border-b border-light-border/5 dark:border-white/5 last:border-0">
            <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    <Icon size={13} className="opacity-70" />
                    <span className="font-medium">{label}</span>
                </div>
                <div className="text-sm font-bold font-mono text-light-text-primary dark:text-white tabular-nums">
                    {format(value)}
                </div>
            </div>
            
            {/* Data Context: Promedios y Tops (Micro texto) */}
            <div className="flex justify-between items-center text-[9px] text-light-text-tertiary dark:text-gray-500 font-mono">
                <div className="flex gap-2">
                    <span className="flex items-center gap-0.5" title="Promedio Local">
                        <span className="w-1 h-1 rounded-full bg-yellow-500/50"></span> Avg L: {format(data?.promedio_local)}
                    </span>
                </div>
                <div className="flex gap-2">
                    <span className="flex items-center gap-0.5 text-cyan-500/80" title="Top Empresa">
                        <Trophy size={8} /> Top E: {format(data?.top_empresa)}
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: Comparison Bar (Barra visual rápida) ---
const ComparisonBar = ({ value, top, label }) => {
    const percent = Math.min(((value || 0) / (top || 1)) * 100, 100);
    return (
        <div className="w-full mt-3 mb-4">
            <div className="flex justify-between text-[10px] uppercase font-bold text-light-text-tertiary dark:text-gray-500 mb-1">
                <span>Progreso vs Top Local</span>
                <span>{Math.round(percent)}%</span>
            </div>
            <div className="h-1.5 w-full bg-light-surface-secondary dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="h-full bg-gradient-to-r from-matrix-green to-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                />
            </div>
        </div>
    );
};

// --- COMPONENTE: Monthly Card (La Bento Box con TODA la data) ---
const MonthlyPerformanceCard = ({ kpi, index }) => {
    const { t } = useTranslation();
    
    // Extracción segura
    const ventas = kpi.sales || {};
    const mesas = kpi.total_mesas || {};
    const ticket = kpi.promedio_por_mesa || {}; // O promedio_por_persona según tu backend
    const personas = kpi.personas_atendidas || {};

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="flex flex-col bg-light-surface dark:bg-[#121212] border border-light-border/10 dark:border-white/10 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden"
        >
            {/* Header: Periodo y Rankings Principales */}
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-light-surface-secondary dark:bg-white/5 flex items-center justify-center border border-white/5">
                        <Calendar size={14} className="text-light-text-primary dark:text-white" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-light-text-primary dark:text-white uppercase tracking-wider">
                            {kpi.periodo}
                        </h3>
                    </div>
                </div>
                <div className="flex gap-1">
                    {ventas.puesto_local && (
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-light-text-tertiary dark:text-gray-500 font-bold uppercase">Local</span>
                            <span className="text-xs font-black text-yellow-500">#{ventas.puesto_local}</span>
                        </div>
                    )}
                    {ventas.puesto_empresa && (
                        <div className="flex flex-col items-end ml-2 pl-2 border-l border-white/10">
                            <span className="text-[9px] text-light-text-tertiary dark:text-gray-500 font-bold uppercase">Empresa</span>
                            <span className="text-xs font-black text-cyan-400">#{ventas.puesto_empresa}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Principal: Ventas */}
            <div className="relative py-2">
                <div className="text-[10px] font-bold text-light-text-tertiary dark:text-gray-500 uppercase tracking-wide">Venta Total</div>
                <div className="text-3xl font-black text-light-text-primary dark:text-white tracking-tight tabular-nums mt-0.5">
                    {formatCurrency(ventas.valor ?? ventas.total)}
                </div>
                
                {/* Barra Comparativa Visual */}
                <ComparisonBar value={ventas.valor ?? ventas.total} top={ventas.top_local} />
            </div>

            {/* Detalles "Micro-Dashboard" */}
            <div className="mt-auto bg-light-surface-secondary/30 dark:bg-white/5 rounded-2xl p-3 border border-light-border/5 dark:border-white/5 space-y-1">
                <DetailedMetricRow 
                    icon={BarChart3} 
                    label={t('mificha.total_mesas', 'Mesas')} 
                    value={mesas.valor} 
                    data={mesas} // Pasamos el objeto completo para extraer promedios/tops dentro
                />
                <DetailedMetricRow 
                    icon={Users} 
                    label={t('mificha.personas', 'Personas')} 
                    value={personas.valor} 
                    data={personas}
                />
                <DetailedMetricRow 
                    icon={UserCheck} 
                    label={t('mificha.ticket_promedio', 'Ticket Promedio')} 
                    value={ticket.valor} 
                    unit="$"
                    data={ticket}
                />
            </div>
        </motion.div>
    );
};

export default function VentasResumenPanel({ ventasTotal, kpisUltimos, isLoading }) {
    const { t } = useTranslation();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            {/* SECCIÓN HISTÓRICO GLOBAL */}
            <section>
                <div className="flex items-center gap-2 mb-4 px-1">
                    <div className="p-1.5 bg-matrix-green/10 rounded-md">
                        <Award size={18} className="text-matrix-green" />
                    </div>
                    <h2 className="text-lg font-bold text-light-text-primary dark:text-white tracking-tight">
                        {t('mificha.ventas_totales_historicas', 'Trayectoria Histórica')}
                    </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <KpiCard 
                        title={t('mificha.kpi.mi_total', 'Venta Acumulada')} 
                        value={ventasTotal?.mi_total} 
                        unit="$" 
                        icon={DollarSign}
                        delay={0.1}
                    />
                    <KpiCard 
                        title={t('mificha.kpi.ranking_local', 'Ranking Histórico Local')} 
                        value={ventasTotal?.puesto_local} 
                        unit="#" 
                        icon={Store} 
                        delay={0.2}
                    />
                    <KpiCard 
                        title={t('mificha.kpi.ranking_empresa', 'Ranking Histórico Empresa')} 
                        value={ventasTotal?.puesto_empresa} 
                        unit="#" 
                        icon={Building} 
                        delay={0.3}
                    />
                </div>
            </section>

            {/* SECCIÓN ÚLTIMOS PERIODOS */}
            <section>
                <div className="flex items-center justify-between mb-4 px-1 mt-8">
                    <div className="flex items-center gap-2">
                         <div className="p-1.5 bg-purple-500/10 rounded-md">
                            <TrendingUp size={18} className="text-purple-500" />
                        </div>
                        <h2 className="text-lg font-bold text-light-text-primary dark:text-white tracking-tight">
                            {t('mificha.kpis_ultimos_periodos', 'Rendimiento Reciente')}
                        </h2>
                    </div>
                    {/* Leyenda sutil */}
                    <div className="hidden sm:flex gap-3 text-[10px] text-light-text-tertiary dark:text-gray-500 font-mono">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Local</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Empresa</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(kpisUltimos || []).map((kpi, idx) => (
                        <MonthlyPerformanceCard key={kpi.periodo} kpi={kpi} index={idx} />
                    ))}
                    
                    {(!kpisUltimos || kpisUltimos.length === 0) && !isLoading && (
                        <div className="col-span-full py-16 text-center border border-dashed border-light-border/20 dark:border-white/10 rounded-3xl bg-light-surface/50 dark:bg-white/5">
                            <Target size={32} className="mx-auto text-light-text-tertiary dark:text-gray-600 mb-2" />
                            <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">
                                Aún no hay registros de venta disponibles.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </motion.div>
    );
}