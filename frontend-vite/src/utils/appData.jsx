import api from './api.jsx';

const appData = {
  // Listar nombres de colecciones de la BD Mongo
  fetchDbCollections: async ({ token, account }) => {
    return await api({
      method: 'get',
      endpoint: '/db/collections',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  // Traer los datos de una colección específica
  fetchDbCollectionData: async ({ collectionName, token, account }) => {
    if (!collectionName) return { data: [] };
    return await api({
      method: 'get',
      endpoint: `/db/${collectionName}`,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(account ? { 'X-Wallet-Address': account } : {}),
      },
      withCredentials: true,
    });
  },

  loginWithPrivy: async ({ accessToken, wallet, notification_token, device_type, permissions_granted }) => {
    try {
      const response = await api({
        method: 'post',
        endpoint: '/login', // Ajustado al endpoint correcto
        data: { 
          token: accessToken, 
          wallet,
          notification_token,
          device_type,
          permissions_granted
        },
        headers: {
          'X-Wallet-Address': wallet,
        },
      });
      return response;
    } catch (err) {
      console.error('appData.jsx - Error logging in with Privy:', err);
      throw new Error(err.message || 'Error logging in with Privy');
    }
  },

  fetchUserRole: async ({ accessToken, walletAddress }) => {
    try {
      return await api({
        method: 'get',
        endpoint: '/user/role',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(walletAddress ? { 'X-Wallet-Address': walletAddress } : {}),
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching user role:', err);
      throw new Error(err.message || 'Error fetching user role');
    }
  },

  fetchUsersApi: async ({ account, setUsers, setError, setIsLoading, t, accessToken }) => {
    try {
      setIsLoading(true);
      const response = await api({
        method: 'get',
        endpoint: '/contract/company/users', // Ajustado al endpoint correcto
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': account,
        },
      });
      setUsers(response.users || []);
    } catch (err) {
      console.error('appData.jsx - Error fetching users:', err);
      setError(err.message || t('appData.error_loading_users'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  },

  fetchPaymentTokens: async () => {
    try {
      return await api({
        method: 'get',
        endpoint: '/payment_tokens',
        withCredentials: false,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching payment tokens:', err);
      throw new Error(err.message || 'Error fetching payment tokens');
    }
  },

  fetchPlatformTokens: async () => {
    try {
      return await api({
        method: 'get',
        endpoint: '/platform_tokens',
        withCredentials: false,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching platform tokens:', err);
      throw new Error(err.message || 'Error fetching platform tokens');
    }
  },

  // Nuevos métodos para notificaciones
  fetchNotificationTypes: async ({ accessToken, walletAddress }) => {
    try {
      return await api({
        method: 'get',
        endpoint: '/notifications/types', // Añadido /api
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching notification types:', err);
      throw new Error(err.message || 'Error fetching notification types');
    }
  },

  fetchApiConfigs: async ({ accessToken, walletAddress }) => {
    try {
      return await api({
        method: 'get',
        endpoint: '/notifications/api-configs', // Añadido /api
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching API configs:', err);
      throw new Error(err.message || 'Error fetching API configs');
    }
  },

  createNotificationType: async ({ accessToken, walletAddress, data }) => {
    try {
      return await api({
        method: 'post',
        endpoint: '/notifications/types', // Añadido /api
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error creating notification type:', err);
      throw new Error(err.message || 'Error creating notification type');
    }
  },

  createApiConfig: async ({ accessToken, walletAddress, data }) => {
    try {
      return await api({
        method: 'post',
        endpoint: '/notifications/api-configs', // Añadido /api
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error creating API config:', err);
      throw new Error(err.message || 'Error creating API config');
    }
  },

  sendNotification: async ({ accessToken, walletAddress, data }) => {
    try {
      return await api({
        method: 'post',
        endpoint: '/notifications/send', // Añadido /api
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error sending notification:', err);
      throw new Error(err.message || 'Error sending notification');
    }
  },

  saveNotificationToken: async ({ accessToken, walletAddress, data }) => {
    try {
      return await api({
        method: 'post',
        endpoint: '/notifications/tokens', // Añadido /api
        data,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error saving notification token:', err);
      throw new Error(err.message || 'Error saving notification token');
    }
  },

  fetchUsersWithTokens: async ({ accessToken, walletAddress }) => {
    try {
      return await api({
        method: 'get',
        endpoint: '/notifications/users-with-tokens',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Wallet-Address': walletAddress,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error fetching users with tokens:', err);
      throw new Error(err.message || 'Error fetching users with tokens');
    }
  },

  // Confirm Telegram link with Privy session
  telegramLinkConfirm: async ({ accessToken, wallet, tg_id, state }) => {
    try {
      return await api({
        method: 'post',
        endpoint: '/telegram/link/confirm',
        data: {
          token: accessToken,
          wallet,
          tg_id,
          state,
        },
        headers: {
          'X-Wallet-Address': wallet,
        },
        withCredentials: true,
      });
    } catch (err) {
      console.error('appData.jsx - Error confirming Telegram link:', err);
      throw new Error(err.message || 'Error confirming Telegram link');
    }
  }
};

export default appData;