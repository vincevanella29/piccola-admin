// hooks/useEmpleadosCache.jsx
import React from 'react';
import dayjs from 'dayjs';
import { getTrabajadoresActivos, getTrabajadorByRut, getAsistenciaDiaria, getAsistenciaPorSucursal, getSueldos } from '../utils/analitycsData';

// Configurable cache TTL (default: 1 hour)
// Adjust this constant to change how long cached entries remain valid
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const isFresh = (ts) => typeof ts === 'number' && (Date.now() - ts) < CACHE_TTL_MS;

// small helper
const dstr = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null);

// Compute comparison range (same as Analytics)
function computeComparison(dateRange, { comparisonType, compareByWeekdays }) {
  if (!dateRange?.start || !dateRange?.end || comparisonType === 'none') return { start: null, end: null };
  const start = dayjs(dateRange.start).startOf('day');
  const end = dayjs(dateRange.end).endOf('day');
  const days = end.diff(start, 'day');
  let cs = null, ce = null;
  if (comparisonType === 'previous_period') { cs = start.subtract(days + 1, 'day'); ce = end.subtract(days + 1, 'day'); }
  if (comparisonType === 'same_period')     { cs = start.subtract(1, 'year'); ce = end.subtract(1, 'year'); }
  if (compareByWeekdays && cs && ce) {
    const curDow = start.day();
    const cmpDow = cs.day();
    const delta  = (curDow - cmpDow + 7) % 7;
    cs = cs.add(delta, 'day');
    ce = cs.add(days, 'day');
  }
  return { start: cs, end: ce };
}

