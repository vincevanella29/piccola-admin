import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPublicMeritRankings,
  getPublicEmployeeMeritHistory,
  getPublicMeritFilters,
} from '../utils/meritRankings.jsx';

// Helpers ---------
function buildBySegmentFromMeritObject(meritObj) {
  const walletBy = meritObj?.walletBySegment || meritObj?.wallet_by || {};
  const pendingBy = meritObj?.pendingBySegment || meritObj?.pending_by || {};
  const symbols = new Set([...Object.keys(walletBy), ...Object.keys(pendingBy)]);
  const by = {};
  symbols.forEach((sym) => {
    by[sym] = {
      wallet: Number(walletBy[sym] || 0),
      pending: Number(pendingBy[sym] || 0),
    };
  });
  return by;
}

function buildBySegmentFromRow(row) {
  const list = Array.isArray(row?.merits_by_segment) ? row.merits_by_segment : [];
  if (!list.length) return null;
  const by = {};
  for (const seg of list) {
    const sym = seg?.symbol;
    if (!sym) continue;
    by[sym] = {
      wallet: Number(seg?.wallet ?? 0),
      pending: Number(seg?.pending ?? 0),
    };
  }
  return by;
}

function aggregateBySegmentFromHistory(history = []) {
  const by = {};
  let fulfilled = 0, notFulfilled = 0, minted = 0;

  for (const p of history) {
    for (const it of (p.items || [])) {
      const pts = Number(it.merit_points || 0);
      const sym = it?.segment?.symbol || 'UNK';
      const status = it?.status;
      const mintedFlag = it?.mint_status === 'minted';

      if (!by[sym]) by[sym] = { wallet: 0, pending: 0 };
      if (mintedFlag) {
        by[sym].wallet += pts;
        minted++;
        fulfilled++; // minted implica fulfilled
      } else if (status === 'fulfilled') {
        by[sym].pending += pts;
        fulfilled++;
      } else {
        notFulfilled++;
      }
    }
  }
  const totalPoints = Object.values(by).reduce((acc, x) => acc + (x.wallet || 0) + (x.pending || 0), 0);
  return { by, totals: { total_points: totalPoints, fulfilled_count: fulfilled, not_fulfilled_count: notFulfilled, minted_count: minted } };
}

