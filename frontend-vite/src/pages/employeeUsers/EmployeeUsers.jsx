// src/pages/employeeUsers/EmployeeUsers.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, RefreshCw, Loader2, CheckCircle,
  AlertTriangle, UserX, UserCheck, Shield
} from 'lucide-react';
import useEmployeeUsers from '../../hooks/useEmployeeUsers';
import EmployeeUsersList from './components/EmployeeUsersList';
import DeactivateModal from './components/DeactivateModal';

const EmployeeUsers = ({ appState }) => {
  const { t } = useTranslation();
  const {
    users,
    total,
    isLoading,
    error,
    success,
    fetchEmployeeUsers,
    deactivateUser,
    clearMessages,
  } = useEmployeeUsers(appState);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch on mount
  useEffect(() => {
    if (!hasFetched && (appState?.token || appState?.account)) {
      fetchEmployeeUsers({ status: statusFilter || undefined, q: searchQuery || undefined });
      setHasFetched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState?.token, appState?.account]);

  const handleSearch = useCallback(() => {
    fetchEmployeeUsers({ status: statusFilter || undefined, q: searchQuery || undefined });
  }, [fetchEmployeeUsers, statusFilter, searchQuery]);

  const handleFilterChange = useCallback((newStatus) => {
    setStatusFilter(newStatus);
    fetchEmployeeUsers({ status: newStatus || undefined, q: searchQuery || undefined });
  }, [fetchEmployeeUsers, searchQuery]);

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateUser(deactivateTarget.rut);
      setDeactivateTarget(null);
      // Refresh list
      fetchEmployeeUsers({ status: statusFilter || undefined, q: searchQuery || undefined });
    } catch {
      // error handled by hook
    }
  }, [deactivateTarget, deactivateUser, fetchEmployeeUsers, statusFilter, searchQuery]);


  // Auto-clear messages
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error, clearMessages]);

  const filters = [
    { key: '', label: t('admin.employee_users.filter_all'), icon: Users, count: null },
    { key: 'active', label: t('admin.employee_users.filter_active'), icon: UserCheck, count: null },
    { key: 'deactivated', label: t('admin.employee_users.filter_deactivated'), icon: UserX, count: null },
  ];

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6 text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Shield className="text-amber-400" size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary">
            {t('admin.employee_users.dashboard')}
          </h1>
        </div>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
          {t('admin.employee_users.description')}
        </p>
      </motion.div>

      {/* Toast Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-4 max-w-4xl mx-auto w-full p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 backdrop-blur-sm"
          >
            <AlertTriangle size={18} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-4 max-w-4xl mx-auto w-full p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 backdrop-blur-sm"
          >
            <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            <p className="text-emerald-400 text-sm">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="max-w-4xl mx-auto w-full mb-6 space-y-4"
      >
        {/* Search */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
            <input
              id="employee-users-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('admin.employee_users.search_placeholder')}
              className="w-full pl-10 pr-4 py-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/20 dark:border-dark-border/20 rounded-xl text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-sm backdrop-blur-sm transition-all"
            />
          </div>
          <motion.button
            onClick={handleSearch}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-shadow disabled:opacity-50"
          >
            <Search size={16} />
          </motion.button>
          <motion.button
            onClick={() => fetchEmployeeUsers({ status: statusFilter || undefined, q: searchQuery || undefined })}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            className="px-5 py-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/20 dark:border-dark-border/20 text-light-text-secondary dark:text-dark-text-secondary rounded-xl hover:border-amber-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </motion.button>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <motion.button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${statusFilter === f.key
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'bg-light-surface/40 dark:bg-dark-surface/40 text-light-text-secondary dark:text-dark-text-secondary border border-transparent hover:border-light-border/20 dark:hover:border-dark-border/20'
                }`}
            >
              <f.icon size={14} />
              {f.label}
            </motion.button>
          ))}
          {total > 0 && (
            <span className="flex items-center px-3 py-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              {t('admin.employee_users.total_users', { count: total })}
            </span>
          )}
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && users.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-4xl mx-auto w-full flex items-center justify-center py-20"
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-amber-400 animate-spin" />
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary animate-pulse">
              {t('admin.loading')}
            </p>
          </div>
        </motion.div>
      )}

      {/* Content */}
      {(!isLoading || users.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-4xl mx-auto w-full"
        >
          <EmployeeUsersList
            users={users}
            isLoading={isLoading}
            onDeactivate={(user) => setDeactivateTarget(user)}
          />
        </motion.div>
      )}

      {/* Deactivate Modal */}
      <DeactivateModal
        isOpen={!!deactivateTarget}
        user={deactivateTarget}
        isLoading={isLoading}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
};

export default EmployeeUsers;

export const pageMetadata = {
  path: '/app/admin/employee-users',
  label: 'admin.employee_users.label',
  category: 'admin.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  orderWalletMenu: 6,
  locations: ['sidebar', 'walletMenu'],
  description: 'admin.employee_users.description',
  icon: 'FaUsersCog',
};
