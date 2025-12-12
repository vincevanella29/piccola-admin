// src/pages/employees_register/components/tabs/DashboardPanel.jsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { 
    BarChart2, User, Wallet, DollarSign, Users, Trophy, 
    Building, Store, Rocket, AlertTriangle, ArrowRight, Target, Sparkles
} from 'lucide-react';
import MeritAccordionItem from './MeritAccordionItem';

// === COMPONENTE: MINI BARRA DE PROGRESO (Apple Style) ===
const SlimBenchmark = ({ label, value, avg, top, icon: Icon, color, unit = '' }) => {
    const safeVal = value || 0;
    const max = Math.max(safeVal, top || 1) * 1.1;
    const percent = Math.min((safeVal / max) * 100, 100);
    const avgPercent = Math.min(((avg || 0) / max) * 100, 100);

    const format = (n) => unit === '$' 
        ? Number(n).toLocaleString('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}) 
        : Number(n).toLocaleString('es-CL');

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-end text-[10px] font-medium text-light-text-secondary dark:text-dark-text-secondary/70">
                <div className="flex items-center gap-1.5">
                    <Icon size={12} className={color} /> 
                    <span className="uppercase tracking-wide">{label}</span>
                </div>
                <div className="font-mono text-light-text-primary dark:text-white font-semibold">
                    {format(safeVal)} <span className="text-[9px] opacity-50">/ {format(top)}</span>
                </div>
            </div>
            <div className="relative h-1.5 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full overflow-hidden">
                {/* Average Marker */}
                <div className="absolute top-0 bottom-0 w-0.5 bg-light-text-secondary/40 dark:bg-dark-text-secondary/60 z-10" style={{ left: `${avgPercent}%` }} />
                {/* Main Bar */}
                <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${percent}%` }} 
                    transition={{ duration: 0.8, ease: "circOut" }}
                    className={`h-full rounded-full ${color === 'text-light-accent' ? 'bg-light-accent shadow-neon' : 'bg-vanellix-cyan shadow-neon'}`}
                />
            </div>
        </div>
    );
};

// === COMPONENTE: KPI TILE (Cuadrado compacto) ===
const KpiTile = ({ title, value, subValue, icon: Icon, unit = '$', trend, delay }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.3 }}
            className="flex flex-col justify-between p-4 bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/20 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
            <div className="flex items-start justify-between mb-2 relative z-10">
                <div className="p-2 rounded-lg bg-light-surface-secondary dark:bg-white/5 text-light-text-primary dark:text-white group-hover:bg-matrix-green/10 group-hover:text-matrix-green transition-colors">
                    <Icon size={18} />
                </div>
                {trend && (
                    <span className="text-[10px] font-bold text-matrix-green bg-matrix-green/10 px-1.5 py-0.5 rounded-full">
                        #{trend}
                    </span>
                )}
            </div>
            <div className="relative z-10">
                <h3 className="text-2xl font-bold text-light-text-primary dark:text-white tracking-tight tabular-nums">
                   {unit === '$' ? '$' : ''}{Number(value || 0).toLocaleString('es-CL')}
                </h3>
                <p className="text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide mt-0.5">
                    {title}
                </p>
            </div>
        </motion.div>
    );
};

export default function DashboardPanel({ isLoading, ficha, ventasKpis, meritos, onNavigate }) {
  const { t } = useTranslation();

  const latestKpi = useMemo(() => ventasKpis?.[0] || null, [ventasKpis]);

  // Lógica de puntos pendientes (simplificada)
  const pendingBySegment = useMemo(() => {
      const map = {};
      if (!meritos?.merits) return map;
      const all = [...(meritos.merits.current_month || []), ...(meritos.merits.history_fulfilled || [])];
      for (const m of all) {
          if (m.status === 'fulfilled' && (m.mint_status === 'pending' || m.mint_status == null) && m.segment_token_id) {
              map[String(m.segment_token_id)] = (map[String(m.segment_token_id)] || 0) + (Number(m.merit_points) || 0);
          }
      }
      return map;
  }, [meritos]);

  const stats = useMemo(() => {
    const current = meritos?.merits?.current_month || [];
    const earned = current.filter(m => m.status === 'fulfilled').reduce((a, b) => a + (Number(b.merit_points)||0), 0);
    const total = current.reduce((a, b) => a + (Number(b.merit_points)||0), 0);
    return { earned, total, pct: total > 0 ? (earned/total)*100 : 0 };
  }, [meritos]);

  return (
    <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="max-w-7xl mx-auto space-y-5"
    >
        <ReactTooltip id="dash-tooltip" className="!bg-dark-surface !text-dark-text-primary !backdrop-blur-md !text-xs !rounded-lg !px-2 !py-1" />

        {/* === FILA SUPERIOR: WIDGET PRINCIPAL + PERFIL (BENTO GRID) === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            
            {/* 1. Widget de Gamificación "Hero" */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/20 p-6 flex flex-col justify-between group shadow-xl cursor-pointer" onClick={() => onNavigate('meritos')}>
                {/* Background Art */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-matrix-green/10 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none" />
                
                <div className="relative z-10 flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-matrix-green/20 border border-matrix-green/30 text-[10px] font-bold text-matrix-green uppercase tracking-wider">
                                Temporada Actual
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-dark-text-primary leading-tight">Misiones de <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-matrix-green to-light-accent">Noviembre</span></h2>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-dark-text-primary tabular-nums">{stats.earned}</div>
                        <div className="text-[10px] text-dark-text-secondary uppercase tracking-wide font-medium">Puntos Ganados</div>
                    </div>
                </div>

                <div className="relative z-10 mt-6">
                    <div className="flex justify-between text-xs text-dark-text-secondary mb-2 font-medium">
                        <span>Progreso Mensual</span>
                        <span className="text-dark-text-primary">{Math.round(stats.pct)}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-dark-surface-secondary rounded-full overflow-hidden backdrop-blur-sm">
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${stats.pct}%` }} 
                            transition={{ duration: 1.2, ease: "circOut" }}
                            className="h-full bg-gradient-to-r from-matrix-green to-light-accent shadow-neon"
                        />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-matrix-green group-hover:translate-x-1 transition-transform">
                        Ver todas las misiones <ArrowRight size={12} />
                    </div>
                </div>
            </div>

            {/* 2. Tarjeta de Perfil Compacta */}
            <div className="rounded-3xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/20 p-6 flex flex-col justify-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-light-accent to-matrix-green" />
                
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-light-surface-secondary to-light-surface-tertiary dark:from-dark-surface-secondary dark:to-dark-surface-tertiary flex items-center justify-center text-xl font-bold text-light-text-secondary dark:text-dark-text-primary border border-light-border/30 dark:border-dark-border/30">
                        {ficha?.nombre?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-light-text-primary dark:text-white">{ficha?.nombre} {ficha?.apellido_paterno}</h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{ficha?.profile?.cargo || 'Colaborador'}</p>
                    </div>
                </div>

                <div className="space-y-2.5 bg-light-surface-secondary/50 dark:bg-black/20 rounded-xl p-3 border border-light-border/5 dark:border-white/5">
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-light-text-tertiary dark:text-dark-text-secondary">Sucursal</span>
                        <span className="font-semibold text-light-text-primary dark:text-white">{ficha?.profile?.sucursal || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="text-light-text-tertiary dark:text-dark-text-secondary">RUT</span>
                        <span className="font-mono text-light-text-primary dark:text-white">{ficha?.rut}</span>
                    </div>
                    <div className="flex justify_between items-center text-[11px] pt-1 border-t border-light-border/10 dark:border-dark-border/20">
                        <span className="text-light-text-tertiary dark:text-dark-text-secondary flex items-center gap-1"><Wallet size={10}/> Wallet</span>
                        <span className="font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 px-1.5 py-0.5 rounded cursor-pointer hover:bg-light-surface-tertiary/80 dark:hover:bg-dark-surface-tertiary/80 transition-colors truncate max-w-[120px]">
                            {ficha?.wallet || 'No conectada'}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        {/* === SECCIÓN MEDIA: KPIs (Compact Tiles) === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Benchmarks en un tile doble */}
            <div className="col-span-2 bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/20 p-5 shadow-sm flex flex-col justify-center gap-4">
                <div className="flex items-center gap-2 mb-1">
                    <Rocket size={16} className="text-light-accent" />
                    <h3 className="text-xs font-bold uppercase text-light-text-primary dark:text-white">Rendimiento de Ventas</h3>
                </div>
                {latestKpi ? (
                    <>
                        <SlimBenchmark label="Vs. Local" icon={Store} color="text-light-accent" unit="$" 
                            value={latestKpi.sales?.total} avg={latestKpi.sales?.promedio_local} top={latestKpi.sales?.top_local} 
                        />
                        <SlimBenchmark label="Vs. Empresa" icon={Building} color="text-vanellix-cyan" unit="$" 
                            value={latestKpi.sales?.total} avg={latestKpi.sales?.promedio_empresa} top={latestKpi.sales?.top_empresa} 
                        />
                    </>
                ) : (
                    <div className="text-xs text-light-text-tertiary dark:text-dark-text-secondary">Sin datos de KPI disponibles.</div>
                )}
            </div>

            {/* Tiles individuales para métricas clave */}
            <KpiTile title="Mesas" value={latestKpi?.total_mesas?.valor} icon={BarChart2} trend={latestKpi?.total_mesas?.puesto_local} unit="" delay={0.1} />
            <KpiTile title="Ticket Prom." value={latestKpi?.promedio_por_mesa?.valor} icon={DollarSign} trend={latestKpi?.promedio_por_mesa?.puesto_local} unit="$" delay={0.2} />
        </div>

        {/* === SECCIÓN INFERIOR: Atributos / Méritos (Accordion clásico) === */}
        <div className="mt-4">
            <div className="flex items-center gap-2 mb-3 px-1">
                <Sparkles size={16} className="text-yellow-500" />
                <h3 className="text-sm font-bold text-light-text-primary dark:text-white">
                    {t('mificha.resumen_meritos', 'Tus Atributos')}
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(ficha?.merit_profile?.segments || []).map(seg => {
                    const key = String(seg.token_id);
                    return (
                        <MeritAccordionItem
                            key={seg.token_id}
                            segment={{
                                ...seg,
                                pending: pendingBySegment[key] || 0,
                            }}
                        />
                    );
                })}

                {(!ficha?.merit_profile?.segments || ficha.merit_profile.segments.length === 0) && (
                    <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-2xl text-xs text-gray-500">
                        {t('mificha.sin_meritos', 'No hay atributos activos.')}
                    </div>
                )}
            </div>
        </div>
    </motion.div>
  );
}