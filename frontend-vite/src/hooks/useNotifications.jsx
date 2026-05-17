import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import appData from '../utils/appData.jsx';
import { getToken, deleteToken } from 'firebase/messaging';

const useNotifications = ({ accessToken, account, setError, setSuccess, appState }) => {
  const { t } = useTranslation();
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
  typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "default"
);
  const [usersWithTokens, setUsersWithTokens] = useState([]);
  const [audience, setAudience] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  
  // Automations state
  const [automations, setAutomations] = useState([]);

  // Chequeo de soporte web push
  function isWebPushSupported() {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    );
  }

  const fetchNotificationTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchNotificationTypes({ accessToken, walletAddress: account });
      setNotificationTypes(res || []);
      setSuccess(t('notifications.types_fetched'));
    } catch (err) {
      setError(t('notifications.error_fetching_types'));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const fetchApiConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchApiConfigs({ accessToken, walletAddress: account });
      setApiConfigs(res || []);
      setSuccess(t('notifications.api_configs_fetched'));
    } catch (err) {
      setError(t('notifications.error_fetching_api_configs'));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const createNotificationType = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.createNotificationType({ accessToken, walletAddress: account, data });
      setNotificationTypes((prev) => [...prev, res]);
      setSuccess(t('notifications.type_created'));
      return res;
    } catch (err) {
      setError(t('notifications.error_creating_type'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const createApiConfig = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.createApiConfig({ accessToken, walletAddress: account, data });
      // Refetch to get latest state
      const configs = await appData.fetchApiConfigs({ accessToken, walletAddress: account });
      setApiConfigs(configs || []);
      setSuccess(t('notifications.api_config_created'));
      return res;
    } catch (err) {
      setError(t('notifications.error_creating_api_config'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const uploadServiceAccount = useCallback(async (file) => {
    setIsLoading(true);
    try {
      const res = await appData.uploadServiceAccount({ accessToken, walletAddress: account, file });
      setSuccess(`Service Account guardado (${res.project_id})`);
      // Refetch configs
      const configs = await appData.fetchApiConfigs({ accessToken, walletAddress: account });
      setApiConfigs(configs || []);
      return res;
    } catch (err) {
      setError(err.message || 'Error subiendo Service Account');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const fetchUsersWithTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchUsersWithTokens({ accessToken, walletAddress: account });
      setUsersWithTokens(res || []);
      setSuccess(t('notifications.users_fetched'));
    } catch (err) {
      setError(t('notifications.error_fetching_users'));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const fetchAudience = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchAudience({ accessToken, walletAddress: account });
      setAudience(res || []);
    } catch (err) {
      setError(err.message || 'Error fetching audience');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, setError]);

  const deleteAudienceMember = useCallback(async (token) => {
    setIsLoading(true);
    try {
      await appData.deleteAudience({ accessToken, walletAddress: account, token });
      setAudience(prev => prev.filter(m => m.token !== token));
      setSuccess(t('notifications.audience_deleted') || 'Audience member deleted');
    } catch (err) {
      setError(t('notifications.error_deleting_audience') || 'Error deleting audience member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await appData.fetchNotificationAnalytics({ accessToken, walletAddress: account });
      setAnalyticsData(res);
      setSuccess(t('notifications.analytics_fetched') || 'Analytics fetched');
    } catch (err) {
      setError(t('notifications.error_fetching_analytics') || 'Error fetching analytics');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const sendNotification = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.sendNotification({ accessToken, walletAddress: account, data });
      setSuccess(t('notifications.notification_sent'));
      return res;
    } catch (err) {
      setError(t('notifications.error_sending_notification'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

   const saveNotificationToken = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isWebPushSupported()) {
        setError(t('notifications.unsupported_browser'));
        return;
      }
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const vKey = appState.vapidKey
          || appState.providers?.firebase?.public_config?.vapidKey
          || (Array.isArray(apiConfigs) && apiConfigs[0]?.vapid_key)
          || null;
        if (!vKey) {
          // Try to fetch api configs first
          try {
            const configs = await appData.fetchApiConfigs({ accessToken, walletAddress: account });
            const fetchedKey = (configs || [])[0]?.vapid_key;
            if (fetchedKey) {
              setApiConfigs(configs);
              try { await deleteToken(appState.firebase.messaging); } catch(e) {}
              const token = await getToken(appState.firebase.messaging, { vapidKey: fetchedKey });
              const res = await appData.saveNotificationToken({
                accessToken, walletAddress: account,
                data: { token, device_type: 'web', permissions_granted: true }
              });
              setSuccess(t('notifications.token_saved'));
              return res;
            }
          } catch {}
          setError('VAPID Key no configurada. Ve a Settings → Paso 2 y agrega la VAPID Key.');
          return;
        }
        try { await deleteToken(appState.firebase.messaging); } catch(e) {}
        const token = await getToken(appState.firebase.messaging, { vapidKey: vKey });
        const res = await appData.saveNotificationToken({
          accessToken,
          walletAddress: account,
          data: {
            token,
            device_type: 'web',
            permissions_granted: true
          }
        });
        setSuccess(t('notifications.token_saved'));
        return res;
      } else {
        setError(t('notifications.permission_denied'));
      }
    } catch (err) {
      setError(t('notifications.error_saving_token'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess, appState.firebase.messaging]);

  const updateNotificationType = useCallback(async (id, data) => {
    setIsLoading(true);
    try {
      const res = await appData.updateNotificationType({ accessToken, walletAddress: account, id, data });
      setNotificationTypes((prev) => prev.map((nt) => nt.id === id ? { ...nt, ...res } : nt));
      setSuccess(t('notifications.type_updated') || 'Template updated');
      return res;
    } catch (err) {
      setError(t('notifications.error_updating_type') || 'Error updating template');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const deleteNotificationType = useCallback(async (id) => {
    setIsLoading(true);
    try {
      await appData.deleteNotificationType({ accessToken, walletAddress: account, id });
      setNotificationTypes((prev) => prev.filter((nt) => nt.id !== id));
      setSuccess(t('notifications.type_deleted') || 'Template deleted');
    } catch (err) {
      setError(t('notifications.error_deleting_type') || 'Error deleting template');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  // --- Automations ---
  const [triggers, setTriggers] = useState({});

  const loadTriggers = useCallback(async () => {
    try {
      const res = await appData.fetchAutomationTriggers({ accessToken, walletAddress: account });
      setTriggers(res.triggers || {});
    } catch (err) {
      console.warn('Could not load automation triggers:', err);
    }
  }, [accessToken, account]);

  const fetchAutomations = useCallback(async (segment) => {
    setIsLoading(true);
    try {
      const res = await appData.fetchAutomations({ accessToken, walletAddress: account, segment, actionType: 'push' });
      setAutomations(res || []);
    } catch (err) {
      setError(t('notifications.error_fetching_automations') || 'Error fetching automations');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError]);

  const createAutomation = useCallback(async (data) => {
    setIsLoading(true);
    try {
      const res = await appData.createAutomation({ accessToken, walletAddress: account, data });
      setAutomations(prev => [...prev, res]);
      setSuccess(t('notifications.automation_created') || 'Automation created');
      return res;
    } catch (err) {
      setError(t('notifications.error_creating_automation') || 'Error creating automation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const updateAutomation = useCallback(async (id, data) => {
    setIsLoading(true);
    try {
      const res = await appData.updateAutomation({ accessToken, walletAddress: account, id, data });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...res } : a));
      setSuccess(t('notifications.automation_updated') || 'Automation updated');
      return res;
    } catch (err) {
      setError(t('notifications.error_updating_automation') || 'Error updating automation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const deleteAutomation = useCallback(async (id) => {
    setIsLoading(true);
    try {
      await appData.deleteAutomation({ accessToken, walletAddress: account, id });
      setAutomations(prev => prev.filter(a => a.id !== id));
      setSuccess(t('notifications.automation_deleted') || 'Automation deleted');
    } catch (err) {
      setError(t('notifications.error_deleting_automation') || 'Error deleting automation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  return {
    notificationTypes,
    apiConfigs,
    usersWithTokens,
    audience,
    analyticsData,
    automations,
    triggers,
    isLoading,
    notificationPermission,
    loadTriggers,
    fetchNotificationTypes,
    fetchApiConfigs,
    fetchUsersWithTokens,
    fetchAudience,
    deleteAudienceMember,
    fetchAnalytics,
    createNotificationType,
    updateNotificationType,
    deleteNotificationType,
    createApiConfig,
    uploadServiceAccount,
    sendNotification,
    saveNotificationToken,
    fetchAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation
  };

};

export default useNotifications;