export default function useEmpleadosCache(appState) {
  const wallet = appState?.account;
  const token = appState?.token;

  // Caches
  const empleadosByRut = React.useRef(new Map()); // rut(string) -> { data: empleado, ts }
  const lastQueryKey = React.useRef(null);        // key string of last list query
  const listCache = React.useRef(new Map());      // key -> { items, count, ts }

  // UI state
  const [empleadosList, setEmpleadosList] = React.useState([]);
  const [empleadosCount, setEmpleadosCount] = React.useState(0);
  const [selectedEmpleado, setSelectedEmpleado] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [sueldosList, setSueldosList] = React.useState([]);
  const [sueldosCount, setSueldosCount] = React.useState(0);

  // Build a stable cache key for list queries
  const buildKey = ({ sucursal, cargo, q, skip = 0, limit = 100 }) =>
    JSON.stringify({ sucursal: sucursal || '', cargo: cargo || '', q: q || '', skip: Number(skip)||0, limit: Number(limit)||100 });

  // Load activos with optional filters
  const loadTrabajadoresActivos = React.useCallback(async (opts = {}) => {
    setLoading(true); setError(null);
    try {
      const key = buildKey(opts);
      // Return cached list if same key and still fresh
      if (listCache.current.has(key)) {
        const entry = listCache.current.get(key);
        if (entry && isFresh(entry.ts)) {
          const { items, count } = entry;
          setEmpleadosList(items);
          setEmpleadosCount(count);
          lastQueryKey.current = key;
          return { items, count, cached: true };
        } else {
          // stale entry
          listCache.current.delete(key);
        }
      }

      const res = await getTrabajadoresActivos({
        sucursal: opts.sucursal || null,
        cargo: opts.cargo || null,
        q: opts.q || null,
        skip: opts.skip ?? 0,
        limit: opts.limit ?? 100,
        walletAddress: wallet,
        token,
      });

      console.log("empleados", res);
      const data = Array.isArray(res?.trabajadores || res?.data) ? (res.trabajadores || res.data) : [];
      const count = typeof res?.count === 'number' ? res.count : (res?.total ?? data.length);

      // Index by rut for quick lookup (with TTL)
      for (const emp of data) {
        const rut = String(emp?.rut ?? '').trim();
        if (rut) empleadosByRut.current.set(rut, { data: emp, ts: Date.now() });
      }

      listCache.current.set(key, { items: data, count, ts: Date.now() });
      lastQueryKey.current = key;
      setEmpleadosList(data);
      setEmpleadosCount(count);
      return { items: data, count, cached: false };
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [wallet, token]);

  // Asistencia con comparación (igual a AnalyticsView behavior)
  const loadAsistenciaDiariaWithComparison = React.useCallback(
    /**
     * @param {{ start_date: Date|string, end_date: Date|string, rut?: string|number, id_sucursal?: any, tipo_marca?: any, sucursal_slug?: any, sucursal_activa?: any, skip?: number, limit?: number }} opts
     * @param {{ comparisonType: 'none'|'same_period'|'previous_period', compareByWeekdays?: boolean }} cfg
     * @returns {Promise<{ current: any[], previous: any[], comparisonStart: string|null, comparisonEnd: string|null }>}
     */
    async (opts = {}, cfg = { comparisonType: 'none', compareByWeekdays: false }) => {
      setLoading(true); setError(null);
      try {
        const curRes = await getAsistenciaDiaria({
          start_date: dstr(opts.start_date),
          end_date: dstr(opts.end_date),
          rut: opts.rut ?? null,
          id_sucursal: opts.id_sucursal ?? null,
          tipo_marca: opts.tipo_marca ?? null,
          sucursal_slug: opts.sucursal_slug ?? null,
          sucursal_activa: opts.sucursal_activa ?? null,
          skip: opts.skip ?? 0,
          limit: opts.limit ?? null,
          walletAddress: wallet,
          token,
        });
        const current = Array.isArray(curRes?.asistencia) ? curRes.asistencia : (curRes?.data || curRes || []);

        const { start: cs, end: ce } = computeComparison({ start: opts.start_date, end: opts.end_date }, cfg);
        let previous = [];
        if (cs && ce && cfg.comparisonType !== 'none') {
          const prevRes = await getAsistenciaDiaria({
            start_date: dstr(cs),
            end_date: dstr(ce),
            rut: opts.rut ?? null,
            id_sucursal: opts.id_sucursal ?? null,
            tipo_marca: opts.tipo_marca ?? null,
            sucursal_slug: opts.sucursal_slug ?? null,
            sucursal_activa: opts.sucursal_activa ?? null,
            skip: opts.skip ?? 0,
            limit: opts.limit ?? null,
            walletAddress: wallet,
            token,
          });
          previous = Array.isArray(prevRes?.asistencia) ? prevRes.asistencia : (prevRes?.data || prevRes || []);
          return { current, previous, comparisonStart: dstr(cs), comparisonEnd: dstr(ce) };
        }
        return { current, previous: [], comparisonStart: null, comparisonEnd: null };
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [wallet, token]
  );

  // Fetch single employee by RUT (uses cache first)
  const loadEmpleadoByRut = React.useCallback(async (rut) => {
    setLoading(true); setError(null);
    try {
      const key = String(rut);
      if (empleadosByRut.current.has(key)) {
        const cached = empleadosByRut.current.get(key);
        if (cached && isFresh(cached.ts)) {
          setSelectedEmpleado(cached.data);
          return { empleado: cached.data, cached: true };
        } else {
          empleadosByRut.current.delete(key);
        }
      }

      const res = await getTrabajadorByRut({ rut: key, walletAddress: wallet, token });
      // Backend returns the document directly
      const emp = res?.rut ? res : (res?.data || res);
      if (emp && (emp.rut !== undefined && emp.rut !== null)) {
        empleadosByRut.current.set(String(emp.rut), { data: emp, ts: Date.now() });
        setSelectedEmpleado(emp);
        return { empleado: emp, cached: false };
      }
      // Not found or unexpected shape
      setSelectedEmpleado(null);
      return { empleado: null, cached: false };
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [wallet, token]);

  // --- Asistencia ---
  const loadAsistenciaDiaria = React.useCallback(async (opts = {}) => {
    setLoading(true); setError(null);
    try {
      const res = await getAsistenciaDiaria({
        start_date: dstr(opts.start_date),
        end_date: dstr(opts.end_date),
        rut: opts.rut ?? null,
        id_sucursal: opts.id_sucursal ?? null,
        tipo_marca: opts.tipo_marca ?? null,
        sucursal_slug: opts.sucursal_slug ?? null,
        sucursal_activa: opts.sucursal_activa ?? null,
        skip: opts.skip ?? 0,
        limit: opts.limit ?? null,
        walletAddress: wallet,
        token,
      });
      console.log(res);
      return res?.data ?? res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [wallet, token]);

  const loadAsistenciaPorSucursal = React.useCallback(async (opts = {}) => {
    setLoading(true); setError(null);
    try {
      const res = await getAsistenciaPorSucursal({
        start_date: dstr(opts.start_date),
        end_date: dstr(opts.end_date),
        rut: opts.rut ?? null,
        id_sucursal: opts.id_sucursal ?? null,
        tipo_marca: opts.tipo_marca ?? null,
        sucursal_slug: opts.sucursal_slug ?? null,
        sucursal_activa: opts.sucursal_activa ?? null,
        skip: opts.skip ?? 0,
        limit: opts.limit ?? null,
        walletAddress: wallet,
        token,
      });
      return res?.data ?? res;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [wallet, token]);

  const clearEmpleadosCache = React.useCallback(() => {
    empleadosByRut.current.clear();
    listCache.current.clear();
    lastQueryKey.current = null;
    setEmpleadosList([]);
    setEmpleadosCount(0);
    setSelectedEmpleado(null);
  }, []);

  // --- Sueldos ---
  const loadSueldos = React.useCallback(async (opts = {}) => {
    setLoading(true); setError(null);
    try {
      const res = await getSueldos({
        rut: opts.rut ?? null,
        periodo: opts.periodo ?? null,
        periodo_start: opts.periodo_start ?? null,
        periodo_end: opts.periodo_end ?? null,
        centro_costo: opts.centro_costo ?? null,
        skip: opts.skip ?? 0,
        limit: opts.limit ?? 100,
        walletAddress: wallet,
        token,
      });
      console.log(res);
      const items = Array.isArray(res?.sueldos) ? res.sueldos : (res?.data || res || []);
      const count = typeof res?.count === 'number' ? res.count : items.length;
      setSueldosList(items);
      setSueldosCount(count);
      return { items, count };
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [wallet, token]);

  return {
    // actions
    loadTrabajadoresActivos,
    loadEmpleadoByRut,
    loadAsistenciaDiaria,
    loadAsistenciaDiariaWithComparison,
    loadAsistenciaPorSucursal,
    loadSueldos,
    clearEmpleadosCache,

    // state
    empleadosList,
    empleadosCount,
    selectedEmpleado,
    sueldosList,
    sueldosCount,
    loading,
    error,
  };
}
