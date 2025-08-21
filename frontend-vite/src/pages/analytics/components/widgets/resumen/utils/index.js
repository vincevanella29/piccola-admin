// /src/pages/analytics/components/widgets/resumen/utils/index.js
import dayjs from 'dayjs';

/* =========================
 * NUM & STRING HELPERS
 * ========================= */
export const toNum = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
export const isDigit = (c) => c >= '0' && c <= '9';
export const isDigits = (s) => typeof s === 'string' && s.length > 0 && [...s].every(isDigit);
export const isYYYYMM = (s) =>
  typeof s === 'string' && s.length === 7 && s[4] === '-' &&
  [...s.slice(0, 4)].every(isDigit) && [...s.slice(5)].every(isDigit);
export const isFiniteNumber = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));

/* =========================
 * LABEL/DATE HELPERS
 * ========================= */
export const fallbackWeek = (dateStr, t=(s)=>s) => {
  if (!dateStr) return t('analytics.Sin fecha');
  const w = String(dayjs(dateStr).week()).padStart(2, '0');
  return `W${w}`;
};
export const fallbackMonth = (dateStr, t=(s)=>s) => {
  if (!dateStr) return t('analytics.Sin fecha');
  return dayjs(dateStr).format('MM');
};

// Factoría de formatLabel dependiente de granularity
export const makeFormatLabel = (granularity) => (key) => {
  if (key == null) return '';
  const s = String(key);
  if (isDigits(s)) return s;
  if (granularity === 'week') {
    const parts = s.split('-W');
    if (parts.length === 2) return `W${parts[1]}`;
    return s.startsWith('W') ? s : `W${s}`;
  }
  if (granularity === 'month') {
    if (isYYYYMM(s)) return s.slice(5);
    return s;
  }
  return s; // day
};

// Obtener punto real por índice o por label formateada
export const getPointByIndexOrLabel = (useIndex, arr, labels, idx, formatLabel) => {
  if (!arr) return null;
  return useIndex ? arr[idx] : arr.find((d) => formatLabel(d.date) === labels[idx]);
};

// Rango “bonito” para título del tooltip
export const mkRange = (p, granularity) => {
  if (!p) return null;
  const s = p.startDate || p.realDate || p.date || p?.details?.[0]?.date || null;
  const e = p.endDate || s;
  if (!s) return null;
  if (granularity === 'day') return s;
  return e && e !== s ? `${s} – ${e}` : s;
};

/* =========================
 * CLIMA HELPERS
 * ========================= */
export const getClimaFromRow = (row) => {
  const c = row?.clima || row?.details?.data?.clima || row?.meta?.clima || null;
  if (!c || typeof c !== 'object') return null;
  const {
    temp_max, temp_min, temp_mean,
    precipitation_sum, rain_sum, snowfall_sum,
    was_raining, was_snowing
  } = c;
  return {
    temp_max: toNum(temp_max),
    temp_min: toNum(temp_min),
    temp_mean: toNum(temp_mean),
    precipitation_sum: toNum(precipitation_sum ?? rain_sum ?? 0),
    snowfall_sum: toNum(snowfall_sum ?? 0),
    was_raining: !!was_raining,
    was_snowing: !!was_snowing,
  };
};

export const pickIconForDay = (c) => {
  if (!c) return null;
  if (c.was_snowing || (c.snowfall_sum ?? 0) > 0) return '❄️';
  if (c.was_raining || (c.precipitation_sum ?? 0) > 0) return '🌧️';
  return '☀️';
};

// Día: primer clima disponible en details
export const dayClimaFromDetails = (details) => {
  for (const d of details || []) {
    const c = getClimaFromRow(d);
    if (c) return c;
  }
  return null;
};

