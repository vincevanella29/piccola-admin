import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function KpiCard({ title, value, unit, icon: Icon, small = false, rankLocal, rankEmpresa, delay = 0 }) {
  const { t } = useTranslation();
  const displayValue = Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-CL') : (value ?? '-');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden bg-white dark:bg-white/5 backdrop-blur-md border border-light-border/10 dark:border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      {/* Background Decorativo Sutil */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
         {Icon && <Icon size={64} />}
      </div>

      <div className="flex flex-col justify-between h-full relative z-10">
        <div className="flex items-center gap-2 mb-2">
            {Icon && <div className="p-1.5 rounded-md bg-light-surface-secondary dark:bg-white/10 text-light-text-secondary dark:text-dark-text-secondary"><Icon size={16} /></div>}
            <span className="text-xs font-medium uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary/70">{title}</span>
        </div>

        <div className="flex items-baseline gap-1 mt-1">
          <span className={`${small ? 'text-2xl' : 'text-3xl'} font-bold text-light-text-primary dark:text-white tracking-tight`}>
            {displayValue}
          </span>
          {unit && <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{unit}</span>}
        </div>

        {(rankLocal || rankEmpresa) && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-light-border/10 dark:border-white/10">
            {rankLocal && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold uppercase tracking-wide"
                data-tooltip-id="dashboard-tooltip" 
                data-tooltip-content={t('mificha.puesto_local', 'Ranking Local')}
              >
                <Award size={12} /> #{rankLocal}
              </div>
            )}
            {rankEmpresa && (
              <div 
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold uppercase tracking-wide"
                data-tooltip-id="dashboard-tooltip" 
                data-tooltip-content={t('mificha.puesto_empresa', 'Ranking Empresa')}
              >
                <TrendingUp size={12} /> #{rankEmpresa}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};