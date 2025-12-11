// src/hooks/useMiFicha.jsx

import { useState, useCallback } from 'react';
import miFichaApi from '../utils/miFicha.jsx';

export default function useMiFicha(appState, t) {
  const [ficha, setFicha] = useState(null);
  const [sueldos, setSueldos] = useState(null);
  const [asistenciaKpis, setAsistenciaKpis] = useState(null);
  const [meritos, setMeritos] = useState(null);
  const [ventasData, setVentasData] = useState({ total: null, kpisUltimos: null, porPeriodo: null });
  const [ventasDetalle, setVentasDetalle] = useState(null);
  
  const [loadingStates, setLoadingStates] = useState({
    ficha: false, sueldos: false, asistencia: false, meritos: false,
    ventasTotal: false, ventasKpisUltimos: false, ventasPorPeriodo: false,
    ventasDetalle: false, liquidacion: false,
  });

  const wallet = appState?.account;
  const token = appState?.token;
  const setError = appState?.setError;

  const inFlight = useState(() => new Map())[0];
  const responseCache = useState(() => new Map())[0];

  const createFetcher = useCallback((key, apiCall, setData, { hasData, makeKey } = {}) => {
    return async (params = {}) => {
      if (!wallet || !token) {
        setError(t?.('wallet.connect_wallet'));
        return null;
      }
      const force = params?.force === true;
      const localParams = { ...params };
      delete localParams.force;

      const cacheKey = (makeKey ? makeKey(localParams) : `${key}|${JSON.stringify(localParams || {})}`);

      if (!force && typeof hasData === 'function' && hasData() && responseCache.has(cacheKey)) {
        return responseCache.get(cacheKey) ?? null;
      }
      if (inFlight.has(cacheKey)) { return inFlight.get(cacheKey); }

      setLoadingStates(s => ({ ...s, [key]: true }));
      try {
        const promise = apiCall({ ...localParams, walletAddress: wallet, token })
          .then(resp => {
            if (setData) setData(resp);
            responseCache.set(cacheKey, resp);
            return resp;
          })
          .finally(() => { inFlight.delete(cacheKey); });
        inFlight.set(cacheKey, promise);
        const result = await promise;
        return result;
      } catch (err) {
        setError(t?.(`mificha.error_fetch`, { message: err.message }));
        throw err;
      } finally {
        setLoadingStates(s => ({ ...s, [key]: false }));
      }
    };
  }, [wallet, token, setError, t]);

  // --- Fetchers Individuales ---
  const fetchFicha = useCallback(createFetcher('ficha', miFichaApi.getMiFicha, setFicha, { hasData: () => !!ficha }), [createFetcher, ficha]);
  const fetchSueldos = useCallback(createFetcher('sueldos', miFichaApi.getSueldos, (data) => setSueldos(data.sueldos_por_periodo || []), { hasData: () => Array.isArray(sueldos) }), [createFetcher, sueldos]);
  const fetchAsistenciaKpis = useCallback(createFetcher('asistencia', miFichaApi.getAsistenciaKpis, (data) => setAsistenciaKpis(data.kpis || []), { hasData: () => Array.isArray(asistenciaKpis), makeKey: (p) => `asistencia|${JSON.stringify({ startPeriodo: p?.startPeriodo, endPeriodo: p?.endPeriodo })}` }), [createFetcher, asistenciaKpis]);
  const fetchMeritos = useCallback(createFetcher('meritos', miFichaApi.getMeritos, setMeritos, { hasData: () => !!meritos }), [createFetcher, meritos]);
  const fetchLiquidacionDetalle = useCallback(createFetcher('liquidacion', miFichaApi.getLiquidacionDetalle, undefined, { makeKey: (p) => `liquidacion|${p?.liquidationId || 'none'}` }), [createFetcher]);
  
  // --- Fetchers de Ventas Separados ---
  const fetchVentasTotal = useCallback(createFetcher('ventasTotal', miFichaApi.getVentasTotal, (data) => setVentasData(prev => ({...prev, total: data})), { hasData: () => !!ventasData.total }), [createFetcher, ventasData.total]);
  const fetchVentasKpisUltimos = useCallback(createFetcher('ventasKpisUltimos', miFichaApi.getVentasKpisUltimos, (data) => setVentasData(prev => ({...prev, kpisUltimos: data.kpis_ultimos_periodos})), { hasData: () => !!ventasData.kpisUltimos }), [createFetcher, ventasData.kpisUltimos]);
  const fetchVentasPorPeriodo = useCallback(createFetcher('ventasPorPeriodo', miFichaApi.getVentasPorPeriodo, (data) => setVentasData(prev => ({...prev, porPeriodo: data.ventas_por_periodo})), { hasData: () => !!ventasData.porPeriodo }), [createFetcher, ventasData.porPeriodo]);
  const fetchVentasDetalleProductos = useCallback(createFetcher('ventasDetalle', miFichaApi.getVentasDetalleProductos, setVentasDetalle, { makeKey: (p) => `ventasDetalle|${JSON.stringify({ periodo_start: p?.periodo_start, periodo_end: p?.periodo_end })}` }), [createFetcher]);

  return {
    loadingStates,
    ficha, sueldos, asistenciaKpis, meritos, ventasData, ventasDetalle,
    fetchFicha, fetchSueldos, fetchLiquidacionDetalle, fetchAsistenciaKpis, fetchMeritos,
    fetchVentasTotal, fetchVentasKpisUltimos, fetchVentasPorPeriodo, fetchVentasDetalleProductos
  };
}