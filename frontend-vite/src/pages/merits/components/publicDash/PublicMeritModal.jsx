import React, { useMemo, useState } from 'react';
import { X, Wallet as WalletIcon, BadgeCheck, Clock, AlertCircle, Image as ImageIcon, ChevronsRight, Trophy, Users, MapPin, BarChart, Calendar, Star, ChevronDown, User, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// --- Constantes y Helpers ---
const fmt = new Intl.NumberFormat('es-CL');
const SEG_ORDER = ['INT', 'END', 'LCK', 'CHA', 'STR', 'AGI', 'PER'];

// --- Componentes de UI Primitivos ---
const Shimmer = ({ className = '' }) => <div className={`bg-dark-surface-secondary/40 animate-pulse rounded ${className}`} />;
const Avatar = ({ src, alt }) => {
  if (!src) {
    return (
      <div className="w-16 h-16 rounded-full border-2 border-dark-border/30 bg-dark-surface-secondary flex items-center justify-center">
        <ImageIcon size={24} className="text-dark-text-secondary opacity-60" />
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-16 h-16 rounded-full border-2 border-dark-border/30 object-cover" />;
};

const MeritBadge = ({ kind, t }) => {
  const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold';
  if (kind === 'minted') return <span className={`${base} border border-emerald-400/30 text-emerald-300 bg-emerald-400/10`}><BadgeCheck size={14}/>{t('merits.modal.badges.minted')}</span>;
  if (kind === 'fulfilled') return <span className={`${base} border-amber-400/30 text-amber-300 bg-amber-400/10`}><Clock size={14}/>{t('merits.modal.badges.pending')}</span>;
  if (kind === 'not_fulfilled') return <span className={`${base} border-rose-400/30 text-rose-300 bg-rose-400/10`}><AlertCircle size={14}/>{t('merits.modal.badges.not')}</span>;
  return null;
};

// --- Componentes Modulares del Modal ---

const ModalHeader = ({ employee, wallet, onClose, loading, t }) => {
  const hasData = employee?.nombre;
  return (
    <div className="flex items-start justify-between p-4 border-b border-dark-border/20 bg-dark-surface/60 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        {loading && !employee?.profile_image_url ? <Shimmer className="w-16 h-16 rounded-full" /> : <Avatar src={employee?.profile_image_url} alt={employee?.nombre} />}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold text-white truncate max-w-[50vw]">
              {hasData ? `${employee.nombre} ${employee.apellido}` : <Shimmer className="h-6 w-48" />}
            </h3>
            {hasData && (
              wallet ? (
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                  <WalletIcon size={14}/> {t('merits.modal.header_wallet_badge')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                  <Clock size={14}/> {t('merits.modal.header_no_wallet_badge')}
                </span>
              )
            )}
          </div>
          <div className="text-sm text-dark-text-secondary truncate mt-1">
            {hasData ? `${employee.cargo} • ${employee.local}` : <Shimmer className="h-4 w-64" />}
          </div>
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-surface-secondary border border-transparent hover:border-dark-border/30 transition-colors">
        <X size={20}/>
      </button>
    </div>
  );
};

const HeroStats = ({ totals, loading, t }) => {
  const hasTotals = totals?.total_points != null;
  return (
    <div className="text-center p-6 rounded-xl bg-dark-surface-secondary/40 border border-dark-border/20">
      <h5 className="text-sm font-semibold text-dark-text-secondary uppercase tracking-wider">{t('merits.modal.totals.total_points')}</h5>
      {loading && !hasTotals ? <Shimmer className="h-16 w-48 mx-auto mt-2" /> : (
        <div className="text-6xl font-bold text-matrix-green my-2">{fmt.format(totals.total_points || 0)}</div>
      )}
      <div className="flex justify-center items-center gap-4 text-xs text-dark-text-secondary mt-4">
        <div className="text-center">
            <span className="font-bold text-white text-base">{hasTotals ? fmt.format(totals.fulfilled_count) : '-'}</span>
            <div>{t('merits.modal.totals.fulfilled_count_short')}</div>
        </div>
        <div className="h-8 border-l border-dark-border/20"></div>
        <div className="text-center">
            <span className="font-bold text-white text-base">{hasTotals ? fmt.format(totals.minted_count) : '-'}</span>
            <div>{t('merits.modal.totals.minted_count_short')}</div>
        </div>
        <div className="h-8 border-l border-dark-border/20"></div>
        <div className="text-center">
            <span className="font-bold text-white text-base">{hasTotals ? fmt.format(totals.not_fulfilled_count) : '-'}</span>
            <div>{t('merits.modal.totals.not_fulfilled_count_short')}</div>
        </div>
      </div>
    </div>
  );
};

const ProfileView = ({ bySegment, segMeta, totals, loading, t }) => (
  <div className="space-y-4 p-1">
    <HeroStats totals={totals} loading={loading} t={t} />
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-white px-2">{t('merits.modal.segment_summary_title')}</h4>
      {loading && Object.keys(bySegment).length === 0 ? (
        Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-10 rounded-lg" />)
      ) : (
        SEG_ORDER.filter(sym => bySegment[sym] || segMeta[sym]).map(sym => {
          const total = (bySegment?.[sym]?.wallet || 0) + (bySegment?.[sym]?.pending || 0);
          return (
            <div key={sym} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-dark-border/20 bg-dark-surface-secondary/30">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold w-10 h-10 flex items-center justify-center rounded-md bg-matrix-green/10 text-matrix-green border border-matrix-green/30">{sym}</span>
                <span className="text-sm text-dark-text-primary capitalize">{segMeta[sym] || sym}</span>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span title={t('merits.modal.segment_pill.wallet_title')} className="text-emerald-400">W: {fmt.format(bySegment?.[sym]?.wallet || 0)}</span>
                <span title={t('merits.modal.segment_pill.pending_title')} className="text-amber-300">P: {fmt.format(bySegment?.[sym]?.pending || 0)}</span>
                <b title={t('merits.modal.segment_pill.total_title')} className="text-white text-sm">Σ: {fmt.format(total)}</b>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

const RequirementItem = ({ icon: Icon, label, value }) => {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /><span className="font-semibold text-dark-text-primary">{label}:</span> <span className="truncate">{String(value)}</span></div>;
};

const ResultItem = ({ icon: Icon, label, rank, total }) => {
  if (rank == null && total == null) return null;
  return <div className="flex items-start gap-2"><Icon size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /> <span className="font-semibold text-dark-text-primary">{label}:</span> <span>{rank != null ? `#${rank}` : 'N/A'} / {total != null ? fmt.format(total) : 'N/A'}</span></div>;
};

const HistoryItem = ({ item, t }) => {
  const { status, mint_status, segment, name, template_key, merit_points, rule_params: rp = {}, placement: plc = {} } = item;
  const sym = segment?.symbol || '???';
  const segName = segment?.name || t('merits.modal.item.unknown_segment');
  
  const positionText = useMemo(() => {
    if (!rp.position_type) return null;
    let text = t(`merits.modal.item.position_type.${rp.position_type}`, rp.position_type);
    if (rp.position_type === 'exact' && rp.ranking_position) text += ` #${rp.ranking_position}`;
    if (rp.position_type === 'top_n' && rp.position_to) text += ` ${rp.position_from || 1}-${rp.position_to}`;
    return text;
  }, [rp, t]);

  return (
    <div className="px-3 py-3 rounded-lg border border-dark-border/20 bg-dark-surface-secondary/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-grow flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-matrix-green/10 text-matrix-green border border-matrix-green/30">{sym}</span>
            <div className="truncate">
              <div className="text-sm font-semibold text-white truncate">{name || template_key || t('merits.modal.item.fallback_rule_name')}</div>
              <div className="text-[11px] text-dark-text-secondary truncate capitalize">{segName}</div>
            </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums text-sm font-bold text-white">{fmt.format(Number(merit_points || 0))} pts</span>
          <MeritBadge kind={mint_status === 'minted' ? 'minted' : status} t={t} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-dark-text-secondary">
        <div className="rounded-md border border-dark-border/10 bg-dark-surface/40 p-2 space-y-1.5">
          <RequirementItem icon={ChevronsRight} label={t('merits.modal.item.scope')} value={t(`merits.modal.item.scope_type.${rp.ranking_scope}`, rp.ranking_scope)} />
          <RequirementItem icon={Trophy} label={t('merits.modal.item.position')} value={positionText} />
          <RequirementItem icon={BarChart} label={t('merits.modal.item.metric')} value={t(`merits.modal.item.metric_type.${rp.metric || rp.metric_key}`, rp.metric || rp.metric_key)} />
          <RequirementItem icon={Calendar} label={t('merits.modal.item.min_days')} value={rp.min_days_worked} />
        </div>
        <div className="rounded-md border border-dark-border/10 bg-dark-surface/40 p-2 space-y-1.5">
          <ResultItem icon={Users} label={t('merits.modal.item.company_rank')} rank={plc.company?.rank} total={plc.company?.total} />
          <ResultItem icon={MapPin} label={t('merits.modal.item.local_rank', { local: plc.local?.local || '...' })} rank={plc.local?.rank} total={plc.local?.total} />
          <div className="flex items-start gap-2 pt-1"><Star size={14} className="mt-0.5 shrink-0 text-dark-text-secondary" /><span className="font-semibold text-dark-text-primary">{t('merits.modal.item.status')}:</span> <span>{t(`merits.modal.item.status_type.${status}`, status)}</span></div>
        </div>
      </div>
    </div>
  );
};

// Helper: compute totals from a list of items
const computeTotalsFromItems = (items = []) => {
  let total_points = 0;
  let fulfilled_count = 0;
  let not_fulfilled_count = 0;
  let minted_count = 0;
  for (const it of items) {
    total_points += Number(it?.merit_points || 0);
    if (it?.mint_status === 'minted') minted_count += 1;
    if (it?.status === 'fulfilled') fulfilled_count += 1;
    if (it?.status === 'not_fulfilled') not_fulfilled_count += 1;
  }
  return { total_points, fulfilled_count, not_fulfilled_count, minted_count };
};

const TotalsBadges = ({ totals, t }) => (
  <div className="flex items-center gap-3 text-[11px] text-dark-text-secondary">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dark-border/30 bg-dark-surface/40 text-white">
      Σ {fmt.format(totals.total_points || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
      {t('merits.modal.totals.fulfilled_count_short')}: {fmt.format(totals.fulfilled_count || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-300">
      {t('merits.modal.totals.minted_count_short')}: {fmt.format(totals.minted_count || 0)}
    </span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-400/30 bg-rose-400/10 text-rose-300">
      {t('merits.modal.totals.not_fulfilled_count_short')}: {fmt.format(totals.not_fulfilled_count || 0)}
    </span>
  </div>
);

const MonthAccordion = ({ period, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const monthTotals = useMemo(() => computeTotalsFromItems(period.items || []), [period]);
  return (
    <div className="rounded-md border border-dark-border/10 bg-dark-surface-secondary/10 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-white hover:bg-dark-surface-secondary/30 transition-colors">
        <span className="uppercase tracking-wider text-[12px] text-dark-text-secondary">{period.periodo}</span>
        <div className="flex items-center gap-3">
          <TotalsBadges totals={monthTotals} t={t} />
          <ChevronDown size={18} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed" animate="open" exit="collapsed"
            variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-dark-border/10"
          >
            <div className="p-3 space-y-2">
              {period.items?.map((item, idx) => <HistoryItem key={item.result_id || idx} item={item} t={t} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const YearAccordion = ({ year, periods, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  // Year totals: sum of month totals
  const yearTotals = useMemo(() => {
    const agg = { total_points: 0, fulfilled_count: 0, not_fulfilled_count: 0, minted_count: 0 };
    periods.forEach(p => {
      const mt = computeTotalsFromItems(p.items || []);
      agg.total_points += mt.total_points;
      agg.fulfilled_count += mt.fulfilled_count;
      agg.not_fulfilled_count += mt.not_fulfilled_count;
      agg.minted_count += mt.minted_count;
    });
    return agg;
  }, [periods]);
  return (
    <div className="rounded-lg border border-dark-border/20 bg-dark-surface-secondary/20 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold text-white hover:bg-dark-surface-secondary/40 transition-colors">
        <span>{year}</span>
        <div className="flex items-center gap-3">
          <TotalsBadges totals={yearTotals} t={t} />
          <ChevronDown size={20} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial="collapsed" animate="open" exit="collapsed"
            variants={{ open: { opacity: 1, height: 'auto' }, collapsed: { opacity: 0, height: 0 } }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-dark-border/20"
          >
            <div className="p-3 space-y-2">
              {periods.map(period => (
                <MonthAccordion key={period.periodo} period={period} t={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HistoryView = ({ history, loading, error, t }) => {
    const groupedHistory = useMemo(() => {
        if (!history || history.length === 0) return {};
        const groups = history.reduce((acc, period) => {
            const year = period.periodo.substring(0, 4);
            if (!acc[year]) acc[year] = [];
            acc[year].push(period);
            return acc;
        }, {});
        // Order years desc and months desc within each year
        const sortedYears = Object.keys(groups).sort((a, b) => b - a);
        const out = {};
        for (const y of sortedYears) {
          out[y] = groups[y].sort((p1, p2) => (p1.periodo < p2.periodo ? 1 : -1));
        }
        return out;
    }, [history]);
    
  return (
    <div className="p-1">
      {loading && !history?.length ? (
        <div className="p-4 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => <Shimmer key={i} className="h-40 w-full" />)}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-rose-300 flex flex-col items-center gap-2">
          <AlertCircle size={32} />
          <p>{t('merits.modal.error_prefix')}</p>
          <p className="text-xs text-rose-300/60">{String(error)}</p>
        </div>
      ) : !history?.length ? (
        <div className="p-12 text-center text-sm text-dark-text-secondary">
          {t('merits.modal.empty_history')}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedHistory).map(([year, periods]) => (
            <YearAccordion key={year} year={year} periods={periods} t={t} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Componente Principal ---
export default function PublicMeritModal({ open, loading, error, data, preview, onClose }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const employee = useMemo(() => (data?.employee || preview?.employee) ?? {}, [data, preview]);
  const wallet = useMemo(() => (data?.wallet ?? preview?.wallet) || employee?.wallet || null, [data, preview, employee]);
  const history = useMemo(() => data?.history || [], [data]);
  const bySegment = useMemo(() => data?.by_segment || preview?.by_segment || {}, [data, preview]);
  const totals = useMemo(() => data?.totals || preview?.totals || {}, [data, preview]);
  const segMeta = useMemo(() => {
    const mp = data?.merit_profile?.segments || preview?.merit_profile?.segments || [];
    const map = {};
    mp.forEach((s) => { if (s?.symbol) map[s.symbol] = s.name || s.symbol; });
    Object.keys(bySegment).forEach((sym) => { if (!map[sym]) map[sym] = sym; });
    return map;
  }, [data, preview, bySegment]);

  if (!open) return null;

  const tabs = [
    { key: 'profile', label: t('merits.modal.tabs.profile'), icon: User },
    { key: 'history', label: t('merits.modal.tabs.history'), icon: Activity },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-5xl h-[75vh] rounded-none sm:rounded-2xl border border-matrix-green/20 bg-gradient-to-b from-[#0f1412] to-[#0b0f0e] shadow-2xl flex flex-col"
      >
        <ModalHeader employee={employee} wallet={wallet} onClose={onClose} loading={loading} t={t} />
        
        {/* Mobile Tabs */}
        <div className="px-4 pt-4 lg:hidden">
            <div className="flex items-center gap-2 p-1 rounded-lg bg-dark-surface-secondary/40 border border-dark-border/20">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === tab.key ? 'bg-dark-surface text-white' : 'text-dark-text-secondary hover:text-white'}`}>
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4">
            {/* Mobile Content */}
            <div className="lg:hidden">
                {activeTab === 'profile' && <ProfileView bySegment={bySegment} segMeta={segMeta} totals={totals} loading={loading} t={t} />}
                {activeTab === 'history' && <HistoryView history={history} loading={loading} error={error} t={t} />}
            </div>
            {/* Desktop Content */}
            <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ProfileView bySegment={bySegment} segMeta={segMeta} totals={totals} loading={loading} t={t} />
                <div className="lg:col-span-2">
                    <HistoryView history={history} loading={loading} error={error} t={t} />
                </div>
            </div>
        </div>
        
        <div className="px-5 py-3 border-t border-dark-border/20 bg-dark-surface/60 flex items-center justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg border border-dark-border/40 bg-dark-surface-secondary hover:border-dark-border/60 hover:bg-dark-surface-secondary/70 transition-colors">
            {t('merits.modal.close_button')}
          </button>
        </div>
      </div>
    </div>
  );
}