// src/pages/employees_register/components/tabs/DashboardPanel.jsx

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { Award, BarChart2, User, Wallet, DollarSign, Users, TrendingUp, Trophy, Target, Building, Store, Rocket, AlertTriangle } from 'lucide-react';
import MeritAccordionItem from './MeritAccordionItem';
import KpiCard from '../ui/KpiCard';

// CONSTANTE CLAVE: Define el umbral de rendimiento. 85 significa que se alerta si está por debajo del 85% del promedio.
const MINIMUM_PERFORMANCE_PERCENT = 85;

// --- Componente de Barra de Progreso para Benchmarks (AHORA CON ALERTAS) ---
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

    // --- NUEVO: Lógica de Alerta de Rendimiento ---
    const performanceThreshold = safeAvg * (MINIMUM_PERFORMANCE_PERCENT / 100);
    const isBelowThreshold = safeYour < performanceThreshold;
    const difference = safeAvg - safeYour;

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                <Icon size={16} className={colorClass} /> {title}
            </p>
            <div className="relative w-full h-4 bg-light-surface dark:bg-dark-surface rounded-full overflow-hidden">
                <div 
                    className="absolute top-0 h-full border-r-2 border-dashed border-purple-400 z-10" 
                    style={{ left: `${avgPercent}%` }} 
                    data-tooltip-id="dashboard-tooltip" 
                    data-tooltip-content={`${t('mificha.promedio', 'Promedio')}: ${formatValue(safeAvg)}`}
                />
                <div 
                    className={`h-full rounded-full ${isBelowThreshold ? 'bg-red-500' : colorClass} bg-opacity-40`} 
                    style={{ width: `${yourPercent}%` }}
                />
            </div>
            <div className="flex justify-between text-xs mt-1 font-mono text-light-text-secondary dark:text-dark-text-secondary">
                <span>Tú: {formatValue(safeYour)}</span>
                <span className="font-bold text-cyan-400 flex items-center gap-1">
                    <Trophy size={12}/> Top: {formatValue(safeTop)}
                </span>
            </div>
            {/* --- NUEVO: Mensaje de Alerta --- */}
            {isBelowThreshold && (
                <div className="mt-2 p-2 bg-red-900/50 border border-red-500/30 text-red-300 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>
                        Estás un <strong>{formatValue(difference)}</strong> bajo el promedio. ¡A mejorar!
                    </span>
                </div>
            )}
        </div>
    );
};


export default function DashboardPanel({ isLoading, ficha, ventasKpis }) {
  const [expandedMeritId, setExpandedMeritId] = useState(null);
  const { t } = useTranslation();

  const handleMeritToggle = (tokenId) => {
    setExpandedMeritId(prevId => (prevId === tokenId ? null : tokenId));
  };

  const latestKpi = useMemo(() => {
      if (!ventasKpis || ventasKpis.length === 0) return null;
      return ventasKpis[0];
  }, [ventasKpis]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <ReactTooltip id="dashboard-tooltip" />
        <div className="lg:col-span-2 space-y-6">
            <motion.section 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 rounded-xl p-6"
            >
                <div className="flex items-center gap-3 mb-6">
                    <Rocket size={24} className="text-matrix-green"/>
                    <h2 className="text-lg sm:text-xl font-bold">
                        {t('mificha.rendimiento_mes_actual', 'Rendimiento del Mes Actual')}
                        {latestKpi && <span className="text-base font-mono text-light-text-secondary dark:text-dark-text-secondary ml-2">({latestKpi.periodo})</span>}
                    </h2>
                </div>
                
                {latestKpi ? (
                    <div className="space-y-6">
                        <div className="p-4 rounded-lg bg-light-surface/30 dark:bg-dark-surface/30 space-y-4">
                             <BenchmarkBar 
                                title={t('mificha.benchmark_venta_local', 'Venta Total vs. Local')}
                                icon={Store} colorClass="text-yellow-400"
                                yourValue={latestKpi.sales?.total}
                                average={latestKpi.sales?.promedio_local}
                                top={latestKpi.sales?.top_local} unit="$"
                            />
                            <BenchmarkBar 
                                title={t('mificha.benchmark_venta_empresa', 'Venta Total vs. Empresa')}
                                icon={Building} colorClass="text-cyan-400"
                                yourValue={latestKpi.sales?.total}
                                average={latestKpi.sales?.promedio_empresa}
                                top={latestKpi.sales?.top_empresa} unit="$"
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <KpiCard 
                                title={t('mificha.total_mesas', 'Total Mesas')} 
                                value={latestKpi.total_mesas?.valor} 
                                icon={BarChart2}
                                rankLocal={latestKpi.total_mesas?.puesto_local}
                                rankEmpresa={latestKpi.total_mesas?.puesto_empresa}
                            />
                            <KpiCard 
                                title={t('mificha.personas_atendidas', 'Personas Atendidas')} 
                                value={latestKpi.personas_atendidas?.valor} 
                                icon={Users}
                                rankLocal={latestKpi.personas_atendidas?.puesto_local}
                                rankEmpresa={latestKpi.personas_atendidas?.puesto_empresa}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <KpiCard 
                                title={t('mificha.promedio_mesa', 'Promedio x Mesa')} 
                                value={latestKpi.promedio_por_mesa?.valor} 
                                unit="$" icon={DollarSign}
                                rankLocal={latestKpi.promedio_por_mesa?.puesto_local}
                                rankEmpresa={latestKpi.promedio_por_mesa?.puesto_empresa}
                            />
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-light-text-secondary dark:text-dark-text-secondary py-8">{t('mificha.no_hay_kpis', 'No se encontraron KPIs para el mes actual.')}</p>
                )}
            </motion.section>

            <motion.section 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-xl p-6"
            >
                <div className="flex items-center gap-3 mb-6"><Award size={24} className="text-matrix-green"/><h2 className="text-lg sm:text-xl font-bold">{t('mificha.resumen_meritos', 'Resumen de Méritos')}</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(ficha?.merit_profile?.segments || []).map(seg => (
                        <MeritAccordionItem key={seg.token_id} segment={seg} isExpanded={expandedMeritId === seg.token_id} onToggle={() => handleMeritToggle(seg.token_id)} />
                    ))}
                </div>
            </motion.section>
        </div>

        <aside className="space-y-6">
            <motion.section 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/20 dark:border-dark-border/20 rounded-xl p-6"
            >
                <div className="flex items-center gap-3 mb-4"><User size={24} className="text-matrix-green"/><h2 className="text-lg sm:text-xl font-bold">{t('mificha.informacion', 'Información')}</h2></div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.label_rut', 'RUT')}:</span><span className="font-mono">{ficha?.rut}</span></div>
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.label_seccion', 'Sección')}:</span><span className="font-semibold">{ficha?.profile?.seccion || t('mificha.na', 'N/A')}</span></div>
                    <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.label_sucursal', 'Sucursal')}:</span><span className="font-semibold">{ficha?.profile?.sucursal || t('mificha.na', 'N/A')}</span></div>
                    <div className="flex justify-between items-center"><span className="text-light-text-secondary dark:text-dark-text-secondary">{t('mificha.label_wallet', 'Wallet')}:</span><span className="font-mono text-xs flex items-center gap-1 bg-light-surface dark:bg-dark-surface px-2 py-1 rounded"><Wallet size={12}/> {`${ficha?.wallet?.slice(0, 6)}...${ficha?.wallet?.slice(-4)}`}</span></div>
                </div>
            </motion.section>
        </aside>
    </div>
  );
}