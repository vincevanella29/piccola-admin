// src/hooks/useAdminMeritRankings.jsx
import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE = '/api';

const defaultFilters = {
  rule_id: null,        // null = todas las activas
  periodo: null,        // null = mes actual
  sucursal: null,
  cargo: null,
  include_sales: true,
};

export default function useAdminMeritRankings(appState) {
  const token = appState?.token;

  // ── State ─────────────────────────────────────────────────────────────────
  const [competitions, setCompetitions]     = useState([]);  // lista de reglas
  const [leaderboard, setLeaderboard]       = useState(null); // respuesta completa
  const [filterOptions, setFilterOptions]   = useState({ periodos: [], locales: [], cargos: [] });
  const [filters, setFilters]               = useState(defaultFilters);

  const [loadingComps, setLoadingComps]     = useState(false);
  const [loadingBoard, setLoadingBoard]     = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [error, setError]                   = useState(null);

  // Modal de empleado individual
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const abortRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const authHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` },
  }), [token]);

  // ── Fetch competitions list ───────────────────────────────────────────────
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

  // ── Fetch leaderboard ────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async (overrideFilters = {}) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingBoard(true);
    setError(null);

    const active = { ...filters, ...overrideFilters };

    const params = {};
    if (active.rule_id)  params.rule_id  = active.rule_id;
    if (active.periodo)  params.periodo  = active.periodo;
    if (active.sucursal && active.sucursal !== 'all') params.sucursal = active.sucursal;
    if (active.cargo    && active.cargo    !== 'all') params.cargo    = active.cargo;
    params.include_sales = active.include_sales;

    try {
      const { data } = await axios.get(`${API_BASE}/admin/merits/leaderboard`, {
        params,
        signal: ctrl.signal,
        ...authHeaders(),
      });
      setLeaderboard(data);
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

  const applyFilters = useCallback((overrides = {}) => {
    fetchLeaderboard(overrides);
  }, [fetchLeaderboard]);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    fetchLeaderboard(defaultFilters);
  }, [fetchLeaderboard]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchCompetitions(true); // solo activas inicialmente
    fetchFilterOptions();
    fetchLeaderboard();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed data ─────────────────────────────────────────────────────────

  /**
   * Devuelve la lista de competencias del leaderboard actual.
   * Cada competencia tiene { rule_id, rule_name, leaderboard, total_participants, ... }
   */
  const competitionBoards = leaderboard?.competitions || [];

  /**
   * Resumen: pasa TODOS los campos de la competencia al frontend.
   * Crítico: period_mode, is_active, include_cargos, template_category, etc.
   * Son necesarios para los filtros de año / cargo / sección.
   */
  const summary = competitionBoards.map(c => ({
    // Spread completo — ningún campo se pierde
    ...c,
    // Aliases de compat para los componentes que usan nombres alternativos
    total:            c.total_participants,
    fulfilled:        c.fulfilled_count,
  }));

  return {
    // Data
    competitions,        // lista de reglas (para selector)
    leaderboard,         // respuesta raw completa
    competitionBoards,   // lista procesada de competencias con leaderboard
    summary,             // resumen por competencia
    filterOptions,       // { periodos, locales, cargos }
    currentPeriodo: leaderboard?.periodo || null,
    userLevel: leaderboard?.level || null,
    restrictedToLocal: leaderboard?.restricted_to_local || null,

    // Filters
    filters,
    updateFilter,
    applyFilters,
    resetFilters,

    // Loading / Error
    loading: loadingBoard || loadingComps,
    loadingBoard,
    loadingComps,
    loadingFilters,
    error,

    // Employee detail modal
    selectedEmployee,
    setSelectedEmployee,

    // Actions
    fetchCompetitions,
    fetchLeaderboard,
    fetchFilterOptions,
  };
}
