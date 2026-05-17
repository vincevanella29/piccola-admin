import api from './api.jsx';

// Listar vínculos empleado-usuario
export async function getEmployeeUsersApi({ walletAddress, token, status, q, skip = 0, limit = 50 }) {
  const params = { skip, limit };
  if (status) params.status = status;
  if (q) params.q = q;

  return api({
    method: 'GET',
    endpoint: '/admin/employee-users',
    params,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}

// Desactivar vínculo empleado-usuario
export async function deactivateEmployeeUserApi({ rut, walletAddress, token }) {
  return api({
    method: 'POST',
    endpoint: `/admin/employee-users/${encodeURIComponent(rut)}/deactivate`,
    withCredentials: true,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
    },
  });
}
