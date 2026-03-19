import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import MobileEmployeeCard from './MobileEmployeeCard';

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function getDeltaPct(emp) {
  const prev = Number(emp?.payroll?.previous?.net || 0);
  const ante = Number(emp?.payroll?.anteprevious?.net || 0);
  if (ante > 0) return ((prev - ante) / ante) * 100;
  return prev > 0 ? 100 : null;
}

function valueFor(emp, key) {
  switch (key) {
    case 'total': return Number(emp?.payroll?.totals?.total || 0);
    case 'prev': return Number(emp?.payroll?.previous?.net || 0);
    case 'delta': return getDeltaPct(emp);
    case 'sucursal': return String(emp?.sucursal || '');
    default: return null;
  }
}

function cmp(a, b, key, dir) {
  const av = valueFor(a, key);
  const bv = valueFor(b, key);
  const aBad = av == null || (typeof av === 'number' && !isFinite(av));
  const bBad = bv == null || (typeof bv === 'number' && !isFinite(bv));
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  let res = 0;
  if (key === 'sucursal') res = collator.compare(av, bv);
  else res = av === bv ? 0 : (av > bv ? 1 : -1);
  return dir === 'asc' ? res : -res;
}

const MobileEmployeesList = ({ items = [], onSelect, t }) => {
  const [sortBy, setSortBy] = React.useState('total');
  const [sortDir, setSortDir] = React.useState('desc');
  const BATCH = 20;
  const [visibleCount, setVisibleCount] = React.useState(BATCH);
  const sentinelRef = React.useRef(null);

  const sorted = React.useMemo(() => {
    return [...items]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => {
        const res = cmp(a.it, b.it, sortBy, sortDir);
        return res !== 0 ? res : a.i - b.i;
      })
      .map(({ it }) => it);
  }, [items, sortBy, sortDir]);

  React.useEffect(() => { setVisibleCount(BATCH); }, [items, sortBy, sortDir]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) setVisibleCount(c => Math.min(c + BATCH, sorted.length));
      },
      { root: null, rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sorted.length]);

  return (
    <div className="w-full">
      {/* Sort bar */}
      <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl p-2.5 mb-3 flex items-center gap-2">
        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t?.('common.sort') || 'Ordenar'}</span>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border text-xs font-semibold text-light-text-primary dark:text-dark-text-primary min-w-[170px]"
        >
          <option value="total">{t?.('employees.payroll.columns.total_paid') || 'Total sueldos'}</option>
          <option value="prev">{t?.('employees.payroll.columns.net_previous') || 'Sueldo anterior'}</option>
          <option value="delta">{t?.('employees.common.change_pct') || '% cambio'}</option>
          <option value="sucursal">{t?.('employees.table.sucursal') || 'Sucursal'}</option>
        </select>

        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          title={sortDir === 'desc' ? (t?.('common.desc') || 'Descendente') : (t?.('common.asc') || 'Ascendente')}
          className="p-1.5 rounded-lg hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/30 transition text-light-text-secondary dark:text-dark-text-secondary"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary">
          {t?.('employees.payroll.records') || 'registros'}: {items.length}
        </span>
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {sorted.slice(0, visibleCount).map(emp => (
          <MobileEmployeeCard key={String(emp?._id || emp?.rut)} emp={emp} onClick={() => onSelect?.(emp)} t={t} />
        ))}
        {visibleCount < sorted.length && (
          <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
        )}
      </div>
    </div>
  );
};

export default MobileEmployeesList;
