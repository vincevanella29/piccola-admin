// hooks/useDeliveryCarriers.jsx
// Hook for carrier (última milla) management — independent from orders
// Used by: pages/delivery/DeliveryCarriers.jsx
import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import * as deliveryApi from '../utils/deliveryData.jsx';

const useDeliveryCarriers = (appState, t) => {
  const [carriers, setCarriers] = useState([]);
  const [carrierPresets, setCarrierPresets] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  const fetchCarriers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.fetchCarriers({ ...getAuth() });
      setCarriers(res.carriers || []);
      return res.carriers;
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuth]);

  const fetchCarrierPresets = useCallback(async () => {
    try {
      const res = await deliveryApi.fetchCarrierPresets({ ...getAuth() });
      setCarrierPresets(res.presets || {});
      return res.presets;
    } catch (err) {
      console.error('[useDeliveryCarriers] Presets error:', err);
      return {};
    }
  }, [getAuth]);

  const createCarrier = useCallback(async (data) => {
    try {
      const res = await deliveryApi.createCarrier({ ...getAuth(), data });
      toast.success(t?.('delivery.carrier_created') || 'Carrier creado');
      await fetchCarriers();
      return res;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  }, [getAuth, fetchCarriers, t]);

  const updateCarrier = useCallback(async (carrierId, data) => {
    try {
      await deliveryApi.updateCarrier({ ...getAuth(), carrierId, data });
      toast.success(t?.('delivery.carrier_updated') || 'Carrier actualizado');
      await fetchCarriers();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchCarriers, t]);

  const deleteCarrier = useCallback(async (carrierId) => {
    try {
      await deliveryApi.deleteCarrier({ ...getAuth(), carrierId });
      toast.success(t?.('delivery.carrier_disabled') || 'Carrier desactivado');
      await fetchCarriers();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }, [getAuth, fetchCarriers, t]);

  const testConnection = useCallback(async ({ carrierId, auth }) => {
    try {
      const res = await deliveryApi.testCarrierConnection({ ...getAuth(), carrierId, auth });
      if (res.success) {
        toast.success(res.message || 'Conexión exitosa');
      } else {
        toast.error(res.error || 'Conexión fallida');
      }
      return res;
    } catch (err) {
      toast.error(err.message);
      return { success: false, error: err.message };
    }
  }, [getAuth]);

  return {
    carriers, carrierPresets, isLoading, error,
    fetchCarriers, fetchCarrierPresets,
    createCarrier, updateCarrier, deleteCarrier, testConnection,
  };
};

export default useDeliveryCarriers;
