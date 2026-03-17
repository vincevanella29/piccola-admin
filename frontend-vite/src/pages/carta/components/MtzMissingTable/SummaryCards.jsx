import React from 'react';
import { motion } from 'framer-motion';
import { Database, ShoppingBag, DollarSign } from 'lucide-react';
import { CLP, NUM } from './utils';

/**
 * Summary cards row: total products, total units sold, total revenue.
 */
const SummaryCards = ({ products, t }) => {
    const totalUnits   = products.reduce((a, p) => a + (p.total_vendido || 0), 0);
    const totalRevenue = products.reduce((a, p) => a + (p.total_venta || 0), 0);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{products.length}</div>
                    <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('mtz.missing.no_carta')}</div>
                </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary">{NUM(totalUnits)}</div>
                    <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('mtz.missing.units_3m')}</div>
                </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <div className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{CLP(totalRevenue)}</div>
                    <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('mtz.missing.revenue_3m')}</div>
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;
