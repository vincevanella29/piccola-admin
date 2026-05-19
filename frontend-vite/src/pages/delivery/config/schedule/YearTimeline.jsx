// schedule/YearTimeline.jsx — Horizontal 12-month strip with colored dots
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const YearTimeline = ({ year = new Date().getFullYear(), specialDates = [], onMonthClick, activeMonth }) => {
  const { t } = useTranslation();
  const monthNames = t('delivery.schedule.months').split(',');

  const monthStats = useMemo(() => {
    const stats = Array.from({ length: 12 }, () => ({ closures: 0, specials: 0 }));
    specialDates.forEach(sd => {
      if (!sd.date) return;
      const d = new Date(sd.date + 'T00:00:00');
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      if (sd.closed) stats[m].closures++;
      else stats[m].specials++;
    });
    return stats;
  }, [specialDates, year]);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
      {monthNames.map((name, i) => {
        const s = monthStats[i];
        const isActive = activeMonth === i;
        const hasDots = s.closures > 0 || s.specials > 0;
        return (
          <motion.button key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => onMonthClick?.(i)}
            className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all border ${
              isActive
                ? 'bg-light-accent/15 dark:bg-dark-accent/15 border-light-accent/30 dark:border-dark-accent/30'
                : 'bg-light-surface dark:bg-dark-surface border-light-border/10 dark:border-dark-border/10 hover:border-light-border/30 dark:hover:border-dark-border/30'
            }`}>
            <span className={`text-[10px] font-bold ${isActive ? 'text-light-accent dark:text-dark-accent' : 'text-light-text-primary dark:text-dark-text-primary'}`}>{name}</span>
            <div className="flex gap-0.5 h-2 items-center">
              {s.closures > 0 && <span className="w-1.5 h-1.5 rounded-full bg-light-error dark:bg-dark-error" />}
              {s.specials > 0 && <span className="w-1.5 h-1.5 rounded-full bg-matrix-green" />}
              {!hasDots && <span className="w-1.5 h-1.5 rounded-full bg-light-border/30 dark:bg-dark-border/30" />}
            </div>
            {hasDots && (
              <span className="text-[8px] font-bold text-light-text-secondary dark:text-dark-text-secondary">
                {s.closures + s.specials}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

export default YearTimeline;
