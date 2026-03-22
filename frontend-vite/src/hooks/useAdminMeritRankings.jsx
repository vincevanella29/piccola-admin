// src/hooks/useAdminMeritRankings.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api';

const defaultFilters = {
  periodo: null,        // null = mes actual
  sucursal: null,
  cargo: null,
  include_sales: true,
};

export default function useAdminMeritRankings(appState) {
  const token = appState?.token;

  // ── State ─────────────────────────────────────────────────────────────────
  const [competitions, setCompetitions]     = useState([]);   // lista de reglas
  const [summaryData, setSummaryData]       = useState(null); // respuesta resumen (sin leaderboards)
  const [activeBoard, setActiveBoard]       = useState(null); // leaderboard de la competencia activa
  const [filterOptions, setFilterOptions]   = useState({ periodos: [], locales: [], cargos: [] });
  const [filters, setFilters]              = useState(defaultFilters);

  const [loadingComps, setLoadingComps]     = useState(false);
  const [loadingBoard, setLoadingBoard]     = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError]                   = useState(null);

  // Modal de empleado individual
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const abortRef = useRef(null);
  const summaryAbortRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const authHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` },
  }), [token]);

  // ── Fetch competitions list (reglas) ──────────────────────────────────────
  const fetchCompetitions = useCallback(async (onlyActive = null) => {
    setLoadingComps(true);
    setError(null);
    try {
      const params = {};
      if (onlyActive !== null) params.only_active = onlyActive;
      const { data } = await axios.get(`${API_BASE}/admin/merits/competitions`, {
        params,
        ...authHeaders(),
      });
      setCompetitions(data.competitions || []);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error cargando competencias');
    } finally {
      setLoadingComps(false);
    }
  }, [authHeaders]);

  // ── Fetch filter options ──────────────────────────────────────────────────
  const fetchFilterOptions = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const { data } = await axios.get(`${API_BASE}/admin/merits/leaderboard/filters`, authHeaders());
      setFilterOptions({
        periodos: data.periodos || [],
        locales:  data.locales  || [],
        cargos:   data.cargos   || [],
      });
    } catch (err) {
      console.error('Filter options error:', err);
    } finally {
      setLoadingFilters(false);
    }
  }, [authHeaders]);

  // ── Fetch summary (all competitions, no leaderboard rows) ─────────────
  const fetchSummary = useCallback(async (overrideFilters = {}) => {
    if (summaryAbortRef.current) summaryAbortRef.current.abort();
    const ctrl = new AbortController();
    summaryAbortRef.current = ctrl;

    setLoadingSummary(true);
    setError(null);

    const active = { ...filters, ...overrideFilters };
    const params = {};
    if (active.periodo) params.periodo = active.periodo;
    // NO enviar rule_id → modo resumen
    params.include_sales = false; // No necesitamos KPIs en resumen

    try {
      const { data } = await axios.get(`${API_BASE}/admin/merits/leaderboard`, {
        params,
        signal: ctrl.signal,
        ...authHeaders(),
      });
      setSummaryData(data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err?.response?.data?.detail || err.message || 'Error cargando resumen');
    } finally {
      setLoadingSummary(false);
    }
  }, [filters, authHeaders]);

  // ── Fetch leaderboard for ONE competition ─────────────────────────────
  const fetchLeaderboard = useCallback(async (ruleId, overrideFilters = {}) => {
    if (!ruleId) {
      setActiveBoard(null);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingBoard(true);
    setError(null);

    const active = { ...filters, ...overrideFilters };
    const params = { rule_id: ruleId };
    if (active.periodo)   params.periodo  = active.periodo;
    if (active.sucursal && active.sucursal !== 'all') params.sucursal = active.sucursal;
    if (active.cargo    && active.cargo    !== 'all') params.cargo    = active.cargo;
    params.include_sales = active.include_sales;

    try {
      const { data } = await axios.get(`${API_BASE}/admin/merits/leaderboard`, {
        params,
        signal: ctrl.signal,
        ...authHeaders(),
      });
      // El backend retorna 1 competition en el array
      const comp = data.competitions?.[0] || null;
      setActiveBoard(comp);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err?.response?.data?.detail || err.message || 'Error cargando leaderboard');
    } finally {
      setLoadingBoard(false);
    }
  }, [filters, authHeaders]);

  // ── Filter change helpers ─────────────────────────────────────────────────
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchCompetitions(true);
    fetchFilterOptions();
    fetchSummary();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed data ─────────────────────────────────────────────────────────

  /** Summary list: metadata + counts for each competition (no leaderboard rows) */
  const summary = (summaryData?.competitions || []).map(c => ({
    ...c,
    total:     c.total_participants,
    fulfilled: c.fulfilled_count,
  }));

  return {
    // Data
    competitions,        // lista de reglas (para selector)
    summary,             // resumen por competencia (sin leaderboard)
    activeBoard,         // leaderboard de la competencia seleccionada
    filterOptions,       // { periodos, locales, cargos }
    currentPeriodo: summaryData?.periodo || null,
    restrictedToLocal: summaryData?.restricted_to_locals || null,

    // Filters
    filters,
    updateFilter,
    resetFilters,

    // Loading / Error
    loading: loadingBoard || loadingComps || loadingSummary,
    loadingBoard,
    loadingComps,
    loadingFilters,
    loadingSummary,
    error,

    // Employee detail modal
    selectedEmployee,
    setSelectedEmployee,

    // Actions
    fetchCompetitions,
    fetchSummary,
    fetchLeaderboard,
    fetchFilterOptions,
  };
}
