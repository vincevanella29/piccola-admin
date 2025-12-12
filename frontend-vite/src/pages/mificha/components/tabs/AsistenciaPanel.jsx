// src/pages/employees_register/components/tabs/AsistenciaPanel.jsx

import React, { useState, useCallback } from 'react';
import { 
    Calendar, ListChecks, LoaderCircle, CheckCircle2, 
    AlertCircle, Trophy, TrendingUp, Search, XCircle 
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// --- COMPONENTE: Circular Progress (Donut Chart) ---
const CircularProgress = ({ percentage, size = 80, strokeWidth = 6, colorClass, glow = false }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Glow Effect for Perfect Attendance */}
            {glow && (
                <div className="absolute inset-0 bg-matrix-green/30 rounded-full blur-xl animate-pulse" />
            )}
            
            <svg width={size} height={size} className="transform -rotate-90 relative z-10">
                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-light-surface-tertiary dark:text-dark-surface-tertiary/20"
                />
                {/* Progress Circle */}
                <motion.circle
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeLinecap="round"
                    className={`${colorClass} transition-colors duration-500`}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col z-20">
                <span className={`text-sm font-black tabular-nums ${colorClass}`}>
                    {percentage}%
                </span>
            </div>
        </div>
    );
};

// --- COMPONENTE: Tarjeta Mensual Pro ---
const MonthStatCard = ({ monthData, index }) => {
    const { t } = useTranslation();
    const { dias_trabajados, dias_habiles, asistencia_perfecta, mes } = monthData;
    const percentage = dias_habiles > 0 ? Math.round((dias_trabajados / dias_habiles) * 100) : 0;
    const ausencias = Math.max(0, dias_habiles - dias_trabajados);

    // Color Logic usando Theme Variables donde sea posible
    let colorClass = 'text-light-error dark:text-dark-error'; // Malo
    if (percentage === 100) colorClass = 'text-matrix-green'; // Perfecto
    else if (percentage >= 90) colorClass = 'text-light-success dark:text-dark-success'; // Bueno (usando success del theme)
    else if (percentage >= 80) colorClass = 'text-amber-500'; // Regular (Amber es standard warning)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="flex flex-col items-center bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:border-light-accent/30 dark:hover:border-dark-accent/30 transition-all group relative overflow-hidden"
        >
            {/* Header */}
            <div className="flex justify-between w-full items-start mb-3 z-10">
                <span className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary tracking-wider">
                    {mes}
                </span>
                {asistencia_perfecta && (
                    <Trophy size={14} className="text-matrix-green animate-bounce" />
                )}
            </div>

            {/* Grafico Circular */}
            <div className="mb-4 z-10">
                <CircularProgress 
                    percentage={percentage} 
                    colorClass={colorClass} 
                    glow={asistencia_perfecta} 
                />
            </div>

            {/* Stats Grid */}
            <div className="w-full grid grid-cols-2 gap-2 text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary z-10">
                <div className="flex flex-col items-center bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded py-1.5">
                    <span className="opacity-70 uppercase text-[8px]">{t('mificha.trabajados', 'Trabajados')}</span>
                    <span className="text-light-text-primary dark:text-dark-text-primary font-bold text-xs">{dias_trabajados}</span>
                </div>
                <div className="flex flex-col items-center bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded py-1.5">
                    <span className="opacity-70 uppercase text-[8px]">{t('mificha.ausencias', 'Ausencias')}</span>
                    <span className={`${ausencias > 0 ? 'text-light-error dark:text-dark-error' : 'text-matrix-green'} font-bold text-xs`}>
                        {ausencias}
                    </span>
                </div>
            </div>

            {/* Hover Gradient */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none bg-gradient-to-b ${asistencia_perfecta ? 'from-matrix-green to-transparent' : 'from-light-text-secondary to-transparent'}`} />
        </motion.div>
    );
};

// --- COMPONENTE: Resumen Global (The "Chart" area) ---
const AttendanceSummary = ({ data }) => {
    const { t } = useTranslation();
    
    // Calculos
    const totalMeses = data.length;
    const mesesPerfectos = data.filter(m => m.asistencia_perfecta).length;
    const totalDiasHabiles = data.reduce((acc, curr) => acc + (curr.dias_habiles || 0), 0);
    const totalDiasTrabajados = data.reduce((acc, curr) => acc + (curr.dias_trabajados || 0), 0);
    const avgGlobal = totalDiasHabiles > 0 ? Math.round((totalDiasTrabajados / totalDiasHabiles) * 100) : 0;
    const totalAusencias = totalDiasHabiles - totalDiasTrabajados;
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* KPI 1: Promedio Global */}
            <div className="bg-gradient-to-br from-light-surface to-light-surface-secondary dark:from-dark-surface dark:to-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute right-0 top-0 p-3 opacity-10 text-light-text-primary dark:text-dark-text-primary"><TrendingUp size={60} /></div>
                <div className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">
                    {t('mificha.promedio_global', 'Promedio Global')}
                </div>
                <div className="text-3xl font-black text-light-text-primary dark:text-dark-text-primary tabular-nums">
                    {avgGlobal}%
                </div>
                <div className="mt-2 h-1.5 w-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${avgGlobal}%` }} 
                        transition={{ duration: 1 }}
                        className={`h-full rounded-full ${avgGlobal >= 95 ? 'bg-matrix-green' : 'bg-amber-500'}`} 
                    />
                </div>
            </div>

            {/* KPI 2: Asistencia Perfecta */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        {t('mificha.meses_perfectos', 'Meses Perfectos')}
                    </div>
                    <div className="text-3xl font-black text-matrix-green tabular-nums">
                        {mesesPerfectos} <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary font-medium">/ {totalMeses}</span>
                    </div>
                </div>
                <div className="p-3 bg-matrix-green/10 rounded-full text-matrix-green">
                    <Trophy size={24} />
                </div>
            </div>

            {/* KPI 3: Ausencias Totales */}
            <div className="bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-5 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold uppercase text-light-text-secondary dark:text-dark-text-secondary mb-1">
                        {t('mificha.dias_ausente', 'Días Ausente')}
                    </div>
                    <div className={`text-3xl font-black tabular-nums ${totalAusencias > 0 ? 'text-light-error dark:text-dark-error' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                        {totalAusencias}
                    </div>
                </div>
                <div className={`p-3 rounded-full ${totalAusencias > 0 ? 'bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error' : 'bg-light-text-secondary/10 dark:bg-dark-text-secondary/10 text-light-text-secondary dark:text-dark-text-secondary'}`}>
                    {totalAusencias > 0 ? <XCircle size={24} /> : <CheckCircle2 size={24} />}
                </div>
            </div>
        </div>
    );
};

export default function AsistenciaPanel({ initialKpis, isLoading, fetchAsistenciaKpis }) {
    const { t } = useTranslation();
    
    // Fechas por defecto: Enero a Mes Actual
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthFormatted = String(today.getMonth() + 1).padStart(2, '0');

    const [startPeriodo, setStartPeriodo] = useState(`${currentYear}01`);
    const [endPeriodo, setEndPeriodo] = useState(`${currentYear}${currentMonthFormatted}`);
    
    const [asistencia, setAsistencia] = useState(initialKpis || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = useCallback(async (e) => {
        if(e) e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = await fetchAsistenciaKpis({ startPeriodo, endPeriodo });
            setAsistencia(data?.kpis || []);
        } catch (err) {
            setError(err.message || t('mificha.error_asistencia', 'Error al buscar asistencia'));
        } finally {
            setLoading(false);
        }
    }, [startPeriodo, endPeriodo, fetchAsistenciaKpis, t]);

    const currentAsistencia = asistencia && asistencia.length > 0 ? asistencia : null;

    return (
        <div className="space-y-6">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-matrix-green/10 rounded-lg text-matrix-green">
                        <ListChecks size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-none">
                            {t('mificha.control_asistencia', 'Control de Asistencia')}
                        </h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">
                            {t('mificha.compromiso_visualizado', 'Tu compromiso mensual visualizado')}
                        </p>
                    </div>
                </div>

                {/* Date Filters (Compactos y estilizados) */}
                <form onSubmit={handleSearch} className="flex items-center gap-2 p-1.5 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/20 dark:border-dark-border/20 shadow-sm w-full md:w-auto">
                    <div className="flex items-center gap-2 px-2">
                        <Calendar size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
                        <div className="flex items-center gap-1 text-xs">
                             <input
                                type="number"
                                placeholder="YYYYMM"
                                value={startPeriodo}
                                onChange={e => setStartPeriodo(e.target.value)}
                                className="bg-transparent text-light-text-primary dark:text-dark-text-primary focus:outline-none font-mono w-[60px] text-center appearance-none"
                            />
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">-</span>
                            <input
                                type="number"
                                placeholder="YYYYMM"
                                value={endPeriodo}
                                onChange={e => setEndPeriodo(e.target.value)}
                                className="bg-transparent text-light-text-primary dark:text-dark-text-primary focus:outline-none font-mono w-[60px] text-center appearance-none"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || isLoading}
                        className="h-8 px-3 rounded-lg font-bold text-xs text-light-surface dark:text-dark-background bg-matrix-green hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1"
                    >
                        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />}
                        <span className="hidden sm:inline">{t('mificha.filtrar', 'Filtrar')}</span>
                    </button>
                </form>
            </div>

            {/* Dashboard Content */}
            <div className="min-h-[300px]">
                {loading && !currentAsistencia && (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <LoaderCircle className="animate-spin text-matrix-green" size={32} />
                        <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary animate-pulse">
                            {t('mificha.analizando', 'Analizando registros...')}
                        </span>
                    </div>
                )}

                {error && (
                    <div className="p-6 rounded-2xl border border-light-error/20 dark:border-dark-error/20 bg-light-error/5 dark:bg-dark-error/5 text-center">
                        <AlertCircle className="mx-auto text-light-error dark:text-dark-error mb-2" size={32} />
                        <p className="text-light-error dark:text-dark-error text-sm">{error}</p>
                    </div>
                )}

                {!loading && !error && currentAsistencia && (
                    <>
                        {/* 1. Summary Hero Section */}
                        <AttendanceSummary data={currentAsistencia} />

                        {/* 2. Grid de Meses */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            <AnimatePresence>
                                {currentAsistencia.map((month, index) => (
                                    <MonthStatCard key={month.mes || index} monthData={month} index={index} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}

                {!loading && !error && !currentAsistencia && (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-light-border/20 dark:border-dark-border/20 rounded-3xl bg-light-surface/50 dark:bg-dark-surface/50">
                         <div className="p-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full mb-3">
                            <Calendar size={32} className="text-light-text-secondary dark:text-dark-text-secondary" />
                         </div>
                        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">
                            {t('mificha.selecciona_rango', 'Selecciona un rango de períodos para ver tu progreso.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}