// Semana/Mes: min/max global + contadores
export const summarizeClima = (details) => {
  let minT = null, maxT = null, rainDays = 0, snowDays = 0, sunnyDays = 0, days = 0;
  for (const d of details || []) {
    const c = getClimaFromRow(d);
    if (!c) continue;
    days += 1;
    if (typeof c.temp_min === 'number') minT = minT == null ? c.temp_min : Math.min(minT, c.temp_min);
    if (typeof c.temp_max === 'number') maxT = maxT == null ? c.temp_max : Math.max(maxT, c.temp_max);
    const r = c.was_raining || (c.precipitation_sum ?? 0) > 0;
    const s = c.was_snowing  || (c.snowfall_sum ?? 0) > 0;
    if (s) snowDays += 1;
    else if (r) rainDays += 1;
    else sunnyDays += 1;
  }
  return { hasClima: days > 0, minT, maxT, rainDays, snowDays, sunnyDays, days };
};

/* Bloques de tooltip listos para Chart.js (array de strings) */
export const buildDayBlock = (sum, titulo, t) => {
  if (!sum?.hasClima) return null;
  const icon   = sum.icon || '';
  const hasMin = typeof sum.minT === 'number';
  const hasMax = typeof sum.maxT === 'number';
  const parts  = [];
  const rango  = (hasMin || hasMax)
    ? `${hasMin ? sum.minT.toFixed(1) : '–'}°C / ${hasMax ? sum.maxT.toFixed(1) : '–'}°C` : null;
  parts.push(`${titulo}: ${icon} ${t('analytics.Clima', 'Clima')}${rango ? ': ' + rango : ''}`);
  if (sum.snow) parts.push(`• ${t('analytics.Nieve', 'Nieve')}`);
  else if (sum.rain) parts.push(`• ${t('analytics.Lluvia', 'Lluvia')}`);
  else parts.push(`• ${t('analytics.Soleado', 'Soleado')}`);
  return parts;
};

export const buildRangeBlock = (sum, titulo, t) => {
  if (!sum?.hasClima) return null;
  const parts = [];
  const mm = [];
  if (typeof sum.minT === 'number') mm.push(`${t('analytics.Mín', 'Mín')}: ${sum.minT.toFixed(1)}°C`);
  if (typeof sum.maxT === 'number') mm.push(`${t('analytics.Máx', 'Máx')}: ${sum.maxT.toFixed(1)}°C`);
  if (mm.length) parts.push(`${titulo}: 🌡️ ${mm.join(' | ')}`);
  const counters = [];
  if (sum.rainDays) counters.push(`${sum.rainDays} ${t('analytics.días lluvia', 'días lluvia')}`);
  if (sum.snowDays) counters.push(`${sum.snowDays} ${t('analytics.días nieve', 'días nieve')}`);
  const sunny = Math.max(0, (sum.sunnyDays ?? 0));
  if (sunny) counters.push(`${sunny} ${t('analytics.días soleados', 'días soleados')}`);
  if (counters.length) parts.push(`🗓️ ${counters.join(' · ')}`);
  return parts.length ? parts : null;
};

/* =========================
 * PERSONAS HELPERS
 * ========================= */
export const getPersonasFromRow = (row) => {
  const d = row?.details?.data;
  if (typeof d?.personas === 'number') return d.personas;
  const parentDetails = row?.details?.parent?.details;
  if (Array.isArray(parentDetails)) {
    return parentDetails.reduce((acc, it) => acc + (typeof it?.personas === 'number' ? it.personas : 0), 0);
  }
  if (typeof row?.personas === 'number') return row.personas;
  return 0;
};

export const buildPersonasBlock = (sum, titulo, t) => {
  if (!sum || !sum.hasPersonas) return null;
  const parts = [];
  const personasLine = `${t('analytics.Personas', 'Personas')}: ${Number(sum.totalPersonas).toLocaleString()}`;
  const avgLine = `${t('analytics.Promedio por persona', 'Promedio por persona')}: ${Number(sum.avgPerPersona || 0).toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`;
  parts.push(`${titulo}: 👥 ${personasLine} | ${avgLine}`);
  return parts;
};