export default function useMeritRankings(appState, { defaultMonths = 3 } = {}) {
  const { t } = useTranslation();

  // Ranking
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros (incluye rank_mode opcional)
  const [filters, setFilters] = useState({
    sucursal: null,
    cargo: null,
    seccion: null,
    months: defaultMonths,
    rank_mode: 'simulated', // 'wallet' | 'simulated'
  });

  // Paginación (cliente)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 1000,
    totalItems: 0,
  });

  // Historial (modal)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyData, setHistoryData] = useState(null);      // payload final (del backend + agregados)
  const [historyPreview, setHistoryPreview] = useState(null); // datos mínimos para skeleton

  const wallet = appState?.account;
  const token = appState?.token;

  // Opciones rápidas de filtros (desde backend)
  const [clientFilterOptions, setClientFilterOptions] = useState({ locales: ['all'], cargos: ['all'], secciones: ['all'] });
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [filtersError, setFiltersError] = useState(null);

  // Module-scoped memoization (per hook instance)
  const lastRankingKeyRef = useRef(null);
  const inflightRankingRef = useRef(null);

  const buildRankingKey = (f) =>
    JSON.stringify({
      months: Number(f.months) || defaultMonths,
      sucursal: f.sucursal || null,
      cargo: f.cargo || null,
      seccion: f.seccion || null,
      rank_mode: f.rank_mode || undefined,
      skip: 0,
      limit: 100000,
    });

  // ============ Ranking ============
  const fetchRankings = useCallback(async (currentFilters) => {
    if (!wallet || !token) {
      setError(t('wallet.connect_wallet', 'Conecta tu wallet'));
      setData([]);
      return;
    }
    const key = buildRankingKey(currentFilters);
    if (inflightRankingRef.current && lastRankingKeyRef.current === key) {
      return inflightRankingRef.current; // dedupe
    }
    lastRankingKeyRef.current = key;
    setLoading(true);
    setError(null);
    try {
      inflightRankingRef.current = getPublicMeritRankings(appState, {
        months: Number(currentFilters.months) || defaultMonths,
        sucursal: currentFilters.sucursal,
        cargo: currentFilters.cargo,
        seccion: currentFilters.seccion,
        rank_mode: currentFilters.rank_mode,
        skip: 0,
        limit: 100000,
      });
      const response = await inflightRankingRef.current;
      const rows = response?.ranking || [];
      setData(rows);
      setPagination((prev) => ({
        ...prev,
        totalItems: typeof response?.total_count === 'number' ? response.total_count : rows.length,
      }));
    } catch (err) {
      console.error('Error fetching public merit rankings:', err);
      setError(err?.message || t('errors.fetch_rankings', 'Error al obtener los rankings.'));
      setData([]);
    } finally {
      inflightRankingRef.current = null;
      setLoading(false);
    }
  }, [appState, wallet, token, t, defaultMonths]);

  const handleFilterChange = (newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }));

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchRankings(filters);
  };

  const goToPage = (pageNumber) => {
    setPagination((prev) => ({ ...prev, currentPage: pageNumber }));
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar opciones de filtros desde backend con cache (memoria + localStorage)
  const inflightFiltersRef = useRef(null);
  useEffect(() => {
    let mounted = true;
    if (!wallet || !token) return;

    const LS_KEY = 'publicMeritFilters:v1';
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

    const fromLS = (() => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.savedAt || !parsed.data) return null;
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
        return parsed.data;
      } catch {
        return null;
      }
    })();

    if (fromLS) {
      setClientFilterOptions(fromLS);
      return () => { mounted = false; };
    }

    if (inflightFiltersRef.current) {
      // dedupe concurrent/strict-mode double mount
      inflightFiltersRef.current.then((res) => {
        if (!mounted) return;
        if (res) setClientFilterOptions(res);
      }).catch((e) => {
        if (!mounted) return;
        setFiltersError(e?.message || 'Error filtros');
      });
      return () => { mounted = false; };
    }

    setFiltersLoading(true);
    setFiltersError(null);
    inflightFiltersRef.current = getPublicMeritFilters(appState);
    inflightFiltersRef.current
      .then((res) => {
        if (!mounted) return;
        if (res) {
          setClientFilterOptions(res);
          try {
            localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: Date.now(), data: res }));
          } catch {}
        }
      })
      .catch((e) => { if (mounted) setFiltersError(e?.message || 'Error filtros'); })
      .finally(() => {
        if (mounted) setFiltersLoading(false);
        inflightFiltersRef.current = null;
      });
    return () => { mounted = false; };
  }, [appState, wallet, token]);

  // ============ Historial (con preview) ============
  const showHistoryFor = useCallback(async (target) => {
    // normalizar input
    const isObj = typeof target === 'object' && target !== null;
    const e = isObj ? target : { rut: String(target) };

    // ---- PREVIEW: datos mínimos desde la fila (evita parpadeo)
    const preEmployee = {
      rut: e.rut,
      nombre: e.nombre,
      apellido: e.apellido,
      cargo: e.cargo,
      local: e.local,
      profile_image_url: e.profile_image_url,
      profile_image_hash: e.profile_image_hash,
      wallet: e.wallet || e?.merit_profile?.wallet || null,
    };

    // Preferir nuevos campos del backend para el preview
    const byFromNew = buildBySegmentFromRow(e);
    const byFromRow = byFromNew || buildBySegmentFromMeritObject(e.__merit);
    const totalsFromNew = e?.merits_summary || null;
    const previewTotals = totalsFromNew ? {
      total_points: Number(totalsFromNew.total_simulated ?? 0),
      fulfilled_count: null,
      not_fulfilled_count: null,
      minted_count: null,
    } : {
      total_points: Object.values(byFromRow).reduce((acc, v) => acc + (v.wallet || 0) + (v.pending || 0), 0),
      fulfilled_count: null,
      not_fulfilled_count: null,
      minted_count: null,
    };

    const previewPayload = {
      employee: preEmployee,
      wallet: preEmployee.wallet,
      merit_profile: e?.merit_profile || null,
      by_segment: byFromRow,
      totals: previewTotals,
      history: [], // aún no cargado
    };

    setHistoryPreview(previewPayload);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryData(null);

    try {
      const res = await getPublicEmployeeMeritHistory(appState, {
        rut: e.rut, wallet: preEmployee.wallet, include_profile: true,
      });

      // Si el backend no incluyó by_segment/totals, los construimos
      let finalPayload = { ...res };
      if (!finalPayload.by_segment) {
        const agg = aggregateBySegmentFromHistory(res?.history || []);
        finalPayload = {
          ...finalPayload,
          by_segment: agg.by,
          totals: {
            ...(finalPayload.totals || {}),
            ...agg.totals,
          },
        };
      }
      // Asegurar employee mínimo aunque backend no lo mande
      if (!finalPayload.employee) {
        finalPayload.employee = preEmployee;
      }

      setHistoryData(finalPayload);
    } catch (e2) {
      console.error('Error fetching merit history:', e2);
      setHistoryError(e2?.message || 'Error al cargar historial');
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [appState]);

  const closeHistory = () => {
    setHistoryOpen(false);
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryData(null);
    setHistoryPreview(null);
  };

  return {
    // ranking
    data,
    loading,
    error,

    // filtros + paginación
    filters,
    pagination,
    handleFilterChange,
    applyFilters,
    goToPage,

    // opciones de filtros (para toolbar)
    clientFilterOptions,
    filtersLoading,
    filtersError,

    // historial (modal)
    historyOpen,
    historyLoading,
    historyError,
    historyData,
    historyPreview,
    showHistoryFor,
    closeHistory,
  };
}
