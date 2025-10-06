import React, { useMemo } from 'react';
import { X, Wallet as WalletIcon, BadgeCheck, Clock, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const fmt = new Intl.NumberFormat('es-CL');
const SEG_ORDER = ['INT', 'END', 'LCK', 'CHA', 'STR', 'AGI', 'PER'];

function SegmentPill({ sym, label, wallet = 0, pending = 0, t }) {
  const total = (wallet || 0) + (pending || 0);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-dark-border/30 bg-dark-surface-secondary">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-matrix-green/10 text-matrix-green border border-matrix-green/30">{sym}</span>
        <span className="text-sm text-dark-text-primary">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span title={t('merits.modal.segment_pill.wallet_title')} className="text-emerald-400">W: {fmt.format(wallet || 0)}</span>
        <span title={t('merits.modal.segment_pill.pending_title')} className="text-amber-300">P: {fmt.format(pending || 0)}</span>
        <span title={t('merits.modal.segment_pill.total_title')} className="font-semibold text-light-text-primary dark:text-dark-text-primary">
          Σ: {fmt.format(total)}
        </span>
      </div>
    </div>
  );
}

function Badge({ kind, children }) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border';
  if (kind === 'minted') return <span className={`${base} border-emerald-400/30 text-emerald-300 bg-emerald-400/10`}><BadgeCheck size={14}/>{children}</span>;
  if (kind === 'pending') return <span className={`${base} border-amber-400/30 text-amber-300 bg-amber-400/10`}><Clock size={14}/>{children}</span>;
  if (kind === 'not') return <span className={`${base} border-rose-400/30 text-rose-300 bg-rose-400/10`}><AlertCircle size={14}/>{children}</span>;
  return <span className={`${base} border-dark-border/40 text-dark-text-secondary`}>{children}</span>;
}

