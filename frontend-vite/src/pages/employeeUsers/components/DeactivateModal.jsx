// src/pages/employeeUsers/components/DeactivateModal.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, UserX, Loader2, X } from 'lucide-react';

const DeactivateModal = ({ isOpen, user, isLoading, onConfirm, onCancel }) => {
  const { t } = useTranslation();

  if (!user) return null;

  const fullName = [user.nombres, user.apellidopaterno, user.apellidomaterno]
    .filter(Boolean)
    .map(s => (s || '').trim())
    .filter(Boolean)
    .join(' ') || user.rut || '—';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl shadow-2xl overflow-hidden">
              {/* Top accent */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

              {/* Close button */}
              <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary transition-colors"
              >
                <X size={18} />
              </button>

              <div className="p-6 pt-8">
                {/* Warning icon */}
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
                  <AlertTriangle size={28} className="text-red-400" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-center text-light-text-primary dark:text-dark-text-primary mb-2">
                  {t('admin.employee_users.confirm_deactivate_title')}
                </h3>

                {/* Description */}
                <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary mb-6 leading-relaxed">
                  {t('admin.employee_users.confirm_deactivate_msg', {
                    name: fullName,
                    rut: user.rut,
                  })}
                </p>

                {/* User preview card */}
                <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/10 dark:border-dark-border/10 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    {user.foto_url ? (
                      <img
                        src={user.foto_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                        <UserX size={16} className="text-amber-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">
                        {fullName}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        RUT: {user.rut} · {user.cargo_vpn || user.cargo || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onCancel}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-medium text-light-text-primary dark:text-dark-text-primary bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/20 dark:border-dark-border/20 hover:bg-light-surface-secondary/70 dark:hover:bg-dark-surface-secondary/70 transition-all disabled:opacity-50"
                  >
                    {t('admin.employee_users.cancel')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserX size={16} />
                    )}
                    {t('admin.employee_users.confirm_deactivate_btn')}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DeactivateModal;
