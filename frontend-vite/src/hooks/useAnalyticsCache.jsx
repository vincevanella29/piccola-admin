// hooks/useAnalyticsCache.js
import { useCallback, useState, useRef } from 'react';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);
import { normalizeForWidget } from '../utils/normalizeForWidget';
import {
  getVentasSummary,
  getAvailableVentasDates,
  getGastosSummary,
  getAvailableGastosDates,
  getGastosTotals,
} from '../utils/analitycsData';

// ------- helpers de fechas / rangos -------
const dstr = (d) => dayjs(d).format('YYYY-MM-DD');
const addDays = (s, n) => dayjs(s).add(n, 'day').format('YYYY-MM-DD');

function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const arr = [...ranges]
    .map(([a, b]) => [dstr(a), dstr(b)])
    .sort((a, b) => a[0].localeCompare(b[0]));
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    const [s, e] = arr[i];
    const last = out[out.length - 1];
    // si pega/solapa (last.end + 1 ≥ s) fusionar
    if (s <= addDays(last[1], 1)) {
      if (e > last[1]) last[1] = e;
    } else {
      out.push([s, e]);
    }
  }
  return out;
}

// --- NUEVO: filtro por labels (si viene definido)
const filterRowsByLabels = (rows, labels) => {
    if (!Array.isArray(labels) || labels.length === 0) return rows;
    const set = new Set(labels.map(String));
    return rows.filter(r => set.has(String(r.label)));
  };

function diffRanges([reqS, reqE], covered) {
  const S = dstr(reqS);
  const E = dstr(reqE);
  const cov = mergeRanges(covered);
  const gaps = [];
  let cur = S;

  for (const [cs, ce] of cov) {
    if (ce < cur) continue;   // este cubierto termina antes del cursor
    if (cs > E) break;        // ya pasamos el final pedido

    // si hay hueco entre cursor y comienzo del cubierto actual
    if (cs > cur) {
      const gapEnd = dayjs(cs).subtract(1, 'day').format('YYYY-MM-DD');
      if (dayjs(gapEnd).isSameOrAfter(cur)) gaps.push([cur, gapEnd]);
    }

    // avanzar cursor al día siguiente del final cubierto
    if (ce >= cur) cur = addDays(ce, 1);
    if (cur > E) break;
  }

  if (cur <= E) gaps.push([cur, E]);
  return gaps;
}

// --- indexa por fechas: genera un eje X 0..N-1 y mantiene la fecha para tooltip
function indexTimeline(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  // 1) Fechas únicas ordenadas
  const uniqueDates = Array.from(new Set(rows.map(r => String(r.date)))).sort((a, b) => a.localeCompare(b));
  const idxByDate = new Map(uniqueDates.map((d, i) => [d, i]));
  // 2) Asigna índice por fecha y preserva el "label" original como "series"
  const out = rows.map(r => {
    const x = idxByDate.get(String(r.date));
    return {
      ...r,
      x,                   // número (0..N-1)
      xLabel: String(x),   // si el widget necesita string
      series: r.label,     // nombre de la serie (antes estaba en label)
      dateLabel: r.date,   // la fecha original para tooltip/ejes secund.
      label: String(x),    // pedido explícito: usar el índice como label
    };
  });
  // 3) Orden consistente: primero por x (fecha), luego por serie
  out.sort((a, b) => (a.x - b.x) || String(a.series).localeCompare(String(b.series)));
  return out;
}

// ------- helpers de caché / merge -------
function upsertDetailCaches(detail, byId, byDate) {
  const id = String(detail._id || detail.id || `${detail.local || detail.resumen2}-${detail.fecha || detail.fecha_pago || detail.fecha_emision}-${Math.random()}`);

  const rawDate =
    detail.fecha ??
    detail.fecha_pago ??
    detail.fecha_emision ??
    null;

  if (!rawDate) return; // sin fecha, no cacheamos

  const fecha = dstr(rawDate);
  if (!byId.has(id)) {
    byId.set(id, { ...detail, _id: id, fecha }); // normalizamos 'fecha' por conveniencia
    const arr = byDate.get(fecha) || [];
    if (!arr.includes(id)) byDate.set(fecha, [...arr, id]);
  }
}

