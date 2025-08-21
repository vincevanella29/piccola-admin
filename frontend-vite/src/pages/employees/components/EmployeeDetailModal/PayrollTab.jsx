import React, { useMemo } from 'react';
import { Box, Chip, Stack, Tooltip } from '@mui/material';
import dayjs from 'dayjs';
import { buildComparison, groupByPeriodo, normalizeList } from './payrollUtils';
import DeltaPill from '../../../../components/ui/DeltaPill';

// ------- formato -------
const fmtFull = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const compactNumber = (n) => {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs/1e9).toFixed(abs>=1e10?0:1).replace(/\.0$/,'')}b`;
  if (abs >= 1e6) return `${sign}${(abs/1e6).toFixed(abs>=1e7?0:1).replace(/\.0$/,'')}m`;
  if (abs >= 1e3) return `${sign}${(abs/1e3).toFixed(abs>=1e4?0:1).replace(/\.0$/,'')}k`;
  return `${sign}${Math.round(abs)}`;
};
const money = (n=0) => `$${compactNumber(Number(n)||0)}`;

// ------- mini componentes -------
const PeriodBadge = ({ title, start, end }) => {
  if (!start || !end) return null;
  const a = dayjs(start).format('YYYY-MM-DD'); const b = dayjs(end).format('YYYY-MM-DD');
  return <Chip size="small" label={`${title}: ${a} → ${b}`} className="text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />;
};

// DeltaPill reusable widget is used for all delta visuals

const MoneyCompact = ({ value }) => (
  <Tooltip title={fmtFull.format(Number(value||0))} arrow>
    <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{money(value)}</span>
  </Tooltip>
);

// barras lado a lado curr vs prev
const MiniCompareBars = ({ title, curr=0, prev=0, delta=null, goodWhenUp=true }) => {
  const maxv = Math.max(curr, prev, 1);
  const wCurr = Math.round((curr/maxv)*100);
  const wPrev = Math.round((prev/maxv)*100);
  return (
    <Box className="rounded-2xl p-3 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
      <div className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</div>
      <div className="mt-1 flex items-center justify-between">
        <MoneyCompact value={curr} />
        <DeltaPill value={delta} goodWhenUp={goodWhenUp} />
      </div>
      <div className="mt-2 space-y-1">
        <div className="h-2 rounded bg-light-surface/60 dark:bg-dark-surface/60 overflow-hidden">
          <div className="h-2 bg-light-accent/90 dark:bg-dark-accent/90" style={{ width: `${wCurr}%` }} />
        </div>
        <div className="h-2 rounded bg-light-surface/60 dark:bg-dark-surface/60 overflow-hidden">
          <div className="h-2 bg-light-text-secondary/50 dark:bg-dark-text-secondary/50" style={{ width: `${wPrev}%` }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
        <span>{money(curr)}</span>
        <span>{money(prev)}</span>
      </div>
    </Box>
  );
};

// Waterfall compacto (composición → neto) para 1 período
const WaterfallRow = ({ title, rec }) => {
  if (!rec) return null;
  const total = Number(rec.remuneracion_total ?? rec.remuneracion_total ?? 0);
  const imponible = Number(rec.remuneracion_imponible ?? 0);
  const noImp = Number(rec.remuneracion_no_imponible ?? 0);
  const legales = Number(rec.descuentos_legales ?? 0);
  const impuestos = Number(rec.impuestos ?? 0) + Number(rec.retencion_prestamo_solidario_sii ?? 0);
  const otrosDesc = Number(rec.otros_descuentos ?? 0) + Number(rec.descuento_anticipo ?? 0);
  const neto = Number(rec.sueldo_liquido_a_pago ?? rec.sueldo_liquido_mas_anticipo ?? 0);

  const maxv = Math.max(total, neto, 1);
  const seg = [
    { k:'imp', v:imponible, cls:'bg-[#26a69a]' },
    { k:'no', v:noImp, cls:'bg-[#80cbc4]' },
    { k:'leg', v:-(legales), cls:'bg-vanellix-purple/80' },
    { k:'impues', v:-(impuestos), cls:'bg-vanellix-purple/60' },
    { k:'otros', v:-(otrosDesc), cls:'bg-vanellix-purple/40' },
  ];
  // ancho relativo por valor absoluto
  const widthPct = (v)=> `${Math.max(2, Math.round((Math.abs(v)/maxv)*100))}%`;

  return (
    <Box className="rounded-2xl p-3 bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{title}</span>
        <span className="text-sm font-semibold"><MoneyCompact value={neto} /></span>
      </div>
      <div className="mt-2 rounded bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 p-1">
        <div className="h-3 w-full rounded overflow-hidden flex">
          {seg.filter(s=>Math.abs(s.v)>0).map((s)=>(
            <div key={s.k} className={s.cls} style={{ width: widthPct(s.v) }} />
          ))}
        </div>
        <div className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary flex flex-wrap gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded" style={{background:'#26a69a'}} />{`Imponible ${money(imponible)}`}</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded" style={{background:'#80cbc4'}} />{`No imp. ${money(noImp)}`}</span>
          {legales ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-vanellix-purple/80" />{`Legales -${money(legales)}`}</span> : null}
          {impuestos ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-vanellix-purple/60" />{`Impuestos -${money(impuestos)}`}</span> : null}
          {otrosDesc ? <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-vanellix-purple/40" />{`Otros -${money(otrosDesc)}`}</span> : null}
        </div>
      </div>
    </Box>
  );
};

// ------- TAB -------
const PayrollTab = ({ t, currItems, prevItems, fallbackList, count, windows, comparisonEnabled }) => {
  // data base
  const curr = comparisonEnabled ? currItems : (currItems?.length ? currItems : fallbackList);
  const prev = comparisonEnabled ? prevItems : [];

  // agregados para KPIs principales
  const cmp = buildComparison(curr, prev);
  const delta = {
    net: cmp?.prev?.liquido > 0 ? ((cmp.curr.liquido - cmp.prev.liquido) / cmp.prev.liquido) * 100 : null,
    total: cmp?.prev?.total > 0 ? ((cmp.curr.total - cmp.prev.total) / cmp.prev.total) * 100 : null,
    imponible: cmp?.prev?.imponible > 0 ? ((cmp.curr.imponible - cmp.prev.imponible) / cmp.prev.imponible) * 100 : null,
    noImponible: cmp?.prev?.noImponible > 0 ? ((cmp.curr.noImponible - cmp.prev.noImponible) / cmp.prev.noImponible) * 100 : null,
  };

  // obtener registro único típico (por empleado/periodo) para waterfall y métricas finas
  const recCurr = useMemo(() => (curr && curr.length ? normalizeList(curr)[0] : null), [curr]);
  const recPrev = useMemo(() => (prev && prev.length ? normalizeList(prev)[0] : null), [prev]);

  // tabla por periodo
  const gbCurr = groupByPeriodo(curr);
  const gbPrev = groupByPeriodo(prev);
  const allPeriods = Array.from(new Set([...gbPrev.keys(), ...gbCurr.keys()])).sort();

  // chips días/horas (si existen en el registro)
  const diasTrab = Number(recCurr?.dias_trabajados ?? 0);
  const diasLic = Number(recCurr?.dias_licencia ?? 0);
  const he50 = Number(recCurr?.horas_extra_50 ?? recCurr?.hhs_extra_50 ?? 0);

  return (
    <Box sx={{ width: '100%', overflowX: 'hidden' }}>
      {/* Badges de periodo y contador */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <PeriodBadge title={t('employees.payroll.period_current') || 'Periodo actual'} start={windows?.current?.start} end={windows?.current?.end} />
        {comparisonEnabled && <PeriodBadge title={t('employees.payroll.period_previous') || 'Periodo anterior'} start={windows?.previous?.start} end={windows?.previous?.end} />}
        <Chip size="small" label={`${t('employees.payroll.records') || 'registros'}: ${count ?? (curr?.length || 0)}`} className="text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />
        {!!diasTrab && <Chip size="small" label={`${t('employees.report.days_worked') || 'Días trabaj.'}: ${diasTrab}`} className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />}
        {diasLic>0 && <Chip size="small" label={`${t('employees.report.days_off') || 'Licencia'}: ${diasLic}`} className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />}
        {he50>0 && <Chip size="small" label={`HE50: ${he50}`} className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40" />}
      </Stack>

      {/* KPIs compact + barras comparativas */}
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
        <MiniCompareBars
          title={t('employees.payroll.kpi.net') || 'Líquido'}
          curr={cmp.curr.liquido}
          prev={cmp.prev.liquido}
          delta={delta.net}
          goodWhenUp={true}
        />
        <MiniCompareBars
          title={t('employees.payroll.kpi.total') || 'Total'}
          curr={cmp.curr.total}
          prev={cmp.prev.total}
          delta={delta.total}
          goodWhenUp={true}
        />
        <MiniCompareBars
          title={t('employees.payroll.kpi.imponible') || 'Imponible'}
          curr={cmp.curr.imponible}
          prev={cmp.prev.imponible}
          delta={delta.imponible}
          goodWhenUp={true}
        />
        <MiniCompareBars
          title={t('employees.payroll.kpi.no_imponible') || 'No imponible'}
          curr={cmp.curr.noImponible}
          prev={cmp.prev.noImponible}
          delta={delta.noImponible}
          goodWhenUp={false}
        />
      </Box>

      {/* Composición tipo waterfall (curr y prev) */}
      <Box className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        {recCurr && <WaterfallRow title={`${t('common.current') || 'Actual'}`} rec={recCurr} />}
        {comparisonEnabled && recPrev && <WaterfallRow title={`${t('common.previous') || 'Anterior'}`} rec={recPrev} />}
      </Box>

      {/* Highlights rápidos */}
      {comparisonEnabled && (
        <Box className="flex flex-wrap gap-2 mb-2">
          <Box className="inline-flex items-center gap-1 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-full px-2 py-[2px]">
            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.payroll.kpi.net') || 'Líquido'}:</span>
            <DeltaPill value={delta.net} goodWhenUp />
          </Box>
          <Box className="inline-flex items-center gap-1 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-full px-2 py-[2px]">
            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.payroll.kpi.total') || 'Total'}:</span>
            <DeltaPill value={delta.total} goodWhenUp />
          </Box>
          <Box className="inline-flex items-center gap-1 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-full px-2 py-[2px]">
            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.payroll.kpi.imponible') || 'Imponible'}:</span>
            <DeltaPill value={delta.imponible} goodWhenUp />
          </Box>
          <Box className="inline-flex items-center gap-1 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-full px-2 py-[2px]">
            <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('employees.payroll.kpi.no_imponible') || 'No imponible'}:</span>
            <DeltaPill value={delta.noImponible} goodWhenUp={false} />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default PayrollTab;
