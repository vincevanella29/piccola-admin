// src/hooks/useGamification.jsx
// Hook enfocado SOLO en Gamification (reglas, catálogos, preview)

import { useState, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  defineMeritRule as apiDefineMeritRule,
  listRuleTemplates as apiListRuleTemplates,
  defineRuleFromTemplate as apiDefineRuleFromTemplate,
  updateRuleFromTemplate as apiUpdateRuleFromTemplate,
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
  const CACHE_TTL_MS = 30000; // 30s cache window to reduce duplicate fetches when switching tabs
  const cacheRef = useRef({
    rules: { ts: 0, data: null, lastArgsKey: 'default' },
    templates: { ts: 0, data: null },
    catalogs: { ts: 0, data: null, lastQ: undefined },
    results: { tsByKey: {} }, // key -> { ts, data }
  });
  const now = () => Date.now();
  const isFresh = (ts) => ts && (now() - ts) < CACHE_TTL_MS;

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

  const listRuleTemplates = useCallback(async ({ forceRefresh = false } = {}) => {
    const cache = cacheRef.current.templates;
    if (!forceRefresh && isFresh(cache.ts) && Array.isArray(cache.data)) {
      return cache.data;
    }
    const res = await handleApiCall(() => apiListRuleTemplates({ walletAddress: effectiveWallet, token }), { setLoading: false });
    const data = res?.templates || res || [];
    cacheRef.current.templates = { ts: now(), data };
    return data;
  }, [handleApiCall, effectiveWallet, token]);

  const defineRuleFromTemplate = (payload) => handleApiCall(
    () => apiDefineRuleFromTemplate({ payload, walletAddress: effectiveWallet, token }),
    { successMsg: t?.('gamification.rule_saved_success') || 'Regla guardada con éxito.', errorMsg: 'gamification.error_define' }
  );

  // Update (misma forma que create, pero con identifier)
  const updateRuleFromTemplate = (payload) => handleApiCall(
    () => apiUpdateRuleFromTemplate({ payload, walletAddress: effectiveWallet, token }),
    { successMsg: t?.('gamification.rule_updated_success') || 'Regla actualizada con éxito.', errorMsg: 'gamification.error_define' }
  );

  const listMeritRules = async ({ onlyActive, forceRefresh = false } = {}) => {
    if (!effectiveWallet || !token) throw new Error(t?.('wallet.connect_wallet') || 'Conecta tu wallet');
    const argsKey = String(!!onlyActive);
    const cache = cacheRef.current.rules;
    if (!forceRefresh && cache.data && cache.lastArgsKey === argsKey && isFresh(cache.ts)) {
      if (!rules?.length) setRules(cache.data);
      return { rules: cache.data };
    }
    const res = await apiListMeritRules({ onlyActive, walletAddress: effectiveWallet, token });
    const items = res?.data?.rules || res?.rules || [];
    setRules(items);
    cacheRef.current.rules = { ts: now(), data: items, lastArgsKey: argsKey };
    return res?.data || res;
  };

  const listRules = async (args = {}) => listMeritRules(args);

  // Preview
  const computePreview = ({ rut, ym } = {}) => handleApiCall(
    () => apiComputeMeritPreview({ rut, ym, walletAddress: effectiveWallet, token })
  );

  // Catálogos
  const listAllCatalogs = useCallback(async ({ q, forceRefresh = false } = {}) => {
    const cache = cacheRef.current.catalogs;
    const sameQuery = cache.lastQ === q;
    if (!forceRefresh && sameQuery && cache.data && isFresh(cache.ts)) {
      if (!catalogs?.cargos?.length && !catalogs?.secciones?.length) setCatalogs(cache.data);
      return cache.data;
    }
    const response = await handleApiCall(() => apiListCatalogs({ q, walletAddress: effectiveWallet, token }));
    const nextCatalogs = {
      cargos: Array.isArray(response?.cargos) ? response.cargos : [],
      secciones: Array.isArray(response?.secciones) ? response.secciones : [],
    };
    setCatalogs(nextCatalogs);
    cacheRef.current.catalogs = { ts: now(), data: nextCatalogs, lastQ: q };
    return nextCatalogs;
  }, [handleApiCall, effectiveWallet, token, catalogs]);

  // Resultados de mérito (listado/estado local)
  const listMeritResults = useCallback(async (filters = {}) => {
    const { forceRefresh = false, ...rest } = filters || {};
    const key = JSON.stringify(rest || {});
    const entry = cacheRef.current.results.tsByKey[key];
    if (!forceRefresh && entry && isFresh(entry.ts)) {
      if (!meritResults?.length) setMeritResults(Array.isArray(entry.data) ? entry.data : []);
      return { results: entry.data };
    }
    const response = await handleApiCall(
      () => apiListMeritResults({ ...rest, walletAddress: effectiveWallet, token }),
      { setLoading: true }
    );
    const items = response?.results || response?.data?.results || [];
    const arr = Array.isArray(items) ? items : [];
    setMeritResults(arr);
    cacheRef.current.results.tsByKey[key] = { ts: now(), data: arr };
    return response;
  }, [handleApiCall, effectiveWallet, token, meritResults]);

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
    updateRuleFromTemplate,
  };
}

export default useGamification;
