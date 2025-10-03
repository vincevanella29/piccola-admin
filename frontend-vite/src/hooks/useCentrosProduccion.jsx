// src/hooks/useCentrosProduccion.jsx
// Hook para Centros de Producción: meta (centros/cargos/secciones) + configuración (cargos/secciones por centro)

import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  listProductionCentersMeta as apiListMeta,
  listProductionCenterConfigs as apiListConfigs,
  getProductionCenterConfig as apiGetConfig,
  upsertProductionCenterConfig as apiUpsertConfig,
  addToProductionCenterConfig as apiAddToConfig,
  removeFromProductionCenterConfig as apiRemoveFromConfig,
  deleteProductionCenterConfig as apiDeleteConfig,
} from '../utils/centros_produccion.jsx';

export function useCentrosProduccion(appState, t) {
  const [isLoading, setIsLoading] = useState(false);

  // Meta
  const [centros, setCentros] = useState([]);     // [{ _id, nombre, slug, activo, ... }]
  const [cargos, setCargos] = useState([]);       // ["Garzon", "Barman", ...]
  const [secciones, setSecciones] = useState([]); // ["bar", "cocina", ...]

  // Configs
  const [configs, setConfigs] = useState([]);     // lista de todas las configuraciones
  const [currentConfig, setCurrentConfig] = useState(null); // config del centro enfocado

  const { account: wallet, walletAddress, token } = appState || {};
  const effectiveWallet = wallet || walletAddress;

  const handleApiCall = useCallback(
    async (apiFunc, { successMsg, errorMsg, setLoading = true } = {}) => {
      if (!effectiveWallet || !token) {
        const msg = t?.('wallet.connect_wallet') || 'Por favor, conecta tu wallet.';
        toast.error(msg);
        throw new Error('Wallet not connected');
      }
      if (setLoading) setIsLoading(true);
      try {
        const res = await apiFunc();
        if (successMsg) toast.success(successMsg);
        return res?.data || res;
      } catch (err) {
        const msg = err?.message || 'Error';
        toast.error(errorMsg ? (t?.(errorMsg, { message: msg }) || msg) : msg);
        throw err;
      } finally {
        if (setLoading) setIsLoading(false);
      }
    },
    [effectiveWallet, token, t]
  );

  // ---------------- Meta ----------------
  const fetchMeta = useCallback(async () => {
    const res = await handleApiCall(
      () => apiListMeta({ walletAddress: effectiveWallet, token }),
      { setLoading: false }
    );
    const metaCentros = Array.isArray(res?.centros) ? res.centros : [];
    const metaCargos = Array.isArray(res?.cargos) ? res.cargos : [];
    const metaSecciones = Array.isArray(res?.secciones) ? res.secciones : [];
    setCentros(metaCentros);
    setCargos(metaCargos);
    setSecciones(metaSecciones);
    return { centros: metaCentros, cargos: metaCargos, secciones: metaSecciones };
  }, [handleApiCall, effectiveWallet, token]);

  // ---------------- Configs (lista global) ----------------
  const fetchConfigs = useCallback(async () => {
    const res = await handleApiCall(
      () => apiListConfigs({ walletAddress: effectiveWallet, token }),
      { setLoading: true }
    );
    const items = Array.isArray(res?.items) ? res.items : Array.isArray(res?.configs) ? res.configs : [];
    setConfigs(items);
    return items;
  }, [handleApiCall, effectiveWallet, token]);

  // ---------------- Config de un centro ----------------
  const fetchConfig = useCallback(
    async (idOrSlug) => {
      if (!idOrSlug) throw new Error('idOrSlug es obligatorio');
      const res = await handleApiCall(
        () => apiGetConfig({ idOrSlug, walletAddress: effectiveWallet, token }),
        { setLoading: true }
      );
      const cfg = res?.config || res;
      setCurrentConfig(cfg || null);
      return cfg;
    },
    [handleApiCall, effectiveWallet, token]
  );

  // ---------------- Upsert (reemplaza listas) ----------------
  const saveConfig = useCallback(
    async ({ idOrSlug, cargoIds, secciones, active = true, notes } = {}) => {
      const res = await handleApiCall(
        () =>
          apiUpsertConfig({
            idOrSlug,
            cargoIds,
            secciones,
            active,
            notes,
            walletAddress: effectiveWallet,
            token,
          }),
        {
          successMsg: t?.('centros.config_saved_success') || 'Configuración guardada con éxito.',
          errorMsg: 'centros.error_save_config',
          setLoading: true,
        }
      );
      // refrescar estados locales
      await fetchConfigs();
      if (idOrSlug) await fetchConfig(idOrSlug);
      return res;
    },
    [handleApiCall, effectiveWallet, token, fetchConfigs, fetchConfig, t]
  );

  // ---------------- Add (merge incremental) ----------------
  const addToConfig = useCallback(
    async ({ idOrSlug, cargoIds, secciones, active, notes } = {}) => {
      const res = await handleApiCall(
        () =>
          apiAddToConfig({
            idOrSlug,
            cargoIds,
            secciones,
            active,
            notes,
            walletAddress: effectiveWallet,
            token,
          }),
        {
          successMsg: t?.('centros.config_updated_success') || 'Configuración actualizada.',
          errorMsg: 'centros.error_update_config',
          setLoading: true,
        }
      );
      await fetchConfigs();
      if (idOrSlug) await fetchConfig(idOrSlug);
      return res;
    },
    [handleApiCall, effectiveWallet, token, fetchConfigs, fetchConfig, t]
  );

  // ---------------- Remove (merge incremental) ----------------
  const removeFromConfig = useCallback(
    async ({ idOrSlug, cargoIds, secciones, active, notes } = {}) => {
      const res = await handleApiCall(
        () =>
          apiRemoveFromConfig({
            idOrSlug,
            cargoIds,
            secciones,
            active,
            notes,
            walletAddress: effectiveWallet,
            token,
          }),
        {
          successMsg: t?.('centros.config_updated_success') || 'Configuración actualizada.',
          errorMsg: 'centros.error_update_config',
          setLoading: true,
        }
      );
      await fetchConfigs();
      if (idOrSlug) await fetchConfig(idOrSlug);
      return res;
    },
    [handleApiCall, effectiveWallet, token, fetchConfigs, fetchConfig, t]
  );

  // ---------------- Delete ----------------
  const deleteConfig = useCallback(
    async (idOrSlug) => {
      const res = await handleApiCall(
        () => apiDeleteConfig({ idOrSlug, walletAddress: effectiveWallet, token }),
        {
          successMsg: t?.('centros.config_deleted_success') || 'Configuración eliminada.',
          errorMsg: 'centros.error_delete_config',
          setLoading: true,
        }
      );
      await fetchConfigs();
      if (currentConfig && (currentConfig?.centro?._id === idOrSlug || currentConfig?.centro?.slug === idOrSlug)) {
        setCurrentConfig(null);
      }
      return res;
    },
    [handleApiCall, effectiveWallet, token, fetchConfigs, currentConfig, t]
  );

  return {
    // Estado
    isLoading,
    centros,
    cargos,
    secciones,
    configs,
    currentConfig,

    // Acciones Meta
    fetchMeta,

    // Acciones Config
    fetchConfigs,
    fetchConfig,
    saveConfig,
    addToConfig,
    removeFromConfig,
    deleteConfig,
  };
}

export default useCentrosProduccion;
