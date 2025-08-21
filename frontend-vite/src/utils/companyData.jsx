import api from './api.jsx';

// Helper para obtener usuarios de Piccola Italia (company_id=1)
export async function getCompanyUsersApi({ walletAddress, token }) {
  return api({
    method: 'GET',
    endpoint: '/contract/company/users',
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

// Helper para obtener el rol de un usuario en Piccola Italia (company_id=1)
export async function getUserRoleApi({ account, walletAddress, token }) {
  return api({
    method: 'GET',
    endpoint: `/user/role${account ? `?account=${account}` : ''}`,
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

// Helper para asignar un rol en Piccola Italia (company_id=1)
export async function assignCompanyRoleApi({ role_name, account, role_level, signature, plain_data, walletAddress, token }) {
  return api({
    method: 'POST',
    endpoint: '/contract/company/assign-role',
    data: {
      role_name,
      account,
      role_level,
      signature,
      plain_data
    },
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}

// Helper para revocar un rol en Piccola Italia (company_id=1)
export async function revokeCompanyRoleApi({ account, signature, plain_data, walletAddress, token }) {
  return api({
    method: 'POST',
    endpoint: '/contract/company/revoke-role',
    data: {
      account,
      signature,
      plain_data
    },
    withCredentials: true,
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {})
    }
  });
}