// src/pages/employeeUsers/components/EmployeeUsersList.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { UserX, UserCheck, Users, Mail, Wallet, Briefcase, MapPin } from 'lucide-react';
import EmployeeUserCard from './EmployeeUserCard';

const EmployeeUsersList = ({ users, isLoading, onDeactivate }) => {
  const { t } = useTranslation();

  if (!users || users.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16"
      >
        <div className="mx-auto w-16 h-16 rounded-2xl bg-light-surface/40 dark:bg-dark-surface/40 border border-light-border/10 dark:border-dark-border/10 flex items-center justify-center mb-4">
          <Users size={28} className="text-light-text-secondary/40 dark:text-dark-text-secondary/40" />
        </div>
        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
          {t('admin.employee_users.no_users')}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop Table Header */}
      <div className="hidden lg:flex items-center gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">
        <div className="w-10 shrink-0" /> {/* Avatar spacer */}
        <div className="w-[180px] shrink-0">{t('admin.employee_users.name')}</div>
        <div className="w-[80px] shrink-0">{t('admin.employee_users.rut')}</div>
        <div className="w-[120px] shrink-0">{t('admin.employee_users.cargo')}</div>
        <div className="w-[100px] shrink-0">{t('admin.employee_users.wallet')}</div>
        <div className="w-[110px] shrink-0">{t('admin.employee_users.status')}</div>
        <div className="w-[70px] shrink-0">{t('admin.employee_users.registered_at')}</div>
        <div className="ml-auto">{t('admin.employee_users.actions')}</div>
      </div>

      {/* User Cards/Rows */}
      <AnimatePresence mode="popLayout">
        {users.map((user, idx) => (
          <EmployeeUserCard
            key={user._id || user.rut || idx}
            user={user}
            index={idx}
            isLoading={isLoading}
            onDeactivate={onDeactivate}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeUsersList;
