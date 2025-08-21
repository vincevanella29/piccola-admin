// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/pages/company/tokens/components/FundAllocation.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PieChartCustom from './PieChartCustom.jsx';

const FundAllocation = ({ fundUsages, t }) => {
  const [activeIdx, setActiveIdx] = useState(null);
  const COLORS = [
    '#4f46e5',
    '#0ea5e9',
    '#22d3ee',
    '#22c55e',
    '#fbbf24',
    '#a21caf',
    '#e11d48',
    '#f59e42',
    '#64748b',
    '#14b8a6',
  ];

  if (!fundUsages || fundUsages.length === 0) {
    return (
      <motion.div
        className="bg-light-surface/90 dark:bg-dark-surface/90 rounded-3xl shadow-xl border border-light-border/30 dark:border-dark-border/30 p-6 flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary italic justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.funds_no_config', 'No fund usages configured.')}
      </motion.div>
    );
  }

  const sortedFundUsages = [...fundUsages].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0));

  return (
    <motion.div
      className="bg-light-surface/90 dark:bg-dark-surface/90 rounded-3xl shadow-xl p-6 flex flex-col gap-3 border border-light-border/30 dark:border-dark-border/30"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="flex items-center gap-2 text-lg font-semibold text-light-accent dark:text-dark-accent mb-2 border-b border-light-border/20 dark:border-dark-border/20 pb-2"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {t('companyTokens.funds_title', 'Fund Allocation')}
      </motion.div>
      <motion.div
        className="flex flex-col items-center gap-4 w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex justify-center items-center w-full">
          <PieChartCustom usages={sortedFundUsages} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
        </div>
        <motion.div
          className="flex flex-col gap-1 w-full max-w-xs mx-auto"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
        >
          {sortedFundUsages.map((f, i) => {
            const color = COLORS[i % COLORS.length];
            const isActive = activeIdx === i;
            return (
              <motion.div
                key={i}
                className={`flex items-center gap-2 text-xs sm:text-sm px-2 py-1 rounded-md border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-light-accent/30 dark:bg-dark-accent/30 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent font-bold shadow'
                    : 'bg-light-surface-tertiary/70 dark:bg-dark-surface-tertiary/70 border-light-border/10 dark:border-dark-border/10'
                }`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                onClick={() => setActiveIdx(i)}
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ scale: 1.02 }}
              >
                <span
                  className="inline-block w-3 h-3 rounded-full mr-1"
                  style={{ background: color, boxShadow: isActive ? '0 0 0 2px #fff' : 'none' }}
                ></span>
                <span className="font-semibold truncate max-w-[7em] sm:max-w-[8em]">
                  {f.name || t('companyTokens.fund_default', 'Use')}
                </span>
                <span className="ml-auto font-mono">
                  {Number(f.percentage || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}%
                </span>
                {f.amount && (
                  <span className="ml-2 font-mono text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                    {Number(f.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default FundAllocation;