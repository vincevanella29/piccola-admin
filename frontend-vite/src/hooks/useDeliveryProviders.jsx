// hooks/useDeliveryProviders.jsx
// Hook for order provider management — independent from orders
// Used by: pages/delivery/DeliveryProviders.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../utils/deliveryData.jsx';

const useDeliveryProviders = (appState, t) => {
  const [providers, setProviders] = useState([]);
  const [providerPresets, setProviderPresets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.fetchProviders({ ...getAuth() });
      setProviders(res.providers || []);
      return res.providers;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuth]);

  const fetchProviderPresets = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchProviderPresets({ ...getAuth() });
      setProviderPresets(res.presets || {});
      return res.presets;
    } catch (err) {
      console.error('[useDeliveryProviders] Presets error:', err);
      return {};
    }
  }, [getAuth]);

  const createProvider = useCallback(async (data) => {
    try {
      const res = await deliveryApi.createProvider({ ...getAuth(), data });
      toast.success(t?.('delivery.provider_created') || 'Proveedor creado');
      await fetchProviders();
      return res;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchProviders, t]);

  const autoLinkProvider = useCallback(async (data) => {
    try {
      const res = await deliveryApi.autoLinkProvider({ ...getAuth(), data });
      toast.success(t?.('delivery.provider_linked') || 'Proveedor vinculado con Dilithium 🔒');
      await fetchProviders();
      return res; // Contains { mnemonic, api_key, provider_id, slug }
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchProviders, t]);

  const updateProvider = useCallback(async (providerId, data) => {
    try {
      await deliveryApi.updateProvider({ ...getAuth(), providerId, data });
      toast.success(t?.('delivery.provider_updated') || 'Proveedor actualizado');
      await fetchProviders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchProviders, t]);

  const deleteProvider = useCallback(async (providerId) => {
    try {
      await deliveryApi.deleteProvider({ ...getAuth(), providerId });
      toast.success(t?.('delivery.provider_disabled') || 'Proveedor desactivado');
      await fetchProviders();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchProviders, t]);

  return {
    providers, providerPresets, isLoading, error,
    fetchProviders, fetchProviderPresets,
    createProvider, autoLinkProvider, updateProvider, deleteProvider,
  };
};

export default useDeliveryProviders;
