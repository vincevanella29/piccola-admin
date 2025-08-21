import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';
import useAdminData from '../../../../hooks/useAdminData';

const AdminUsers = ({ appState }) => {
  const { t } = useTranslation();
  const { users, isLoading, error, success, fetchUsersApi, assignCompanyRole, revokeCompanyRole } = useAdminData(appState);
  const didFetch = useRef(false);
  const [roleName, setRoleName] = useState('');
  const [targetAddress, setTargetAddress] = useState('');
  const [formError, setFormError] = useState(null);

  // Obtener el nivel de rol del usuario actual
  const userRoleLevel = appState?.roleLevel ?? null;

  // Mapear el nivel de rol al nombre para mostrarlo
  const roleOptions = [
    { name: 'DOMINUS_SAPORIS', level: 3, label: t('admin.roles.dominus_saporis') },
    { name: 'CENTURIO_MENSARUM', level: 4, label: t('admin.roles.centurio_mensarum') },
    { name: 'MILITES_CULINAE', level: 5, label: t('admin.roles.milites_culinae') }
  ];

  // Filtrar roles según el nivel jerárquico (solo roles con level > userRoleLevel)
  const allowedRoleOptions = userRoleLevel !== null
    ? roleOptions.filter(role => role.level > userRoleLevel)
    : [];

  // Obtener el nombre del rol actual del usuario
  const currentUserRole = userRoleLevel !== null
    ? roleOptions.find(role => role.level === userRoleLevel)?.label || 'Unknown Role'
    : 'No Role Assigned';

  // Validar jerarquía para revocación
  const canRevokeRole = (targetLevel) => {
    if (userRoleLevel === null || userRoleLevel === 5) return false;
    if (userRoleLevel === 3) return targetLevel === 4 || targetLevel === 5;
    if (userRoleLevel === 4) return targetLevel === 5;
    return false;
  };

  // Cargar usuarios al montar el componente
  useEffect(() => {
    if (didFetch.current) return;
    if (appState.token && appState.account) {
      fetchUsersApi();
      didFetch.current = true;
    }
    // eslint-disable-next-line
  }, [appState.token, appState.account]);

  // Manejar asignación de rol
  const handleAssignRole = async () => {
    setFormError(null);
    if (!targetAddress || !roleName) {
      setFormError(t('admin.form.incomplete'));
      return;
    }
    if (!ethers.isAddress(targetAddress)) {
      setFormError(t('admin.form.invalid_address'));
      return;
    }
    try {
      const selectedRole = allowedRoleOptions.find((role) => role.name === roleName);
      if (!selectedRole) {
        setFormError(t('admin.form.invalid_role'));
        return;
      }
      // Verificar jerarquía
      if (userRoleLevel !== null && selectedRole.level <= userRoleLevel) {
        setFormError(t('admin.form.hierarchy_error'));
        return;
      }
      // Convertir a checksum
      const checksumTargetAddress = ethers.getAddress(targetAddress);
      await assignCompanyRole({
        role_name: selectedRole.name,
        account: checksumTargetAddress,
        role_level: selectedRole.level
      });
      setTargetAddress('');
      setRoleName('');
    } catch (err) {
      setFormError(err.message || t('admin.form.error_assigning_role'));
    }
  };

  // Manejar revocación de rol
  const handleRevokeRole = async (address, targetLevel) => {
    setFormError(null);
    if (!canRevokeRole(targetLevel)) {
      setFormError(t('admin.form.hierarchy_error'));
      return;
    }
    try {
      // Convertir a checksum
      const checksumAddress = ethers.getAddress(address);
      await revokeCompanyRole(checksumAddress);
    } catch (err) {
      setFormError(err.message || t('admin.form.error_revoking_role'));
    }
  };

  return (
    <div>
      {/* Notificaciones locales */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-error/20 dark:bg-dark-error/20 rounded-lg flex items-center gap-2 shadow-neon-error"
          >
            <AlertTriangle size={20} className="text-light-error dark:text-dark-error" />
            <p className="text-light-error dark:text-dark-error text-sm sm:text-base">{error}</p>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-success/20 dark:bg-dark-success/20 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <CheckCircle size={20} className="text-light-success dark:text-dark-success" />
            <span className="text-light-success dark:text-dark-success text-sm sm:text-base">{success}</span>
          </motion.div>
        )}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-6 max-w-2xl mx-auto p-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/30 rounded-lg flex items-center gap-2 shadow-neon"
          >
            <Loader2 size={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
            <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm sm:text-base">
              {t('admin.loading')}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mostrar el rol del usuario actual */}
      <div className="mb-6">
        <p className="text-sm sm:text-base text-light-text-primary dark:text-dark-text-primary">
          {t('admin.your_role')}: <span className="font-semibold">{currentUserRole}</span>
        </p>
      </div>

      {/* Formulario para asignar rol */}
      <div className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('admin.assign_role')}
        </h2>
        {userRoleLevel === null ? (
          <p className="text-light-error dark:text-dark-error text-sm sm:text-base">
            {t('admin.form.no_permission')}
          </p>
        ) : userRoleLevel === 5 ? (
          <p className="text-light-error dark:text-dark-error text-sm sm:text-base">
            {t('admin.form.no_roles_available')}
          </p>
        ) : allowedRoleOptions.length === 0 ? (
          <p className="text-light-error dark:text-dark-error text-sm sm:text-base">
            {t('admin.form.no_roles_available')}
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('admin.address')}
              </label>
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder={t('admin.address_placeholder')}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                {t('admin.role')}
              </label>
              <select
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="w-full p-3 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 border border-light-border/40 dark:border-dark-border/40 rounded-xl text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:border-light-accent dark:focus:border-dark-accent text-sm"
                disabled={allowedRoleOptions.length === 0}
              >
                <option value="">{t('admin.select_role')}</option>
                {allowedRoleOptions.map((role) => (
                  <option key={role.name} value={role.name}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <motion.button
                onClick={handleAssignRole}
                disabled={isLoading || !targetAddress || !roleName || allowedRoleOptions.length === 0}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-dark-text-primary font-semibold disabled:opacity-50 shadow-neon transition-all text-sm sm:text-base"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('admin.assign_role_button')}
              </motion.button>
            </div>
          </div>
        )}
        <AnimatePresence>
          {formError && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-2 text-light-error dark:text-dark-error text-sm"
            >
              {formError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Lista de usuarios */}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-light-text-primary dark:text-dark-text-primary">
          {t('admin.users_list')}
        </h2>
        <button
          onClick={fetchUsersApi}
          className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-all disabled:opacity-50 transform hover:scale-105 mb-4 text-sm sm:text-base"
          disabled={isLoading}
        >
          {t('admin.update_users')}
        </button>
        {users.length === 0 ? (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm sm:text-base">
            {t('admin.no_users')}
          </p>
        ) : (
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full table-fixed border-collapse max-w-full">
              <thead>
                <tr className="bg-light-surface-tertiary dark:bg-dark-surface-tertiary">
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.address')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.role')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.status')}
                  </th>
                  <th className="py-3 px-4 text-left text-light-text-secondary dark:text-dark-text-secondary text-xs sm:text-sm capitalize whitespace-nowrap">
                    {t('admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const targetLevel = roleOptions.find((role) => role.name === user.role_name)?.level || -1;
                  const canRevoke = canRevokeRole(targetLevel);
                  return (
                    <tr
                      key={user.address || user.id}
                      className="border-b border-light-border/10 dark:border-dark-border/10 hover:bg-light-surface-secondary/40 dark:hover:bg-dark-surface-secondary/40"
                    >
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                        {user.displayAddress || user.address}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                        {user.role_name || '-'}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm text-light-text-primary dark:text-dark-text-primary truncate whitespace-nowrap overflow-hidden max-w-[7rem] sm:max-w-[12rem]">
                        {t(user.is_active ? 'admin.active' : 'admin.inactive')}
                      </td>
                      <td className="py-3 px-2 sm:px-4 text-xs sm:text-sm">
                        <motion.button
                          onClick={() => handleRevokeRole(user.address, targetLevel)}
                          disabled={isLoading || !canRevoke}
                          className="px-3 py-1 bg-light-error/20 dark:bg-dark-error/20 text-light-error dark:text-dark-error rounded-lg hover:bg-light-error/30 dark:hover:bg-dark-error/30 transition disabled:opacity-50 text-xs sm:text-sm"
                          whileHover={{ scale: canRevoke ? 1.05 : 1 }}
                          whileTap={{ scale: canRevoke ? 0.95 : 1 }}
                        >
                          {t('admin.revoke_role')}
                        </motion.button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;