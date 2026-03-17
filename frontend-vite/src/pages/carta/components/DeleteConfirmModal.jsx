import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

const DeleteConfirmModal = ({ confirmDelete, isDeleting, onCancel, onConfirm }) => {
    const { t } = useTranslation();

    const bodyText = confirmDelete.isBulk
        ? t('carta.confirm_delete_bulk', { count: confirmDelete.count, type: confirmDelete.type === 'products' ? t('carta.confirm_delete_bulk_products') : t('carta.confirm_delete_bulk_categories') })
        : t('carta.confirm_delete_single', { name: confirmDelete.name });

    return (
        <div className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-md p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="w-full sm:max-w-sm bg-light-surface dark:bg-dark-surface sm:rounded-2xl rounded-t-3xl shadow-2xl border border-light-border dark:border-dark-border overflow-hidden"
            >
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-light-border dark:bg-dark-border" />
                </div>

                <div className="px-6 pt-6 pb-4 text-center space-y-4">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-7 h-7 text-red-500 dark:text-red-400" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                            {t('carta.confirm_delete_title')}
                        </h3>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed max-w-[260px] mx-auto">
                            {bodyText}
                            <span className="block mt-1 text-xs font-semibold text-red-500 dark:text-red-400">{t('carta.confirm_delete_irreversible')}</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 px-6 pb-6 pt-2">
                    <button onClick={onCancel} disabled={isDeleting}
                        className="flex-1 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors">
                        {t('carta.cancel')}
                    </button>
                    <button onClick={onConfirm} disabled={isDeleting}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold shadow-lg shadow-red-500/25 disabled:opacity-50 transition-all">
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {t('carta.delete')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default DeleteConfirmModal;
