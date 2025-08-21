// /src/pages/analytics/components/widgets/resumen/useResumenAggregation.js
import React from 'react';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

import {
  // nums/strings
  isDigits,
  isYYYYMM,
  isFiniteNumber,
  // label/date helpers
  fallbackWeek,
  fallbackMonth,
  makeFormatLabel,
  getPointByIndexOrLabel,
  mkRange,
  // clima helpers
  dayClimaFromDetails,
  summarizeClima,
  pickIconForDay,
  buildDayBlock,
  buildRangeBlock,
  // personas helpers
  getPersonasFromRow,
  buildPersonasBlock,
} from './utils';

dayjs.extend(weekOfYear);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale);

/**
 * useResumenAggregation – index-first logic
 * - Día: respeta label tal cual (orden de entrada, sin ordenar)
 * - Semana/Mes: también por índice/label, SIN año, y comparación por índice
 * - Labels SIEMPRE salen desde current (no se mezclan con previous) para preservar orden
 */
export default function useResumenAggregation({
  data = [],
  comparisonData = [],
  selectedResumen = [],
  granularity = 'day', // 'day' | 'week' | 'month'
  comparisonType = 'none', // 'none' | 'previous_period' | 'previous_year'
  alignByIndex = false, // forzar index en todos los modos si lo necesitas
  labelKey = 'label',
  valueKey = 'value',
  dateKey = 'date',
  t = (s) => s,
  onDetailsClick,
  mode = 'aggregate', // 'aggregate' | 'compare'
}) {
  const normalizedData = React.useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const normalizedComparisonData = React.useMemo(
    () => (Array.isArray(comparisonData) ? comparisonData : []),
    [comparisonData]
  );

  // ---- Key builder para agrupación ----
  const keyForRow = React.useCallback(
    (row) => {
      const rawLbl = row?.[labelKey];
      // Día: SIEMPRE respeta el label tal cual (orden de entrada)
      if (granularity === 'day') {
        if (rawLbl !== undefined && rawLbl !== null && rawLbl !== '') return String(rawLbl);
        return row?.[dateKey] ? dayjs(row[dateKey]).format('YYYY-MM-DD') : t('analytics.Sin fecha');
      }
      // Semana: índice por semana si el label es numérico (día index → semana index),
      // si no, usar ISO week sin año (Www)
      if (granularity === 'week') {
        if (isFiniteNumber(rawLbl)) {
          const weekIdx = Math.floor(Number(rawLbl) / 7); // 0,1,2...
          return `W${weekIdx}`;
        }
        return fallbackWeek(row?.[dateKey], t);
      }
      // Mes: quitar año (MM). No usamos label numérico aquí para evitar supuestos de 30 días.
      if (granularity === 'month') {
        return fallbackMonth(row?.[dateKey], t);
      }
      return String(rawLbl ?? t('analytics.Sin fecha'));
    },
    [granularity, labelKey, dateKey, t]
  );

  // ---- Agregador por granularidad con resumen de clima opcional ----
  const aggregateByGranularity = React.useCallback(
    (rows) => {
      const map = new Map();
      rows.forEach((d) => {
        const k = keyForRow(d);
        const v = Number(d?.[valueKey]) || 0;
        const rawDate = d?.[dateKey] || d?.date || null;
        const ds = rawDate ? dayjs(rawDate).format('YYYY-MM-DD') : null;
        const prev = map.get(k) || { value: 0, details: [], startDate: null, endDate: null };
        map.set(k, {
          value: prev.value + v,
          details: [...prev.details, d],
          startDate: ds ? (prev.startDate ? (ds < prev.startDate ? ds : prev.startDate) : ds) : prev.startDate,
          endDate: ds ? (prev.endDate ? (ds > prev.endDate ? ds : prev.endDate) : ds) : prev.endDate,
        });
      });

      // Arma salida + clima/personas opcional para tooltip
      return Array.from(map.entries()).map(([date, { value, details, startDate, endDate }]) => {
        let climaSummary = null;
        let personasSummary = null;
        if (granularity === 'day') {
          const c = dayClimaFromDetails(details);
          if (c) {
            climaSummary = {
              kind: 'day',
              hasClima: true,
              minT: typeof c.temp_min === 'number' ? c.temp_min : null,
              maxT: typeof c.temp_max === 'number' ? c.temp_max : null,
              icon: pickIconForDay(c),
              rain: c.was_raining || (c.precipitation_sum ?? 0) > 0,
              snow: c.was_snowing || (c.snowfall_sum ?? 0) > 0,
            };
          }
        } else {
          const s = summarizeClima(details);
          if (s.hasClima) {
            climaSummary = { kind: 'range', ...s };
          }
        }
        // Personas summary (para cualquier granularidad)
        const totalPersonas = (details || []).reduce((acc, d) => acc + (getPersonasFromRow(d) || 0), 0);
        if (totalPersonas > 0) {
          personasSummary = {
            hasPersonas: true,
            totalPersonas,
            avgPerPersona: value > 0 ? value / totalPersonas : 0,
          };
        }
        return { date, value, details, startDate, endDate, _climaSummary: climaSummary, _personasSummary: personasSummary };
      });
    },
    [keyForRow, valueKey, dateKey, granularity]
  );

  // ---- Agregados current/previous (aggregate o compare) ----
  const aggregatedData = React.useMemo(() => {
    if (selectedResumen.length === 0) {
      return { current: [], previous: [], byIndex: true, N: 0, mode };
    }
    const filtered = normalizedData.filter((d) => selectedResumen.includes(d.series ?? d[labelKey]));
    const filteredComp = normalizedComparisonData.filter((d) =>
      selectedResumen.includes(d.series ?? d[labelKey])
    );

    if (mode === 'aggregate') {
      const currentAgg = aggregateByGranularity(filtered);
      const previousAgg = comparisonType !== 'none' ? aggregateByGranularity(filteredComp) : [];
      return { current: currentAgg, previous: previousAgg, byIndex: true, N: 0, mode };
    }

    const buildPerResumen = (rows) => {
      const out = {};
      selectedResumen.forEach((r) => {
        const rowsR = rows.filter((d) => (d.series ?? d[labelKey]) === r);
        out[r] = aggregateByGranularity(rowsR);
      });
      return out;
    };

    return {
      current: buildPerResumen(filtered),
      previous: comparisonType !== 'none' ? buildPerResumen(filteredComp) : {},
      byIndex: true,
      N: 0,
      mode,
    };
  }, [
    normalizedData,
    normalizedComparisonData,
    selectedResumen,
    comparisonType,
    labelKey,
    aggregateByGranularity,
    mode,
  ]);

  // ---- Etiqueta visible (sin año para semana/mes) ----
  const formatLabel = React.useMemo(() => makeFormatLabel(granularity), [granularity]);

  // ---- Labels: unión current+previous respetando orden de current ----
  const labels = React.useMemo(() => {
    if (mode === 'aggregate') {
      const set = new Set();
      (aggregatedData.current || []).forEach((d) => {
        const f = formatLabel(d.date);
        if (!set.has(f)) set.add(f);
      });
      (aggregatedData.previous || []).forEach((d) => {
        const f = formatLabel(d.date);
        if (!set.has(f)) set.add(f);
      });
      return Array.from(set);
    }
    // compare: unión de todas las series current+previous
    const set = new Set();
    Object.values(aggregatedData.current || {}).forEach((arr) => {
      arr?.forEach((d) => {
        const f = formatLabel(d.date);
        if (!set.has(f)) set.add(f);
      });
    });
    Object.values(aggregatedData.previous || {}).forEach((arr) => {
      arr?.forEach((d) => {
        const f = formatLabel(d.date);
        if (!set.has(f)) set.add(f);
      });
    });
    return Array.from(set);
  }, [aggregatedData, formatLabel, mode]);

  // ---- Datasets (índice para semana/mes) ----
  const chartData = React.useMemo(() => {
    const palette = ['#009246', '#FF5733', '#FFC300', '#1D9BF0', '#900C3F', '#C70039', '#581845', '#16A34A', '#2E86C1', '#117A65', '#7D3C98', '#16A34A', '#16A34A'];
    const datasets = [];
    if (!selectedResumen.length) return { labels, datasets };

    const useIndex = alignByIndex || granularity !== 'day';

    if (mode === 'aggregate') {
      const curr = aggregatedData.current || [];
      const dataC = useIndex
        ? labels.map((_, i) => curr[i]?.value ?? 0)
        : (() => {
            const mapC = new Map(curr.map((d) => [formatLabel(d.date), d.value]));
            return labels.map((l) => mapC.get(l) ?? 0);
          })();

      datasets.push({
        label: t('analytics.Período Actual'),
        data: dataC,
        dataPointers: useIndex ? labels.map((_, i) => curr[i] || {}) : labels.map((l) => curr.find((d) => formatLabel(d.date) === l) || {}),
        fill: false,
        borderColor: '#009246',
        backgroundColor: '#009246',
        tension: 0.25,
        pointRadius: 2,
      });

      if (comparisonType !== 'none') {
        const prev = aggregatedData.previous || [];
        const dataP = useIndex
          ? labels.map((_, i) => prev[i]?.value ?? 0)
          : (() => {
              const mapP = new Map(prev.map((d) => [formatLabel(d.date), d.value]));
              return labels.map((l) => mapP.get(l) ?? 0);
            })();
        datasets.push({
          label: comparisonType === 'previous_period' ? t('analytics.Período Anterior') : t('analytics.Año Anterior'),
          data: dataP,
          dataPointers: useIndex ? labels.map((_, i) => prev[i] || {}) : labels.map((l) => prev.find((d) => formatLabel(d.date) === l) || {}),
          fill: false,
          borderColor: '#FF5733',
          backgroundColor: '#FF5733',
          tension: 0.25,
          pointRadius: 2,
          borderDash: [5, 4],
        });
      }
      return { labels, datasets };
    }

    // compare: datasets por cada resumen
    Object.entries(aggregatedData.current || {}).forEach(([res, arr], i) => {
      const prevArr = aggregatedData.previous?.[res] || [];

      const dataC = useIndex
        ? labels.map((_, idx) => arr[idx]?.value ?? 0)
        : (() => {
            const mapC = new Map(arr.map((d) => [formatLabel(d.date), d.value]));
            return labels.map((l) => mapC.get(l) ?? 0);
          })();

      datasets.push({
        label: `${res} (${t('analytics.Período Actual')})`,
        data: dataC,
        fill: false,
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length],
        tension: 0.25,
        pointRadius: 2,
      });

      if (comparisonType !== 'none') {
        const dataP = useIndex
          ? labels.map((_, idx) => prevArr[idx]?.value ?? 0)
          : (() => {
              const mapP = new Map(prevArr.map((d) => [formatLabel(d.date), d.value]));
              return labels.map((l) => mapP.get(l) ?? 0);
            })();
        datasets.push({
          label: `${res} – ${comparisonType === 'previous_period' ? t('analytics.Período Anterior') : t('analytics.Año Anterior')}`,
          data: dataP,
          fill: false,
          borderColor: palette[i % palette.length],
          backgroundColor: palette[i % palette.length],
          tension: 0.25,
          pointRadius: 2,
          borderDash: [5, 4],
        });
      }
    });

    return { labels, datasets };
  }, [labels, aggregatedData, selectedResumen, comparisonType, t, formatLabel, mode, granularity, alignByIndex]);

  // ---- Opciones y tooltip con clima (solo si viene) ----
  const chartOptions = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (event, elements) => {
        if (!elements?.length || !onDetailsClick) return;
        const { index, datasetIndex } = elements[0];
        const useIndex = alignByIndex || granularity !== 'day';
        let puntoReal = null;

        if (mode === 'aggregate') {
          puntoReal = getPointByIndexOrLabel(useIndex, aggregatedData.current, labels, index, formatLabel);
        } else if (mode === 'compare') {
          const datasetLabel = chartData.datasets[datasetIndex]?.label;
          const serieKey = Object.keys(aggregatedData.current).find((k) => datasetLabel?.startsWith(k));
          const arr = aggregatedData.current[serieKey] || [];
          puntoReal = getPointByIndexOrLabel(useIndex, arr, labels, index, formatLabel);
        }
        if (!puntoReal) return;

        const dateLabel = puntoReal?.date || puntoReal?.fecha || puntoReal?.fecha_norm || null;
        const series = puntoReal?.series || puntoReal?.local || null;
        const diaMesActual = labels[index];
        const diaMesAnterior = labels[index];

        onDetailsClick?.({
          ...puntoReal,
          dateLabel,
          series,
          index,
          datasetIndex,
          key: `${series}-${dateLabel}`,
          diaMesActual,
          diaMesAnterior,
        });
      },
      plugins: {
        legend: { display: true },
        title: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: (items) => {
              if (!items?.length) return '';
              const idx = items[0].dataIndex;
              const dsLabel = items[0].dataset?.label;

              if (mode === 'aggregate') {
                const actual = aggregatedData.current?.[idx];
                const anterior = aggregatedData.previous?.[idx];
                const parts = [];
                const rA = mkRange(actual, granularity);
                const rP = mkRange(anterior, granularity);
                if (actual && rA) parts.push(`${t('analytics.Período Actual')}: ${rA}`);
                if (comparisonType !== 'none' && anterior && rP) parts.push(`${t('analytics.Período Anterior')}: ${rP}`);
                return parts.length ? parts.join(' | ') : items[0].label;
              }

              // compare
              const serieKey = Object.keys(aggregatedData.current || {}).find((k) => dsLabel?.startsWith(k));
              const currArr = aggregatedData.current?.[serieKey] || [];
              const prevArr = aggregatedData.previous?.[serieKey] || [];
              const actual = currArr[idx];
              const anterior = prevArr[idx];
              const parts = [];
              const rA = mkRange(actual, granularity);
              const rP = mkRange(anterior, granularity);
              if (actual && rA) parts.push(`${t('analytics.Período Actual')}: ${rA}`);
              if (comparisonType !== 'none' && anterior && rP) parts.push(`${t('analytics.Período Anterior')}: ${rP}`);
              return parts.length ? parts.join(' | ') : items[0].label;
            },
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(undefined, { style: 'currency', currency: 'CLP' })}`,
            afterBody: (items) => {
              if (!items?.length) return;
              const useIndex = alignByIndex || granularity !== 'day';

              // --- AGGREGATE: mostrar clima del actual y del anterior (si existe) ---
              if (mode === 'aggregate') {
                const idx = items[0].dataIndex;
                const puntoActual = getPointByIndexOrLabel(useIndex, aggregatedData.current,  labels, idx, formatLabel);
                const puntoPrevio = getPointByIndexOrLabel(useIndex, aggregatedData.previous, labels, idx, formatLabel);
                const sumActual = puntoActual?._climaSummary || null;
                const sumPrevio = puntoPrevio?._climaSummary || null;
                const perActual = puntoActual?._personasSummary || null;
                const perPrevio = puntoPrevio?._personasSummary || null;

                if (!sumActual?.hasClima && !sumPrevio?.hasClima && !perActual?.hasPersonas && !perPrevio?.hasPersonas) return;

                const tituloActual = t('analytics.Período Actual', 'Actual');
                const tituloPrevio = t(
                  comparisonType === 'previous_period' ? 'analytics.Período Anterior' : 'analytics.Año Anterior',
                  comparisonType === 'previous_period' ? 'Anterior' : 'Año Anterior'
                );

                const out = [];
                if (granularity === 'day') {
                  const bA = buildDayBlock(sumActual, tituloActual, t);
                  const bP = buildDayBlock(sumPrevio, tituloPrevio, t);
                  if (bA) out.push(...bA);
                  if (comparisonType !== 'none' && bP) out.push(...bP);
                } else {
                  const bA = buildRangeBlock(sumActual, tituloActual, t);
                  const bP = buildRangeBlock(sumPrevio, tituloPrevio, t);
                  if (bA) out.push(...bA);
                  if (comparisonType !== 'none' && bP) out.push(...bP);
                }
                // Personas blocks
                const pA = buildPersonasBlock(perActual, tituloActual, t);
                const pP = buildPersonasBlock(perPrevio, tituloPrevio, t);
                if (pA) out.push(...pA);
                if (comparisonType !== 'none' && pP) out.push(...pP);
                return out.length ? out : undefined;
              }

              // --- COMPARE: clima por cada serie (actual/anterior) ---
              const climaBlocks = [];
              const personasBlocks = [];
              for (const item of items) {
                const idx = item.dataIndex;
                const dsLabel = item.dataset?.label;
                const serieKey = Object.keys(aggregatedData.current || {}).find((k) => dsLabel?.startsWith(k));
                const arrCurrent = aggregatedData.current?.[serieKey] || [];
                const arrPrev = aggregatedData.previous?.[serieKey] || [];

                const puntoActual = getPointByIndexOrLabel(useIndex, arrCurrent, labels, idx, formatLabel);
                const puntoPrev = getPointByIndexOrLabel(useIndex, arrPrev, labels, idx, formatLabel);
                const sumActual = puntoActual?._climaSummary || null;
                const sumPrev = puntoPrev?._climaSummary || null;
                const perActual = puntoActual?._personasSummary || null;
                const perPrev = puntoPrev?._personasSummary || null;

                const serieLabel = dsLabel?.replace(/\s*\(.*\)$/, '') || '';
                const blocks = [];
                if (sumActual && sumActual.hasClima) {
                  if (sumActual.kind === 'day') {
                    const bb = buildDayBlock(sumActual, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Actual','Actual')}`, t);
                    if (bb) blocks.push(...bb);
                  } else {
                    const bb = buildRangeBlock(sumActual, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Actual','Actual')}`, t);
                    if (bb) blocks.push(...bb);
                  }
                }
                if (comparisonType !== 'none' && sumPrev && sumPrev.hasClima) {
                  if (sumPrev.kind === 'day') {
                    const bb = buildDayBlock(sumPrev, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Anterior','Anterior')}`, t);
                    if (bb) blocks.push(...bb);
                  } else {
                    const bb = buildRangeBlock(sumPrev, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Anterior','Anterior')}`, t);
                    if (bb) blocks.push(...bb);
                  }
                }
                climaBlocks.push(blocks.length ? blocks : undefined);

                const pBlocks = [];
                const pA = buildPersonasBlock(perActual, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Actual','Actual')}`, t);
                if (pA) pBlocks.push(...pA);
                if (comparisonType !== 'none') {
                  const pP = buildPersonasBlock(perPrev, `${serieLabel ? serieLabel + ' ' : ''}${t('analytics.Período Anterior','Anterior')}`, t);
                  if (pP) pBlocks.push(...pP);
                }
                personasBlocks.push(pBlocks.length ? pBlocks : undefined);
              }
              const result = [];
              items.forEach((_, i) => {
                if (climaBlocks[i] && climaBlocks[i].length) result.push(...climaBlocks[i]);
                if (personasBlocks[i] && personasBlocks[i].length) result.push(...personasBlocks[i]);
              });
              return result.length ? result : undefined;
            },
          },
        },
      },
      scales: {
        x: { type: 'category', ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.07)' } },
      },
    }),
    [
      onDetailsClick,
      labels,
      aggregatedData,
      chartData,
      formatLabel,
      granularity,
      mode,
      t,
      alignByIndex,
      comparisonType,
    ]
  );

  return {
    aggregatedData,
    labels,
    chartData,
    chartOptions,
  };
}
