import React, { createContext, useContext, useState, useCallback } from 'react';

const GlobalStatusMessageContext = createContext();

export const useGlobalStatusMessage = () => useContext(GlobalStatusMessageContext);

export const GlobalStatusMessageProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  // id autoincrement
  const idRef = React.useRef(0);

  const addNotification = useCallback((notif) => {
    const id = notif.id || `${Date.now()}-${idRef.current++}`;
    setNotifications((prev) => [...prev, { ...notif, id }]);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Helper shortcuts
  const setSuccess = useCallback((message, txHash = '', blockExplorerUrl = '', autoHideDuration) => {
    addNotification({ type: 'success', message, txHash, blockExplorerUrl, autoHideDuration });
  }, [addNotification]);

  const setError = useCallback((message, txHash = '', blockExplorerUrl = '', autoHideDuration) => {
    addNotification({ type: 'error', message, txHash, blockExplorerUrl, autoHideDuration });
  }, [addNotification]);

  const setLoading = useCallback((message, autoHideDuration) => {
    addNotification({ type: 'loading', message, autoHideDuration });
  }, [addNotification]);

  const clearAll = useCallback(() => setNotifications([]), []);

  return (
    <GlobalStatusMessageContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        setSuccess,
        setError,
        setLoading,
        clearAll,
      }}
    >
      {children}
    </GlobalStatusMessageContext.Provider>
  );
};
