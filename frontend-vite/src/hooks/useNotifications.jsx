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
  
  // Robust state that checks both browser permission and an opt-out flag
  const [isPushEnabled, setIsPushEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const perm = window.Notification?.permission;
    const optOut = localStorage.getItem('push_opt_out');
    return perm === "granted" && optOut !== "true";
  });

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

  const deleteAudienceMember = useCallback(async (token, signature, message) => {
    setIsLoading(true);
    try {
      await appData.deleteAudience({ accessToken, walletAddress: account, token, signature, message });
      setAudience(prev => prev.filter(m => m.token !== token));
      setSuccess(t('notifications.audience_deleted') || 'Audience member deleted');
    } catch (err) {
      setError(t('notifications.error_deleting_audience') || 'Error deleting audience member');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess]);

  const deleteAllAudienceMembers = useCallback(async (signature, message) => {
    setIsLoading(true);
    try {
      await appData.deleteAllAudience({ accessToken, walletAddress: account, signature, message });
      setAudience([]);
      setSuccess('Base de datos de audiencia reiniciada exitosamente');
    } catch (err) {
      setError('Error al reiniciar base de datos de audiencia');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, setError, setSuccess]);

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
    console.log('[Push Diagnostics] Iniciando saveNotificationToken...');
    setIsLoading(true);
    try {
      if (!isWebPushSupported()) {
        console.error('[Push Diagnostics] isWebPushSupported es falso.');
        setError(t('notifications.unsupported_browser') || 'Navegador no soportado');
        return;
      }
      console.log('[Push Diagnostics] Solicitando permiso al navegador...');
      const permission = await window.Notification.requestPermission();
      console.log(`[Push Diagnostics] Permiso resultante: ${permission}`);
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const vKey = appState.vapidKey
          || appState.providers?.firebase?.public_config?.vapidKey
          || (Array.isArray(apiConfigs) && apiConfigs[0]?.vapid_key)
          || null;
        console.log(`[Push Diagnostics] VAPID Key encontrada: ${vKey ? 'SÍ (truncada: ' + vKey.substring(0,5) + '...)' : 'NO'}`);
        if (!vKey) {
          console.log('[Push Diagnostics] Intentando hacer fetch de apiConfigs...');
          try {
            const configs = await appData.fetchApiConfigs({ accessToken, walletAddress: account });
            const fetchedKey = (configs || [])[0]?.vapid_key;
            console.log(`[Push Diagnostics] Fetched VAPID Key: ${fetchedKey ? 'SÍ' : 'NO'}`);
            if (fetchedKey) {
              setApiConfigs(configs);
              try { await deleteToken(appState.firebase.messaging); } catch(e) {}
              console.log('[Push Diagnostics] Solicitando token a Firebase con fetchedKey...');
              const token = await getToken(appState.firebase.messaging, { vapidKey: fetchedKey });
              console.log(`[Push Diagnostics] Firebase retornó token: ${token ? 'SÍ' : 'NO'}`);
              const res = await appData.saveNotificationToken({
                accessToken, walletAddress: account,
                data: { token, device_type: 'web', permissions_granted: true }
              });
              localStorage.removeItem('push_opt_out');
              setIsPushEnabled(true);
              setSuccess(t('notifications.token_saved') || 'Notificaciones activadas exitosamente');
              console.log('[Push Diagnostics] Token guardado en BD con éxito vía fetch.');
              return res;
            }
          } catch (fetchErr) {
            console.error('[Push Diagnostics] Error al hacer fetch de apiConfigs:', fetchErr);
          }
          console.warn('[Push Diagnostics] Terminando prematuro: VAPID Key no configurada en el servidor.');
          setError('VAPID Key no configurada. Ve a Settings → Paso 2 y agrega la VAPID Key.');
          return;
        }
        try { await deleteToken(appState.firebase.messaging); } catch(e) {}
        console.log('[Push Diagnostics] Solicitando token a Firebase con vKey local...');
        const token = await getToken(appState.firebase.messaging, { vapidKey: vKey });
        console.log(`[Push Diagnostics] Firebase retornó token: ${token ? 'SÍ' : 'NO'}`);
        const res = await appData.saveNotificationToken({
          accessToken,
          walletAddress: account,
          data: {
            token,
            device_type: 'web',
            permissions_granted: true
          }
        });
        localStorage.removeItem('push_opt_out');
        setIsPushEnabled(true);
        setSuccess(t('notifications.token_saved') || 'Notificaciones activadas exitosamente');
        console.log('[Push Diagnostics] Token guardado en BD con éxito vía local VAPID.');
        return res;
      } else {
        console.warn('[Push Diagnostics] Permiso denegado.');
        setError(t('notifications.permission_denied') || 'Permiso denegado por el navegador');
        localStorage.setItem('push_opt_out', 'true');
        setIsPushEnabled(false);
      }
    } catch (err) {
      console.error('[Push Diagnostics] ERROR inesperado guardando token:', err);
      setError(err?.message || 'Error guardando token');
      throw err;
    } finally {
      console.log('[Push Diagnostics] Terminando ejecución de saveNotificationToken.');
      setIsLoading(false);
    }
  }, [accessToken, account, t, setError, setSuccess, appState.firebase.messaging, appState.vapidKey, appState.providers, apiConfigs]);

  const disableNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      localStorage.setItem('push_opt_out', 'true');
      setIsPushEnabled(false);
      try {
        const token = await getToken(appState.firebase.messaging);
        if (token) {
           await appData.deleteAudience({ accessToken, walletAddress: account, token });
           await deleteToken(appState.firebase.messaging);
        }
      } catch (e) {}
      setSuccess("Notificaciones desactivadas para este dispositivo.");
    } catch(err) {
      setError("Error al desactivar notificaciones.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, account, appState.firebase.messaging, setError, setSuccess]);

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
    isPushEnabled,
    disableNotifications,
    loadTriggers,
    fetchNotificationTypes,
    fetchApiConfigs,
    fetchUsersWithTokens,
    fetchAudience,
    deleteAudienceMember,
    deleteAllAudienceMembers,
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