function collectIdsInRange(byDate, start, end) {
  const S = dstr(start);
  const E = dstr(end);
  const ids = [];
  for (const [fecha, arr] of byDate.entries()) {
    if (fecha >= S && fecha <= E) ids.push(...arr);
  }
  return ids;
}

function groupDetailsByKey(ids, byId, key = 'local') {
  const map = new Map();
  for (const id of ids) {
    const det = byId.get(id);
    if (!det) continue;
    const k = det[key] || 'Sin etiqueta';
    if (!map.has(k)) map.set(k, { [key]: k, details: [] });
    map.get(k).details.push(det);
  }
  return Array.from(map.values());
}

function buildWidgetRowsFromGroups(groups, { preferLabelKey, labelFallbacks, preferValueKey, valueFallbacks, dateKeys, type }) {
  return normalizeForWidget(groups, {
    preferLabelKey,
    labelFallbacks,
    preferValueKey,
    valueFallbacks,
    dateKeys,
    type,
    getName: (d) => d.local || d.glosa || d.nombre_cuenta || 'Detalle',
    getDescription: (d) => d.detalle || d.descripcion || '',
  });
}

// =======================================================
// Hook
// =======================================================
export default function useAnalyticsCache(appState, cacheKey = 'global') {
  const wallet = appState?.account;
  const token = appState?.token;
  const key = String(cacheKey || 'global');

  // ---- Per-key caches ----
  const ventasStores = useRef(new Map()); // key -> { byId, byDate, covered }
  const gastosStores = useRef(new Map()); // key -> { byId, byDate, covered }

  const ensureStore = (storesRef, k) => {
    const map = storesRef.current;
    if (!map.has(k)) {
      map.set(k, { byId: new Map(), byDate: new Map(), covered: [] });
    }
    return map.get(k);
  };
  const V = ensureStore(ventasStores, key);
  const G = ensureStore(gastosStores, key);

  // ---- UI (opcional) ----
  const [ventasRaw, setVentasRaw] = useState([]);
  const [ventasWidget, setVentasWidget] = useState([]);
  const [gastosRaw, setGastosRaw] = useState([]);
  const [gastosWidget, setGastosWidget] = useState([]);

  const [availableVentas, setAvailableVentas] = useState(null);
  const [availableGastos, setAvailableGastos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // ---------------- Min/Max ----------------
  const loadAvailableVentasDates = useCallback(async () => {
    try {
      const res = await getAvailableVentasDates();
      setAvailableVentas(res);
      return res;
    } catch (e) {
      setErr(e);
      throw e;
    }
  }, []);

  const loadAvailableGastosDates = useCallback(async () => {
    try {
      const res = await getAvailableGastosDates();
      setAvailableGastos(res);
      return res;
    } catch (e) {
      setErr(e);
      throw e;
    }
  }, []);

  // ---------------- Ventas Summary ----------------
  const loadVentasSummary = useCallback(
    /**
     * @param {string|Date} start
     * @param {string|Date} end
     * @param {{labels?: string[], force?: boolean}} opts  // <-- NUEVO: force bypass cache
     */
    async (start, end, opts = {}) => {
      setLoading(true); setErr(null);
      try {
        if (!start || !end) throw new Error('Fechas requeridas');
        const wantedLabels = Array.isArray(opts.labels) ? opts.labels : null;
        const reqRange = [dstr(start), dstr(end)];
        const force = opts.force === true;
        const gaps = force ? [[reqRange[0], reqRange[1]]] : diffRanges(reqRange, V.covered);
        if (!gaps.length && !force) {
          console.debug('[useAnalyticsCache.loadVentasSummary] Using cached ventas, no gaps to fetch', { range: reqRange, labels: wantedLabels });
        }
        // traer SOLO los gaps que falten
        for (const [gs, ge] of gaps) {
          const res = await getVentasSummary({
            start_date: gs,
            end_date: ge,
            include_local: Array.isArray(wantedLabels) ? wantedLabels : [],
            walletAddress: wallet,
            token,
          });
          console.log("ventas", res);
          const groups = Array.isArray(res?.ventas) ? res.ventas : [];
          for (const g of groups) {
            const dets = Array.isArray(g.details) ? g.details : [];
            for (const det of dets) upsertDetailCaches(det, V.byId, V.byDate);
          }
          V.covered = mergeRanges([...V.covered, [gs, ge]]);
        }
        // construir SOLO el slice pedido
        const ids = collectIdsInRange(V.byDate, reqRange[0], reqRange[1]);
        const rawGroups = groupDetailsByKey(ids, V.byId, 'local');
        let widgetRows = buildWidgetRowsFromGroups(rawGroups, {
          preferLabelKey: 'local',
          labelFallbacks: ['local', 'resumen', 'sigla'],
          preferValueKey: 'total',
          valueFallbacks: ['total', 'subtotal'],
          dateKeys: ['fecha'],
          type: 'venta',
        });
        // FILTRO por labels (si aplica)
        widgetRows = filterRowsByLabels(widgetRows, wantedLabels);
        setVentasRaw(rawGroups);
        widgetRows = indexTimeline(widgetRows);
        setVentasWidget(widgetRows);
        return { raw: rawGroups, widget: widgetRows };
      } catch (e) {
        setErr(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [wallet, token]
  );

  // ---------------- Gastos Summary ----------------
  const loadGastosSummary = useCallback(
    /**
     * @param {string|Date} start
     * @param {string|Date} end
     * @param {{labels?: string[]}} opts  // <-- NUEVO
     */
    async (start, end, opts = {}) => {
      setLoading(true); setErr(null);
      try {
        if (!start || !end) throw new Error('Fechas requeridas');
        const wantedLabels = Array.isArray(opts.labels) ? opts.labels : null;
        const reqRange = [dstr(start), dstr(end)];
        const gaps = diffRanges(reqRange, G.covered);
        for (const [gs, ge] of gaps) {
          const res = await getGastosSummary({
            start_date: gs, end_date: ge, walletAddress: wallet, token,
          });
          const groups = Array.isArray(res?.gastos || res?.data) ? (res.gastos || res.data) : [];
          // Puede venir anidado (resumen_data/tipo_gasto_data/details) o plano con details
          for (const g of groups) {
            if (Array.isArray(g?.resumen_data)) {
              for (const r of g.resumen_data) {
                const tgs = Array.isArray(r?.tipo_gasto_data) ? r.tipo_gasto_data : [];
                for (const tg of tgs) {
                  const dets = Array.isArray(tg?.details) ? tg.details : [];
                  for (const det of dets) upsertDetailCaches(det, G.byId, G.byDate);
                }
              }
            } else {
              const dets = Array.isArray(g?.details) ? g.details : [];
              for (const det of dets) upsertDetailCaches(det, G.byId, G.byDate);
            }
          }
          G.covered = mergeRanges([...G.covered, [gs, ge]]);
        }
        const ids = collectIdsInRange(G.byDate, reqRange[0], reqRange[1]);
        const rawGroups = groupDetailsByKey(ids, G.byId, 'resumen2');
        let widgetRows = buildWidgetRowsFromGroups(rawGroups, {
          preferLabelKey: 'resumen2',
          labelFallbacks: ['resumen2', 'resumen', 'sigla', 'nombre_cuenta'],
          preferValueKey: 'total_cargo',
          valueFallbacks: ['total_cargo', 'cargo', 'abono', 'total'],
          dateKeys: ['fecha', 'fecha_pago', 'fecha_emision'],
          type: 'gasto',
        });
        // FILTRO por labels (si aplica)
        widgetRows = filterRowsByLabels(widgetRows, wantedLabels);
        setGastosRaw(rawGroups);
        widgetRows = indexTimeline(widgetRows);
        setGastosWidget(widgetRows);
        return { raw: rawGroups, widget: widgetRows };
      } catch (e) {
        setErr(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [wallet, token]
  );

  // ---------------- Gastos Totals (rápido para widgets) ----------------
  const loadGastosTotals = useCallback(
    /**
     * @param {string|Date} start
     * @param {string|Date} end
     * @param {{labels?: string[], by?: 'resumen2'|'resumen'|'tipo_gasto'|'cuenta', include_daily?: boolean, exclude_cuentas?: (string|number)[], include_resumen2?: string[], exclude_resumen2?: string[]}} opts
     */
    async (start, end, opts = {}) => {
      setLoading(true); setErr(null);
      try {
        if (!start || !end) throw new Error('Fechas requeridas');
        const wantedLabels = Array.isArray(opts.labels) ? opts.labels : null;
        const by = opts.by || 'resumen2';
        const include_daily = opts.include_daily !== false; // default true
        const exclude_cuentas = Array.isArray(opts.exclude_cuentas) ? opts.exclude_cuentas.map(String) : [];
        const include_resumen2 = Array.isArray(opts.include_resumen2) ? opts.include_resumen2.map(String) : [];
        const exclude_resumen2 = Array.isArray(opts.exclude_resumen2) ? opts.exclude_resumen2.map(String) : [];
        const include_sucursales_ids = Array.isArray(opts.include_sucursales_ids)
          ? opts.include_sucursales_ids.filter((n) => Number.isFinite(Number(n))).map((n) => Number(n))
          : [];
        const include_siglas = Array.isArray(opts.include_siglas)
          ? opts.include_siglas.map(String).filter(Boolean)
          : [];

        const res = await getGastosTotals({
          start_date: dstr(start),
          end_date: dstr(end),
          by,
          include_daily,
          exclude_cuentas,
          include_resumen2,
          exclude_resumen2,
          include_sucursales_ids,
          include_siglas,
          walletAddress: wallet,
          token,
        });
        console.log("gastos", res);

        const groups = Array.isArray(res?.gastos || res?.data) ? (res.gastos || res.data) : [];
        // OJO: groups ya viene como { [by]: "<grupo>", details: [{fecha, total_cargo, ...}] }
        let widgetRows = normalizeForWidget(groups, {
          preferLabelKey: by,
          labelFallbacks: [by, 'resumen2', 'resumen', 'sigla', 'nombre_cuenta'],
          preferValueKey: 'total_cargo',
          valueFallbacks: ['total_cargo', 'cargo', 'abono', 'total'],
          dateKeys: ['fecha'],
          type: 'gasto',
          getName: (d) => d.local || d.glosa || d.nombre_cuenta || 'Detalle',
          getDescription: (d) => d.detalle || d.descripcion || '',
        });
        widgetRows = filterRowsByLabels(widgetRows, wantedLabels);
        setGastosRaw(groups);      // para debug/inspección
        widgetRows = indexTimeline(widgetRows);
        setGastosWidget(widgetRows);
        return { raw: groups, widget: widgetRows };
      } catch (e) {
        setErr(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [wallet, token]
  );

  // ---------------- Clima por rango de fechas ----------------
  const loadClima = useCallback(
    /**
     * @param {string|Date} start
     * @param {string|Date} end
     * @param {{permalink_slug?: string}} opts
     */
    async (start, end, opts = {}) => {
      setLoading(true); setErr(null);
      try {
        if (!start || !end) throw new Error('Fechas requeridas');
        const res = await import('../utils/analitycsData').then(mod => mod.getClima({
          start_date: dstr(start),
          end_date: dstr(end),
          permalink_slug: opts.permalink_slug,
          walletAddress: wallet,
          token,
        }));
        return res;
      } catch (e) {
        setErr(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [wallet, token]
  );

  // ---------------- Utilidades ----------------
  const clearCaches = useCallback(() => {
    // Clear only current key stores, mutating existing store objects so existing references (V/G) see the reset
    const v = ensureStore(ventasStores, key);
    v.byId = new Map();
    v.byDate = new Map();
    v.covered = [];
    const g = ensureStore(gastosStores, key);
    g.byId = new Map();
    g.byDate = new Map();
    g.covered = [];
    setVentasRaw([]);
    setVentasWidget([]);
    setGastosRaw([]);
    setGastosWidget([]);
  }, [key]);

  return {
    // funciones (una por API)
    loadAvailableVentasDates,
    loadAvailableGastosDates,
    loadVentasSummary,
    loadGastosSummary, // dejamos la antigua por si la usas en otro informe
    loadGastosTotals,  // NUEVA, usa /gastos/totals
    loadClima,         // NUEVA, clima por rango

    // estados listos para UI (opcional)
    ventasRaw,
    ventasWidget,
    gastosRaw,
    gastosWidget,
    availableVentas,
    availableGastos,
    loading,
    error: err,

    // cobertura actual (recalculada al vuelo)
    ventasCoverage: mergeRanges(ensureStore(ventasStores, key).covered),
    gastosCoverage: mergeRanges(ensureStore(gastosStores, key).covered),

    // caché utils
    clearCaches,
  };
}
