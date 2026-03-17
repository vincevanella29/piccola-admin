import React from 'react';
import { motion } from 'framer-motion';
import { MONTH_LABEL } from './utils';

/**
 * Mini bar chart showing sales per month for a product.
 */
export const SalesBar = ({ ventas_meses, maxQty, availableMesanos }) => {
    if (!ventas_meses || ventas_meses.length === 0) {
        return <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary opacity-40">—</span>;
    }
    const months = availableMesanos.slice(0, 3);
    const byMesano = Object.fromEntries(ventas_meses.map(v => [v.mesano, v]));
    return (
        <div className="flex items-end gap-1 h-8">
            {months.map(m => {
                const d = byMesano[m];
                const qty = d?.cantidad || 0;
                const pct = maxQty > 0 ? (qty / maxQty) * 100 : 0;
                return (
                    <div key={m} className="flex flex-col items-center gap-0.5 group/bar" title={`${MONTH_LABEL(m)}: ${qty} un.`}>
                        <div className="w-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-t-sm relative overflow-hidden" style={{ height: 24 }}>
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(pct, qty > 0 ? 8 : 0)}%` }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className={`absolute bottom-0 left-0 right-0 rounded-t-sm ${qty > 0 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-transparent'}`}
                            />
                        </div>
                        <span className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary font-mono opacity-60">
                            {MONTH_LABEL(m).slice(0, 3)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default SalesBar;
