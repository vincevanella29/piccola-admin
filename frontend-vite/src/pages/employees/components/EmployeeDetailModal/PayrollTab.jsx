import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { buildComparison, groupByPeriodo, normalizeList } from './payrollUtils';
import DeltaPill from '../../../../components/ui/DeltaPill';

// ── Format ──────────────────────────────────────────────────────────────────
const fmtFull = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const compactNumber = (n) => {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs/1e9).toFixed(abs>=1e10?0:1).replace(/\.0$/,'')}b`;
  if (abs >= 1e6) return `${sign}${(abs/1e6).toFixed(abs>=1e7?0:1).replace(/\.0$/,'')}m`;
  if (abs >= 1e3) return `${sign}${(abs/1e3).toFixed(abs>=1e4?0:1).replace(/\.0$/,'')}k`;
  return `${sign}${Math.round(abs)}`;
};
const money = (n=0) => `$${compactNumber(Number(n)||0)}`;

// ── Mini components ─────────────────────────────────────────────────────────
const PeriodBadge = ({ title, start, end }) => {
  if (!start || !end) return null;
  const a = dayjs(start).format('YYYY-MM-DD');
  const b = dayjs(end).format('YYYY-MM-DD');
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
      {title}: {a} → {b}
    </span>
  );
};

const MoneyCompact = ({ value }) => (
  <span className="font-semibold text-light-text-primary dark:text-dark-text-primary cursor-help" title={fmtFull.format(Number(value||0))}>
    {money(value)}
  </span>
);

const MiniCompareBars = ({ title, curr=0, prev=0, delta=null, goodWhenUp=true }) => {
  const maxv = Math.max(curr, prev, 1);
  const wCurr = Math.round((curr/maxv)*100);
  const wPrev = Math.round((prev/maxv)*100);
  return (
    <div className="rounded-2xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
      <div className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">{title}</div>
      <div className="mt-1.5 flex items-center justify-between">
        <MoneyCompact value={curr} />
        <DeltaPill value={delta} goodWhenUp={goodWhenUp} />
      </div>
      <div className="mt-2 space-y-1">
        <div className="h-2 rounded-full bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 overflow-hidden">
          <div className="h-2 rounded-full bg-light-accent/80 dark:bg-dark-accent/80 transition-all" style={{ width: `${wCurr}%` }} />
        </div>
        <div className="h-2 rounded-full bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 overflow-hidden">
          <div className="h-2 rounded-full bg-light-text-secondary/30 dark:bg-dark-text-secondary/30 transition-all" style={{ width: `${wPrev}%` }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
        <span>{money(curr)}</span>
        <span>{money(prev)}</span>
      </div>
    </div>
  );
};

// ── Waterfall ───────────────────────────────────────────────────────────────
const WaterfallRow = ({ title, rec }) => {
  if (!rec) return null;
  const total = Number(rec.remuneracion_total ?? 0);
  const imponible = Number(rec.remuneracion_imponible ?? 0);
  const noImp = Number(rec.remuneracion_no_imponible ?? 0);
  const legales = Number(rec.descuentos_legales ?? 0);
  const impuestos = Number(rec.impuestos ?? 0) + Number(rec.retencion_prestamo_solidario_sii ?? 0);
  const otrosDesc = Number(rec.otros_descuentos ?? 0) + Number(rec.descuento_anticipo ?? 0);
  const neto = Number(rec.sueldo_liquido_a_pago ?? rec.sueldo_liquido_mas_anticipo ?? 0);
  const maxv = Math.max(total, neto, 1);
  const seg = [
    { k:'imp', v:imponible, cls:'bg-emerald-500' },
    { k:'no', v:noImp, cls:'bg-emerald-300' },
    { k:'leg', v:-(legales), cls:'bg-purple-500/80' },
    { k:'impues', v:-(impuestos), cls:'bg-purple-500/60' },
    { k:'otros', v:-(otrosDesc), cls:'bg-purple-500/40' },
  ];
  const widthPct = (v) => `${Math.max(2, Math.round((Math.abs(v)/maxv)*100))}%`;

  return (
    <div className="rounded-2xl p-3 bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">{title}</span>
        <MoneyCompact value={neto} />
      </div>
      <div className="mt-2 rounded-lg bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 p-1.5">
        <div className="h-3.5 w-full rounded-lg overflow-hidden flex">
          {seg.filter(s => Math.abs(s.v) > 0).map(s => (
            <div key={s.k} className={s.cls} style={{ width: widthPct(s.v) }} />
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex flex-wrap gap-2.5">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />{`Imponible ${money(imponible)}`}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-300" />{`No imp. ${money(noImp)}`}</span>
          {legales ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-purple-500/80" />{`Legales -${money(legales)}`}</span> : null}
          {impuestos ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-purple-500/60" />{`Impuestos -${money(impuestos)}`}</span> : null}
          {otrosDesc ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-purple-500/40" />{`Otros -${money(otrosDesc)}`}</span> : null}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const PayrollTab = ({ t, currItems, prevItems, fallbackList, count, windows, comparisonEnabled }) => {
  const curr = comparisonEnabled ? currItems : (currItems?.length ? currItems : fallbackList);
  const prev = comparisonEnabled ? prevItems : [];

  const cmp = buildComparison(curr, prev);
  const delta = {
    net: cmp?.prev?.liquido > 0 ? ((cmp.curr.liquido - cmp.prev.liquido) / cmp.prev.liquido) * 100 : null,
    total: cmp?.prev?.total > 0 ? ((cmp.curr.total - cmp.prev.total) / cmp.prev.total) * 100 : null,
    imponible: cmp?.prev?.imponible > 0 ? ((cmp.curr.imponible - cmp.prev.imponible) / cmp.prev.imponible) * 100 : null,
    noImponible: cmp?.prev?.noImponible > 0 ? ((cmp.curr.noImponible - cmp.prev.noImponible) / cmp.prev.noImponible) * 100 : null,
  };

  const recCurr = useMemo(() => (curr?.length ? normalizeList(curr)[0] : null), [curr]);
  const recPrev = useMemo(() => (prev?.length ? normalizeList(prev)[0] : null), [prev]);

  const diasTrab = Number(recCurr?.dias_trabajados ?? 0);
  const diasLic = Number(recCurr?.dias_licencia ?? 0);
  const he50 = Number(recCurr?.horas_extra_50 ?? recCurr?.hhs_extra_50 ?? 0);

  return (
    <div className="w-full overflow-x-hidden space-y-3">
      {/* Period badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <PeriodBadge title={t('employees.payroll.period_current')} start={windows?.current?.start} end={windows?.current?.end} />
        {comparisonEnabled && <PeriodBadge title={t('employees.payroll.period_previous')} start={windows?.previous?.start} end={windows?.previous?.end} />}
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
          {t('employees.payroll.records')}: {count ?? (curr?.length || 0)}
        </span>
        {!!diasTrab && (
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
            {t('employees.report.days_worked')}: {diasTrab}
          </span>
        )}
        {diasLic > 0 && (
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
            {t('employees.report.days_off')}: {diasLic}
          </span>
        )}
        {he50 > 0 && (
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
            HE50: {he50}
          </span>
        )}
      </div>

      {/* KPI comparison bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <MiniCompareBars title={t('employees.payroll.kpi.net')} curr={cmp.curr.liquido} prev={cmp.prev.liquido} delta={delta.net} goodWhenUp />
        <MiniCompareBars title={t('employees.payroll.kpi.total')} curr={cmp.curr.total} prev={cmp.prev.total} delta={delta.total} goodWhenUp />
        <MiniCompareBars title={t('employees.payroll.kpi.imponible')} curr={cmp.curr.imponible} prev={cmp.prev.imponible} delta={delta.imponible} goodWhenUp />
        <MiniCompareBars title={t('employees.payroll.kpi.no_imponible')} curr={cmp.curr.noImponible} prev={cmp.prev.noImponible} delta={delta.noImponible} goodWhenUp={false} />
      </div>

      {/* Waterfall composition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {recCurr && <WaterfallRow title={t('common.current') || 'Actual'} rec={recCurr} />}
        {comparisonEnabled && recPrev && <WaterfallRow title={t('common.previous') || 'Anterior'} rec={recPrev} />}
      </div>

      {/* Quick highlights */}
      {comparisonEnabled && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: t('employees.payroll.kpi.net'), val: delta.net, up: true },
            { label: t('employees.payroll.kpi.total'), val: delta.total, up: true },
            { label: t('employees.payroll.kpi.imponible'), val: delta.imponible, up: true },
            { label: t('employees.payroll.kpi.no_imponible'), val: delta.noImponible, up: false },
          ].map(h => (
            <div key={h.label} className="inline-flex items-center gap-1 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/20 rounded-full px-2.5 py-0.5">
              <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{h.label}:</span>
              <DeltaPill value={h.val} goodWhenUp={h.up} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayrollTab;
