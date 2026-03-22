import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

const BulkActionsBar = ({ activeTab, selectedProductIds, selectedCategoryIds, onClear, onDelete }) => {
    const { t } = useTranslation();
    const count = activeTab === 'products' ? selectedProductIds.length : selectedCategoryIds.length;
    const isVisible = (activeTab === 'products' && selectedProductIds.length > 0) ||
        (activeTab === 'categories' && selectedCategoryIds.length > 0);

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 64, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 64, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 sm:py-3 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-light-border/60 dark:border-dark-border/60 rounded-2xl shadow-modal max-w-[calc(100vw-2rem)]"
                >
                    {/* Count pill */}
                    <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-light-accent/10 dark:bg-dark-accent/15 text-light-accent dark:text-dark-accent text-xs font-bold flex items-center justify-center">
                            {count}
                        </span>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{t('carta.bulk_actions')}</span>
                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{t('carta.selected_count', { count })}</span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-light-border dark:bg-dark-border" />

                    <div className="flex gap-2">
                        <button onClick={onClear}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors border border-light-border dark:border-dark-border">
                            {t('carta.undo')}
                        </button>
                        <button onClick={onDelete}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-error text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-neon-error">
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('carta.delete_selection')}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default BulkActionsBar;
