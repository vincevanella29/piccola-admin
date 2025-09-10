// FILE: src/pages/chat/components/admin/AdminInbox.jsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const PageSizeSelect = ({ value, onChange }) => (
  <select
    className="rounded px-2 py-1 text-sm bg-light-surface-secondary border border-light-border/60 text-light-text-primary dark:bg-dark-surface-secondary dark:border-dark-border/60 dark:text-dark-text-primary"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    aria-label="page-size"
  >
    {[10, 25, 50, 100].map((n) => (
      <option key={n} value={n}>{n}</option>
    ))}
  </select>
);

const Pager = ({ page, onPrev, onNext, t }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onPrev}
      className="p-2 rounded bg-light-surface-tertiary/60 border border-light-border/60 hover:bg-light-surface-tertiary/80 disabled:opacity-60 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/60 dark:hover:bg-dark-surface-tertiary/80"
      disabled={page <= 0}
      aria-label={t('chat.prev')}
      title={t('chat.prev')}
    >
      <FaChevronLeft className="w-4 h-4" />
    </button>
    <div className="text-sm opacity-80 min-w-[72px] text-center">{t('chat.page', { n: page + 1 })}</div>
    <button
      onClick={onNext}
      className="p-2 rounded bg-light-surface-tertiary/60 border border-light-border/60 hover:bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/60 dark:hover:bg-dark-surface-tertiary/80"
      aria-label={t('chat.next')}
      title={t('chat.next')}
    >
      <FaChevronRight className="w-4 h-4" />
    </button>
  </div>
);

const Row = ({ item, isActive, onOpen }) => {
  // Support both enriched shape (user_profile = { wallet, profile, balances, ... })
  // and minimal shape (user_profile = profile object)
  const maybeEnriched = item.user_profile && typeof item.user_profile === 'object' && 'profile' in item.user_profile
    ? item.user_profile
    : null;
  const prof = maybeEnriched ? (maybeEnriched.profile || {}) : (item.user_profile || {});
  const displayName = prof.name || item.display_name || item.user_name || item.wallet || '—';
  const avatar = prof.profile_image_url || item.avatar_url || '';
  const identityWallet = item.wallet || (maybeEnriched && maybeEnriched.wallet) || prof.wallet;
  const identityPrivy = item.privy_id || (maybeEnriched && maybeEnriched.privy_id) || prof.privy_id;
  return (
    <button
      onClick={() => onOpen(item.conv_id)}
      className={`w-full max-w-full overflow-hidden break-words text-left px-3 py-2 rounded border transition min-h-[80px] max-h-[85px] ${isActive ? 'border-matrix-green/60 bg-matrix-green/10' : 'border-light-border/60 dark:border-dark-border/60 hover:bg-light-surface-tertiary/60 dark:hover:bg-dark-surface-tertiary/60'}`}
      style={{maxWidth: '100%'}}>
      <div className="flex items-center gap-2.5 min-w-0 w-full max-w-full overflow-hidden">
        {avatar ? (
          <img
            src={avatar}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover flex-none bg-light-surface/60 border border-light-border/60 dark:bg-dark-surface/60 dark:border-dark-border/60"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-full flex-none bg-light-surface/60 border border-light-border/60 dark:bg-dark-surface/60 dark:border-dark-border/60 flex items-center justify-center text-[12px]">
            {(displayName || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 max-w-full flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-2 text-sm w-full max-w-full overflow-hidden">
            <div className="font-medium truncate min-w-0 max-w-full overflow-hidden">{displayName}</div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.status && <span className="px-1.5 py-0.5 text-[10px] rounded border bg-light-surface-tertiary/60 border-light-border/40 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/40">{item.status}</span>}
              {item.mode && <span className="px-1.5 py-0.5 text-[10px] rounded border bg-light-surface-tertiary/60 border-light-border/40 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/40">{item.mode}</span>}
            </div>
          </div>
          <div className="text-sm opacity-75 leading-snug whitespace-pre-line line-clamp-1 overflow-hidden text-ellipsis max-w-full">{item.last_text || ''}</div>
        </div>
      </div>
      {item.updated_at && (
        <div className="text-[11px] opacity-60 mt-1 truncate">{new Date(item.updated_at).toLocaleString()}</div>
      )}
    </button>
  );
} 

export default function AdminInbox({
  items,
  loading,
  page,
  pageSize,
  statusFilter,
  onChangePage,
  onChangePageSize,
  onChangeStatus,
  onOpen,
  activeConvId,
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-full" style={{maxWidth: '100%'}}>
      {/* Sticky controls */}
      <div className="sticky top-0 z-10 px-3 pt-3 pb-2.5 min-h-[125px] backdrop-blur bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/60 dark:border-dark-border/60 w-full max-w-full min-w-0 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full max-w-full min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 w-full max-w-full min-w-0">
            <label className="text-sm opacity-75 whitespace-nowrap">{t('chat.status')}:</label>
            <select
              className="rounded px-2 py-1 text-sm bg-light-surface-secondary border border-light-border/60 text-light-text-primary dark:bg-dark-surface-secondary dark:border-dark-border/60 dark:text-dark-text-primary"
              value={statusFilter}
              onChange={(e) => onChangeStatus(e.target.value)}
            >
              <option value="open">{t('chat.open')}</option>
              <option value="closed">{t('chat.closed')}</option>
              <option value="all">{t('chat.all')}</option>
            </select>
            <div className="flex items-center gap-2.5">
              <span className="text-sm opacity-75 whitespace-nowrap">{t('chat.per_page')}:</span>
              <PageSizeSelect value={pageSize} onChange={onChangePageSize} />
            </div>
          </div>
          <div className="w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0">
            <Pager page={page} onPrev={() => onChangePage(page - 1)} onNext={() => onChangePage(page + 1)} t={t} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 w-full max-w-full overflow-auto overflow-x-hidden pr-1 md:pr-2 gap-2 pt-2">
        {items?.length === 0 && (
          <div className="text-sm opacity-70">{t('chat.no_conversation')}</div>
        )}
        <AnimatePresence initial={false}>
          {items?.map((it) => (
            <motion.div
              key={it.conv_id}
              layout
              layoutId={`admin-${it.conv_id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.5 }}
            >
              <Row item={it} isActive={activeConvId === it.conv_id} onOpen={onOpen} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
