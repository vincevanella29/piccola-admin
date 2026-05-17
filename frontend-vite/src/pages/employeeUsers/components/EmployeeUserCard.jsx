// src/pages/employeeUsers/components/EmployeeUserCard.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { UserX, Wallet, Briefcase, MapPin, Mail, Clock, User, ShieldOff } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
        isActive
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-red-500/15 text-red-400 border border-red-500/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
      {isActive ? t('admin.employee_users.active_badge') : t('admin.employee_users.deactivated_badge')}
    </span>
  );
};

const EmployeeUserCard = React.forwardRef(({ user, index, isLoading, onDeactivate }, ref) => {
  const { t } = useTranslation();

  // Use pre-computed fields from hook
  const { fullName, displayWallet, displayCargo, displayDate, isActive } = user;
  const fotoUrl = user.foto_url || null;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isActive
          ? 'bg-light-surface/50 dark:bg-dark-surface/50 border-light-border/15 dark:border-dark-border/15 hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5'
          : 'bg-light-surface/20 dark:bg-dark-surface/20 border-red-500/8 opacity-60'
      }`}
    >
      {/* Subtle gradient accent */}
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${
        isActive
          ? 'from-emerald-500/0 via-emerald-500/40 to-emerald-500/0'
          : 'from-red-500/0 via-red-500/30 to-red-500/0'
      }`} />

      {/* ========== Desktop Row ========== */}
      <div className="hidden lg:flex items-center gap-4 px-5 py-4">
        {/* Avatar */}
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={fullName}
            className={`w-10 h-10 rounded-xl object-cover border border-light-border/20 dark:border-dark-border/20 shrink-0 ${!isActive ? 'grayscale' : ''}`}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${isActive ? 'from-amber-500/20 to-orange-500/20 border-amber-500/20' : 'from-gray-500/20 to-gray-600/20 border-gray-500/20'} border flex items-center justify-center shrink-0`}>
            <User size={16} className={isActive ? 'text-amber-400' : 'text-gray-500'} />
          </div>
        )}

        {/* Name + Email */}
        <div className="min-w-0 w-[180px] shrink-0">
          <p className={`text-sm font-semibold truncate ${isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary line-through'}`}>
            {fullName}
          </p>
          {user.email && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
              {user.email}
            </p>
          )}
        </div>

        {/* RUT */}
        <div className="w-[80px] shrink-0 text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">
          {user.rut || '—'}
        </div>

        {/* Cargo + Sucursal */}
        <div className="min-w-0 w-[120px] shrink-0">
          <p className="text-xs text-light-text-primary dark:text-dark-text-primary truncate">
            {displayCargo}
          </p>
          {user.sucursal && (
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1 truncate">
              <MapPin size={10} className="shrink-0" />{user.sucursal}
            </p>
          )}
        </div>

        {/* Wallet */}
        <div className="w-[100px] shrink-0 text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary truncate" title={user.wallet}>
          {displayWallet}
        </div>

        {/* Status */}
        <div className="w-[110px] shrink-0">
          <StatusBadge status={user.status} />
        </div>

        {/* Date */}
        <div className="w-[70px] shrink-0 text-xs text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">
          {displayDate}
        </div>

        {/* Actions — only deactivate for active users */}
        <div className="ml-auto shrink-0">
          {isActive ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isLoading}
              onClick={() => onDeactivate(user)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 hover:border-red-500/30 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <UserX size={13} />
              {t('admin.employee_users.deactivate')}
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 whitespace-nowrap">
              <ShieldOff size={13} />
              {t('admin.employee_users.permanently_deactivated')}
            </div>
          )}
        </div>
      </div>

      {/* ========== Mobile Card ========== */}
      <div className="lg:hidden p-4 space-y-3">
        {/* Top: avatar + name + status */}
        <div className="flex items-start gap-3">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={fullName}
              className={`w-11 h-11 rounded-xl object-cover border border-light-border/20 dark:border-dark-border/20 shrink-0 ${!isActive ? 'grayscale' : ''}`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${isActive ? 'from-amber-500/20 to-orange-500/20 border-amber-500/20' : 'from-gray-500/20 to-gray-600/20 border-gray-500/20'} border flex items-center justify-center shrink-0`}>
              <User size={18} className={isActive ? 'text-amber-400' : 'text-gray-500'} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${!isActive ? 'line-through text-light-text-secondary dark:text-dark-text-secondary' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
              {fullName}
            </p>
            <p className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
              RUT: {user.rut || '—'}
            </p>
          </div>
          <StatusBadge status={user.status} />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-14">
          {displayCargo !== '—' && (
            <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <Briefcase size={11} className="text-amber-400/70 shrink-0" />
              <span className="truncate">{displayCargo}</span>
            </div>
          )}
          {user.sucursal && (
            <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <MapPin size={11} className="text-amber-400/70 shrink-0" />
              <span className="truncate">{user.sucursal}</span>
            </div>
          )}
          {user.wallet && (
            <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
              <Wallet size={11} className="text-amber-400/70 shrink-0" />
              <span className="font-mono truncate">{displayWallet}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
            <Clock size={11} className="text-amber-400/70 shrink-0" />
            <span>{displayDate}</span>
          </div>
        </div>

        {/* Mobile Action — only deactivate for active users */}
        <div className="flex justify-end">
          {isActive ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={isLoading}
              onClick={() => onDeactivate(user)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50"
            >
              <UserX size={14} />
              {t('admin.employee_users.deactivate')}
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500">
              <ShieldOff size={13} />
              {t('admin.employee_users.permanently_deactivated')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

EmployeeUserCard.displayName = 'EmployeeUserCard';

export default EmployeeUserCard;
