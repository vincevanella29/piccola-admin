// src/hooks/useGamification.jsx
// Hook enfocado SOLO en Gamification (reglas, catálogos, preview)

import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  defineMeritRule as apiDefineMeritRule,
  listRuleTemplates as apiListRuleTemplates,
  defineRuleFromTemplate as apiDefineRuleFromTemplate,
  listMeritRules as apiListMeritRules,
  computeMeritPreview as apiComputeMeritPreview,
  listCatalogs as apiListCatalogs,
  listMeritResults as apiListMeritResults,
} from '../utils/gamification.jsx';

export function useGamification(appState, t) {
  const [isLoading, setIsLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [catalogs, setCatalogs] = useState({ cargos: [], secciones: [] });
  const [meritResults, setMeritResults] = useState([]);

  const { account: wallet, walletAddress, token } = appState || {};
  const effectiveWallet = wallet || walletAddress;

  const handleApiCall = useCallback(async (apiFunc, options = {}) => {
    const { successMsg, errorMsg, setLoading = true } = options;
    if (!effectiveWallet || !token) {
      toast.error(t?.('wallet.connect_wallet') || 'Por favor, conecta tu wallet.');
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
  }, [effectiveWallet, token, t]);

  // Reglas
  const defineRule = (rule) => handleApiCall(
    () => apiDefineMeritRule({ rule, walletAddress: effectiveWallet, token }),
    { successMsg: t?.('gamification.rule_saved_success') || 'Regla guardada con éxito.', errorMsg: 'gamification.error_define' }
  );

  const listRuleTemplates = useCallback(async () => {
    const res = await handleApiCall(() => apiListRuleTemplates({ walletAddress: effectiveWallet, token }), { setLoading: false });
    console.log('listRuleTemplates', res);
    return res?.templates || res;
  }, [handleApiCall, effectiveWallet, token]);

  const defineRuleFromTemplate = (payload) => handleApiCall(
    () => apiDefineRuleFromTemplate({ payload, walletAddress: effectiveWallet, token }),
    { successMsg: t?.('gamification.rule_saved_success') || 'Regla guardada con éxito.', errorMsg: 'gamification.error_define' }
  );

  const listMeritRules = async ({ onlyActive } = {}) => {
    if (!effectiveWallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
    const res = await apiListMeritRules({ onlyActive, walletAddress: effectiveWallet, token });
    console.log('listMeritRules', res);
    const items = res?.data?.rules || res?.rules || [];
    setRules(items);
    return res?.data || res;
  };

  const listRules = async (args = {}) => listMeritRules(args);

  // Preview
  const computePreview = ({ rut, ym } = {}) => handleApiCall(
    () => apiComputeMeritPreview({ rut, ym, walletAddress: effectiveWallet, token })
  );

  // Catálogos
  const listAllCatalogs = useCallback(async ({ q } = {}) => {
    const response = await handleApiCall(() => apiListCatalogs({ q, walletAddress: effectiveWallet, token }));
    const nextCatalogs = {
      cargos: Array.isArray(response?.cargos) ? response.cargos : [],
      secciones: Array.isArray(response?.secciones) ? response.secciones : [],
    };
    setCatalogs(nextCatalogs);
    return nextCatalogs;
  }, [handleApiCall, effectiveWallet, token]);

  // Resultados de mérito (listado/estado local)
  const listMeritResults = useCallback(async (filters = {}) => {
    const response = await handleApiCall(
      () => apiListMeritResults({ ...filters, walletAddress: effectiveWallet, token }),
      { setLoading: true }
    );
    console.log('listMeritResults', response);
    const items = response?.results || response?.data?.results || [];
    setMeritResults(Array.isArray(items) ? items : []);
    return response;
  }, [handleApiCall, effectiveWallet, token]);

  return {
    // Estado
    isLoading,
    rules,
    catalogs,
    meritResults,
    // Acciones
    defineRule,
    listRuleTemplates,
    defineRuleFromTemplate,
    listMeritRules,
    listRules,
    computePreview,
    listCatalogs: listAllCatalogs,
    listMeritResults,
  };
}

export default useGamification;
