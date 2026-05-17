import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getEmployeeUsersApi,
  deactivateEmployeeUserApi,
} from '../utils/employeeUsersData.jsx';

/**
 * Hook para gestionar usuarios empleados (vínculos empleados_usuarios).
 * Orquesta estado, lógica de negocio y transformación de datos.
 * Las llamadas API se delegan a utils/employeeUsersData.jsx.
 *
 * Nota: NO existe reactivación. La desactivación es permanente.
 * El empleado debe re-registrarse con biometría para crear un nuevo vínculo.
 */
const useEmployeeUsers = (appState = {}) => {
  const { account = null, token = null } = appState || {};
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Transformar/hermosear datos de usuarios para la vista
  const formattedUsers = useMemo(() => {
    return (users || []).map((u) => ({
      ...u,
      // Nombre completo concatenado
      fullName: [u.nombres, u.apellidopaterno, u.apellidomaterno]
        .filter(Boolean)
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' ') || '—',
      // Wallet truncada para display
      displayWallet: u.wallet
        ? u.wallet.slice(0, 6) + '…' + u.wallet.slice(-4)
        : '—',
      // Cargo preferido (vpn primero)
      displayCargo: u.cargo_vpn || u.cargo || '—',
      // Fecha formateada
      displayDate: u.linked_at
        ? new Date(u.linked_at * 1000).toLocaleDateString('es-CL', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : '—',
      // Es activo
      isActive: u.status === 'active',
    }));
  }, [users]);

  /** Listar usuarios empleados */
  const fetchEmployeeUsers = useCallback(async ({ status, q, skip = 0, limit = 50 } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getEmployeeUsersApi({
        walletAddress: account, token, status, q, skip, limit,
      });
      setUsers(res.users || []);
      setTotal(res.total || 0);
      return res;
    } catch (err) {
      const msg = err.message || t('admin.employee_users.error_loading');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [account, token, t]);

  /** Desactivar usuario empleado (PERMANENTE — mata sesiones, sin vuelta atrás) */
  const deactivateUser = useCallback(async (rut) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await deactivateEmployeeUserApi({
        rut, walletAddress: account, token,
      });
      setSuccess(t('admin.employee_users.deactivated_success', { rut }));
      return res;
    } catch (err) {
      const msg = err.message || t('admin.employee_users.error_deactivating');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [account, token, t]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return {
    users: formattedUsers,
    total,
    isLoading,
    error,
    success,
    fetchEmployeeUsers,
    deactivateUser,
    clearMessages,
  };
};

export default useEmployeeUsers;