function Avatar({ src, alt }) {
  if (!src) {
    return (
      <div className="w-12 h-12 rounded-full border border-dark-border/30 bg-dark-surface-secondary flex items-center justify-center">
        <ImageIcon size={18} className="opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-12 h-12 rounded-full border border-dark-border/30 object-cover"
    />
  );
}

// Shimmer skeleton block (no inline <style> to avoid React static flag warnings)
function Shimmer({ className = '' }) {
  return (
    <div className={`bg-dark-surface-secondary/40 animate-pulse ${className}`} />
  );
}

export default function PublicMeritModal({ open, loading, error, data, preview, onClose }) {
  // Hooks must be called unconditionally before any return
  const { t } = useTranslation();

  // usa preview como base, y mergea data cuando llega
  const employee = (data?.employee || preview?.employee) ?? {};
  const wallet = (data?.wallet ?? preview?.wallet) || employee?.wallet || null;
  const history = data?.history || [];
  const bySegment = data?.by_segment || preview?.by_segment || {};
  const totals = data?.totals || preview?.totals || { total_points: 0, fulfilled_count: 0, not_fulfilled_count: 0, minted_count: 0 };

  // etiquetas de segmentos
  const segMeta = useMemo(() => {
    const mp = data?.merit_profile?.segments || preview?.merit_profile?.segments || [];
    const map = {};
    mp.forEach((s) => { if (s?.symbol) map[s.symbol] = s.name || s.symbol; });
    Object.keys(bySegment).forEach((sym) => { if (!map[sym]) map[sym] = sym; });
    return map;
  }, [data, preview, bySegment]);

  // Early return AFTER hooks
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* fondo */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-2xl border border-matrix-green/20 bg-gradient-to-b from-[#0b1210] to-[#0b0f0e] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border/20 bg-dark-surface/60">
            <div className="flex items-center gap-3">
              {loading && !employee?.profile_image_url ? (
                <Shimmer className="w-12 h-12 rounded-full" />
              ) : (
                <Avatar src={employee?.profile_image_url} alt={employee?.nombre} />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold truncate max-w-[50vw]">
                    {employee?.nombre || <Shimmer className="h-4 w-40 rounded" />} {employee?.apellido}
                  </h3>
                  {wallet ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      <WalletIcon size={14}/> {t('merits.modal.header_wallet_badge')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      <Clock size={14}/> {t('merits.modal.header_no_wallet_badge')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-dark-text-secondary truncate">
                  {(employee?.rut && employee?.cargo && employee?.local)
                    ? `${employee.rut} • ${employee.cargo} • ${employee.local}`
                    : <Shimmer className="h-3 w-56 rounded" />}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-surface-secondary border border-dark-border/30">
              <X size={18}/>
            </button>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
            {/* Panel izquierdo: Resumen por segmento */}
            <div className="lg:col-span-1 space-y-3">
              <div className="rounded-xl border border-dark-border/30 p-4 bg-dark-surface-secondary/40">
                <div className="text-sm font-semibold mb-3">{t('merits.modal.segment_summary_title')}</div>
                <div className="space-y-2">
                  {SEG_ORDER.filter(sym => bySegment[sym] || segMeta[sym]).map(sym => (
                    <SegmentPill
                      key={sym}
                      sym={sym}
                      label={segMeta[sym] || sym}
                      t={t}
                      wallet={bySegment?.[sym]?.wallet || 0}
                      pending={bySegment?.[sym]?.pending || 0}
                    />
                  ))}
                  {/* placeholders si aún no hay bySegment */}
                  {Object.keys(bySegment).length === 0 && (
                    <>
                      <Shimmer className="h-10 rounded-lg" />
                      <Shimmer className="h-10 rounded-lg" />
                      <Shimmer className="h-10 rounded-lg" />
                    </>
                  )}
                </div>
                <div className="mt-4 text-xs text-dark-text-secondary">
                  {totals ? (
                    <>
                      <div>{t('merits.modal.totals.total_points')}: <b>{fmt.format(totals?.total_points || 0)}</b></div>
                      <div>
                        {t('merits.modal.totals.fulfilled_count')}: <b>{fmt.format(totals?.fulfilled_count || 0)}</b>
                        {' '}• {t('merits.modal.badges.minted')}: <b>{fmt.format(totals?.minted_count || 0)}</b>
                      </div>
                      <div>{t('merits.modal.totals.not_fulfilled_count')}: <b>{fmt.format(totals?.not_fulfilled_count || 0)}</b></div>
                    </>
                  ) : (
                    <Shimmer className="h-4 w-40 rounded" />
                  )}
                </div>
              </div>
            </div>

            {/* Panel derecho: Historial completo */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-dark-border/30 overflow-hidden">
                <div className="px-4 py-2 border-b border-dark-border/30 bg-dark-surface-secondary/40 text-sm font-semibold">
                  {t('merits.modal.history_title')}
                </div>

                <div className="max-h-[60vh] overflow-auto divide-y divide-dark-border/20">
                  {loading && !data?.history && (
                    <div className="p-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`sk-${i}`} className="mb-3 last:mb-0">
                          <Shimmer className="h-3 w-24 rounded mb-2" />
                          <Shimmer className="h-10 w-full rounded" />
                        </div>
                      ))}
                    </div>
                  )}

                  {error && (
                    <div className="p-6 text-sm text-rose-300">
                      {t('merits.modal.error_prefix')} {String(error)}
                    </div>
                  )}

                  {!loading && !error && (history?.length ?? 0) === 0 && (
                    <div className="p-6 text-sm text-dark-text-secondary">
                      {t('merits.modal.empty_history')}
                    </div>
                  )}

                  {!loading && !error && history?.map(period => (
                    <div key={period.periodo} className="p-4">
                      <div className="text-xs uppercase tracking-wider text-dark-text-secondary mb-3">{period.periodo}</div>
                      <div className="space-y-2">
                        {period.items?.map((it, idx) => {
                          const isFulfilled = it.status === 'fulfilled';
                          const isMinted = it.mint_status === 'minted';
                          const sym = it.segment?.symbol || 'UNK';
                          const segName = it.segment?.name || sym;
                          return (
                            <div key={`${it.result_id || idx}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-dark-border/30 bg-dark-surface-secondary/30">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-matrix-green/10 text-matrix-green border border-matrix-green/30">{sym}</span>
                                  <div className="truncate">
                                    <div className="text-sm font-medium truncate">{it.name || it.template_key || t('merits.modal.item.fallback_rule_name')}</div>
                                    <div className="text-[11px] text-dark-text-secondary truncate">{segName}</div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="tabular-nums text-sm font-semibold">{fmt.format(Number(it.merit_points || 0))}</span>
                                {isMinted ? <Badge kind="minted">{t('merits.modal.badges.minted')}</Badge> : (isFulfilled ? <Badge kind="pending">{t('merits.modal.badges.pending')}</Badge> : <Badge kind="not">{t('merits.modal.badges.not')}</Badge>)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-dark-border/20 bg-dark-surface/60 flex items-center justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-dark-border/30 hover:bg-dark-surface-secondary">
              {t('merits.modal.close_button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
