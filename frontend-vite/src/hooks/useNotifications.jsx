import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import appData from '../utils/appData.jsx';
import { getToken } from 'firebase/messaging';

const useNotifications = ({ accessToken, account, setError, setSuccess, appState }) => {
  const { t } = useTranslation();
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
  typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "default"
);
  const [usersWithTokens, setUsersWithTokens] = useState([]);

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
      setApiConfigs((prev) => [...prev, res]);
      setSuccess(t('notifications.api_config_created'));
      return res;
    } catch (err) {
      setError(t('notifications.error_creating_api_config'));
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
        const token = await getToken(appState.firebase.messaging, { vapidKey: 'TU_VAPID_KEY' });
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

  return {
    notificationTypes,
    apiConfigs,
    usersWithTokens,
    isLoading,
    notificationPermission,
    fetchNotificationTypes,
    fetchApiConfigs,
    fetchUsersWithTokens,
    createNotificationType,
    createApiConfig,
    sendNotification,
    saveNotificationToken
  };

};

export default useNotifications;