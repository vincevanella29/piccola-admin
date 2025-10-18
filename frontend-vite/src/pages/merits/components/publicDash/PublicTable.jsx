// src/pages/components/publicDash/PublicTable.jsx
import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Wallet as WalletIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SEG_ORDER = ['INT', 'END', 'LCK', 'CHA', 'STR', 'AGI', 'PER'];
const fmt = new Intl.NumberFormat('es-CL');

function Avatar({ src, alt }) {
  const letter = (alt || '?').trim().slice(0, 1).toUpperCase();
  if (!src) {
    return (
      <div className="w-10 h-10 rounded-full bg-dark-surface-secondary border border-dark-border/30 flex items-center justify-center text-sm font-semibold text-dark-text-secondary">
        {letter || '?'}
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-10 h-10 rounded-full object-cover" />;
}

function SkeletonRow({ cols = 10 }) {
  return (
    <tr className="border-t border-dark-border/10">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 w-full max-w-[120px] bg-dark-surface-secondary/60 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function ThBtn({ children, active, dir, onClick, className = '', title, align = 'left' }) {
  return (
    <th className={`px-3 py-2 text-${align} ${className}`}>
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 group ${active ? 'text-matrix-green' : 'text-light-text-primary dark:text-dark-text-primary'}`}
      >
        <span>{children}</span>
        {!active ? (
          <ArrowUpDown size={14} className="opacity-40 group-hover:opacity-70 transition-opacity" />
        ) : dir === 'asc' ? (
          <span className="text-xs">▲</span>
        ) : (
          <span className="text-xs">▼</span>
        )}
      </button>
    </th>
  );
}

// Obtiene mapas de segmentos desde diferentes nombres posibles (robusto a cambios backend)
function getSegmentMaps(emp) {
  const root = emp.__merit || emp.merits || emp || {};
  const walletBy =
    root.walletBySegment || root.wallet_by || emp.walletBySegment || {};
  const pendingBy =
    root.pendingBySegment || root.pending_by || emp.pendingBySegment || {};
  return { walletBy, pendingBy };
}

function hasWallet(emp) {
  return Boolean(emp.wallet || emp?.merit_profile?.wallet);
}

/**
 * PublicTable (méritos) — columnas por segmento + total + wallet
 * mode: 'wallet' | 'simulated'
 */
export default function PublicTable({ employees = [], loading, mode = 'wallet', onSelectEmployee }) {
  const { t } = useTranslation();
  // --- ordenamiento
  // keys: 'rank' | 'name' | ...SEG_ORDER | 'total' | 'wallet'
  const [sort, setSort] = useState({ key: 'total', dir: 'desc' });
  const toggleSort = (key) =>
    setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  // --- paginación
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const handleChangePageSize = (n) => { setPageSize(n); setPage(1); };

  // --- filtros rápidos (cliente)
  const [q, setQ] = useState('');
  const [fLocal, setFLocal] = useState('all');
  const [fCargo, setFCargo] = useState('all');
  const [fSeccion, setFSeccion] = useState('all');

  // opciones deducidas desde la data visible
  const quickOptions = useMemo(() => {
    const locs = new Set();
    const cargos = new Set();
    const secciones = new Set();
    employees.forEach((e) => {
      if (e?.local) locs.add(String(e.local));
      if (e?.cargo) cargos.add(String(e.cargo));
      if (e?.seccion) secciones.add(String(e.seccion));
    });
    return {
      locales: ['all', ...Array.from(locs).sort()],
      cargos: ['all', ...Array.from(cargos).sort()],
      secciones: ['all', ...Array.from(secciones).sort()],
    };
  }, [employees]);

  // aplicar filtros rápidos antes de cálculo/orden/paginación
  const filteredEmployees = useMemo(() => {
    const term = q.trim().toLowerCase();
    let arr = employees;
    if (term) {
      arr = arr.filter((emp) =>
        (`${emp.nombre || ''} ${emp.apellido || ''}`.toLowerCase().includes(term)) ||
        (String(emp.rut || '').includes(term))
      );
    }
    if (fLocal !== 'all') arr = arr.filter((e) => String(e.local) === fLocal);
    if (fCargo !== 'all') arr = arr.filter((e) => String(e.cargo) === fCargo);
    if (fSeccion !== 'all') arr = arr.filter((e) => String(e.seccion) === fSeccion);
    return arr;
  }, [employees, q, fLocal, fCargo, fSeccion]);

  // Pre-cálculo por fila: usar datos del backend (merits_by_segment y merits_summary)
  const computed = useMemo(() => {
    return filteredEmployees.map((e) => {
      const bySym = {};
      const segList = Array.isArray(e?.merits_by_segment) ? e.merits_by_segment : null;
      const summary = e?.merits_summary || null;

      if (segList && segList.length > 0) {
        // Construir mapa por símbolo desde merits_by_segment
        const segMap = {};
        for (const seg of segList) {
          const sym = seg?.symbol;
          if (!sym) continue;
          const val = mode === 'wallet'
            ? Number(seg?.wallet ?? seg?.total ?? 0)
            : Number(seg?.simulated ?? seg?.total ?? 0);
          segMap[sym] = val;
        }
        SEG_ORDER.forEach((s) => {
          bySym[s] = Number(segMap[s] || 0);
        });
      } else {
        // Fallback: calcular desde estructuras antiguas
        const { walletBy, pendingBy } = getSegmentMaps(e);
        SEG_ORDER.forEach((s) => {
          const w = Number(walletBy?.[s] || 0);
          const p = Number(pendingBy?.[s] || 0);
          bySym[s] = mode === 'wallet' ? w : (w + p);
        });
      }

      // Total preferentemente desde merits_summary
      let total;
      if (summary) {
        total = mode === 'wallet'
          ? Number(summary?.total_wallet || 0)
          : Number(summary?.total_simulated || 0);
      } else {
        total = SEG_ORDER.reduce((acc, s) => acc + (Number(bySym[s]) || 0), 0);
      }

      return { e, bySym, total };
    });
  }, [filteredEmployees, mode]);

  // sort
  const sorted = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...computed].sort((a, b) => {
      if (sort.key === 'rank') {
        const ra = a.e?.puesto_empresa ?? Number.POSITIVE_INFINITY;
        const rb = b.e?.puesto_empresa ?? Number.POSITIVE_INFINITY;
        return (ra - rb) * dir;
      }
      if (sort.key === 'name') {
        const an = `${a.e?.nombre || ''} ${a.e?.apellido || ''}`.trim();
        const bn = `${b.e?.nombre || ''} ${b.e?.apellido || ''}`.trim();
        return an.localeCompare(bn) * dir;
      }
      if (sort.key === 'wallet') {
        const wa = hasWallet(a.e) ? 1 : 0;
        const wb = hasWallet(b.e) ? 1 : 0;
        return (wa - wb) * dir;
      }
      if (sort.key === 'total') {
        return (a.total - b.total) * dir;
      }
      if (SEG_ORDER.includes(sort.key)) {
        return ((a.bySym?.[sort.key] || 0) - (b.bySym?.[sort.key] || 0)) * dir;
      }
      // default
      return (a.total - b.total) * dir;
    });
  }, [computed, sort]);

  const totalRows = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const slice = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="rounded-xl border border-dark-border/20 bg-dark-surface shadow-sm">
      {/* Header filtros rápidos */}
      <div className="flex flex-col md:flex-row gap-2 px-4 py-3 text-xs border-b border-dark-border/10">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder={t('common.search')}
          className="flex-1 min-w-[200px] px-3 py-2 rounded bg-dark-surface-secondary border border-dark-border/30"
        />
        <select
          value={fLocal}
          onChange={(e) => { setFLocal(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded bg-dark-surface-secondary border border-dark-border/30"
          title={t('merits.filters.local')}
        >
          {quickOptions.locales.map((v) => (
            <option key={`ql-${v}`} value={v}>{v === 'all' ? t('merits.filters.all_branches') : v}</option>
          ))}
        </select>
        <select
          value={fCargo}
          onChange={(e) => { setFCargo(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded bg-dark-surface-secondary border border-dark-border/30"
          title={t('merits.filters.cargo')}
        >
          {quickOptions.cargos.map((v) => (
            <option key={`qc-${v}`} value={v}>{v === 'all' ? t('merits.filters.all_roles') : v}</option>
          ))}
        </select>
        <select
          value={fSeccion}
          onChange={(e) => { setFSeccion(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded bg-dark-surface-secondary border border-dark-border/30"
          title={t('merits.filters.seccion', 'Sección')}
        >
          {quickOptions.secciones.map((v) => (
            <option key={`qs-${v}`} value={v}>{v === 'all' ? t('merits.filters.all_sections', 'Todas') : v}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={pageSize}
            onChange={(e) => handleChangePageSize(Number(e.target.value))}
            className="bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1"
            title={t('merits.table.rows_per_page')}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={`ps-${n}`} value={n}>{t('merits.table.per_page_format', { n })}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-dark-surface-secondary/60 sticky top-0 z-10">
            <tr className="text-left">
              <ThBtn
                title={t('merits.table.sort.rank')}
                onClick={() => toggleSort('rank')}
                active={sort.key === 'rank'}
                dir={sort.dir}
                className="w-20"
                align="left"
              >
                {t('merits.table.columns.rank')}
              </ThBtn>

              <ThBtn
                title={t('merits.table.sort.name')}
                onClick={() => toggleSort('name')}
                active={sort.key === 'name'}
                dir={sort.dir}
                className="min-w-[220px]"
                align="left"
              >
                {t('merits.table.columns.employee')}
              </ThBtn>

              <th className="px-3 py-2 text-left">{t('merits.table.columns.local')}</th>
              <th className="px-3 py-2 text-left">{t('merits.table.columns.cargo')}</th>

              {/* Segmentos */}
              {SEG_ORDER.map((sym) => (
                <ThBtn
                  key={`th-${sym}`}
                  title={t('merits.table.sort.segment', { sym })}
                  onClick={() => toggleSort(sym)}
                  active={sort.key === sym}
                  dir={sort.dir}
                  align="right"
                >
                  {sym}
                </ThBtn>
              ))}

              <ThBtn
                title={t('merits.table.sort.total')}
                onClick={() => toggleSort('total')}
                active={sort.key === 'total'}
                dir={sort.dir}
                align="right"
              >
                {mode === 'simulated' ? t('merits.table.columns.total_simulated') : t('merits.table.columns.total_wallet')}
              </ThBtn>

              <ThBtn
                title={t('merits.table.sort.wallet')}
                onClick={() => toggleSort('wallet')}
                active={sort.key === 'wallet'}
                dir={sort.dir}
                className="w-20"
                align="center"
              >
                {t('merits.table.columns.wallet')}
              </ThBtn>
            </tr>
          </thead>

          <tbody className="[&>tr:nth-child(even)]:bg-dark-surface/40">
            {loading && Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
              <SkeletonRow key={`sk-${i}`} cols={6 + SEG_ORDER.length} />
            ))}

            {!loading && slice.length === 0 && (
              <tr>
                <td colSpan={6 + SEG_ORDER.length} className="px-3 py-8 text-center text-dark-text-secondary">
                  {t('merits.table.no_data')}
                </td>
              </tr>
            )}

            {!loading && slice.map(({ e, bySym, total }, idx) => {
              const globalIndex = (currentPage - 1) * pageSize + idx + 1;
              return (
                <tr
                  key={e.rut || `${e.nombre}-${idx}`}
                  className="border-t border-dark-border/10 hover:bg-dark-surface-secondary cursor-pointer transition-colors"
                  onClick={() => onSelectEmployee?.(e)}
                >
                  <td className="px-3 py-3 font-semibold">{e.puesto_empresa ?? globalIndex}</td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={e.profile_image_url} alt={e.nombre} />
                      <div>
                        <div className="font-medium text-light-text-primary dark:text-dark-text-primary">
                          {e.nombre} {e.apellido}
                        </div>
                        <div className="text-xs text-dark-text-secondary">{e.rut}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3">{e.local || '—'}</td>
                  <td className="px-3 py-3">{e.cargo || '—'}</td>

                  {SEG_ORDER.map((sym) => (
                    <td key={`cell-${e.rut}-${sym}`} className="px-3 py-3 tabular-nums text-right">
                      {fmt.format(Number(bySym[sym] || 0))}
                    </td>
                  ))}

                  <td className="px-3 py-3 font-semibold tabular-nums text-right">
                    {fmt.format(total)}
                  </td>

                  <td className="px-3 py-3 text-center">
                    {hasWallet(e)
                      ? <WalletIcon size={18} className="text-matrix-green mx-auto" title={t('merits.table.has_wallet')} />
                      : <span className="text-xs text-dark-text-secondary">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer paginación */}
      <div className="flex items-center justify-between px-4 py-3 text-xs border-t border-dark-border/10">
        <div className="text-dark-text-secondary">
          {t('merits.table.pagination', {
            start: Math.min((currentPage - 1) * pageSize + 1, totalRows),
            end: Math.min(currentPage * pageSize, totalRows),
            total: fmt.format(totalRows),
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border border-dark-border/30 rounded disabled:opacity-40"
            disabled={currentPage <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </button>
          <span className="px-2">{t('merits.table.page_label', { current: currentPage, total: totalPages })}</span>
          <button
            className="px-2 py-1 border border-dark-border/30 rounded disabled:opacity-40"
            disabled={currentPage >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            →
          </button>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="ml-2 bg-dark-surface-secondary border border-dark-border/30 rounded px-2 py-1 text-xs"
            title={t('merits.table.rows_per_page')}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={`ps2-${n}`} value={n}>{t('merits.table.per_page_format', { n })}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
