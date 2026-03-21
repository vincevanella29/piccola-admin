import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import PromotionForm from './PromotionForm';
import { initialFormData } from './PromotionFormUtils';

/* ── Search Modal ──────────────────────────────────────────────────────── */
const SearchPromotion = ({
  isModalOpen,
  setIsModalOpen,
  searchQuery,
  setSearchQuery,
  handleSelectPromotion,
  allPromotions,
  t,
  statusFilter,
  setStatusFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isLoadingPromos,
  hasMore,
  loadMore,
}) => {
  if (!isModalOpen) return null;

  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsModalOpen(false)}
      >
        {/* Modal */}
        <motion.div
          className="relative bg-light-surface dark:bg-dark-surface rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col border border-light-border/30 dark:border-dark-border/30 shadow-2xl"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-light-border/20 dark:border-dark-border/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">
                {t('promotion.select_promotion')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary/60 dark:hover:bg-dark-surface-secondary/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search input */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-light-text-secondary dark:text-dark-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('header.search_placeholder')}
                autoFocus
                className="w-full h-9 pl-9 pr-3 rounded-lg text-sm
                  bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
                  text-light-text-primary dark:text-dark-text-primary
                  border border-light-border/30 dark:border-dark-border/30
                  placeholder:text-light-text-secondary/50 dark:placeholder:text-dark-text-secondary/50
                  focus:outline-none focus:border-light-accent/50 dark:focus:border-dark-accent/50
                  transition-colors"
              />
            </div>

            {/* Filters row */}
            <div className="flex gap-2">
              {/* Status */}
              <div className="flex gap-0.5">
                {[
                  { value: 'all', label: t('promotion.all') },
                  { value: 'active', label: t('promotion.active') },
                  { value: 'inactive', label: t('promotion.inactive') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors
                      ${statusFilter === opt.value
                        ? 'bg-light-accent dark:bg-dark-accent text-white'
                        : 'bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Date filters */}
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-7 px-2 rounded-lg text-[10px] font-medium
                  bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
                  text-light-text-primary dark:text-dark-text-primary
                  border border-light-border/30 dark:border-dark-border/30
                  focus:outline-none"
                title={t('promotion.start_date')}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-7 px-2 rounded-lg text-[10px] font-medium
                  bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40
                  text-light-text-primary dark:text-dark-text-primary
                  border border-light-border/30 dark:border-dark-border/30
                  focus:outline-none"
                title={t('promotion.end_date')}
              />
            </div>
          </div>

          {/* Promotion list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
            {isLoadingPromos && allPromotions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-light-text-secondary dark:text-dark-text-secondary">
                <Loader2 size={20} className="animate-spin mb-2" />
                <p className="text-xs">{t('promotion.loading')}</p>
              </div>
            ) : allPromotions.length > 0 ? (
              <div className="space-y-1">
                {allPromotions.map((promo, idx) => {
                  const key = promo.id || promo._id || `promo-${idx}-${Math.random().toString(36).substr(2, 5)}`;
                  if (!promo.id && !promo._id) return null;

                  const isActive = promo.status ?? true;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectPromotion(promo)}
                      className="w-full text-left px-3 py-3 rounded-xl hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary group-hover:text-light-accent dark:group-hover:text-dark-accent transition-colors truncate">
                          {promo.name || t('common.no_name')}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase
                          ${isActive
                            ? 'bg-light-success/15 text-light-success dark:bg-dark-success/15 dark:text-dark-success'
                            : 'bg-light-error/15 text-light-error dark:bg-dark-error/15 dark:text-dark-error'
                          }`}
                        >
                          {isActive ? t('promotion.active') : t('promotion.inactive')}
                        </span>
                      </div>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary truncate">
                        {promo.description || t('common.no_description')}
                      </p>
                      <div className="flex gap-3 mt-1 text-[10px] text-light-text-secondary/60 dark:text-dark-text-secondary/60">
                        <span>{t('promotion.type')}: {t(`promotion.${promo.reward_type}`)}</span>
                        {promo.created_at && (
                          <span>{new Date(promo.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-light-text-secondary dark:text-dark-text-secondary py-12">
                {t('promotion.no_promotions')}
              </p>
            )}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoadingPromos}
                className="w-full mt-2 py-2 rounded-xl text-xs font-bold text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 disabled:opacity-30 transition-colors"
              >
                {isLoadingPromos ? (
                  <Loader2 size={14} className="animate-spin mx-auto" />
                ) : (
                  t('promotion.load_more')
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

/* ── Helpers ───────────────────────────────────────────────────────────── */
const normalizeTime = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && value.length >= 5) return value.slice(0, 5);
  return String(value);
};

const mapToFormData = (promo) => ({
  status: promo.status ?? true,
  name: promo.name || '',
  description: promo.description || '',
  reward_type: promo.reward_type || 'discount',
  promotion_type: promo.promotion_type || (promo.reward_type === 'product' ? 'P' : 'D'),
  reward_details: promo.reward_details || (promo.reward_type === 'product' ? { discount: 100, type: 'percentage' } : { discount: 0, type: 'percentage' }),
  menu_item_skus: Array.isArray(promo.menu_item_skus) ? promo.menu_item_skus : [promo.menu_item_sku].filter(Boolean),
  display: {
    start: promo.display_start || '',
    end: promo.display_end || '',
    days: promo.display_recurring_every || [],
    from_time: normalizeTime(promo.display_from_time),
    to_time: normalizeTime(promo.display_to_time),
    excluded_dates: promo.display_excluded_dates || [],
  },
  claim: {
    start: promo.claim_start || '',
    end: promo.claim_end || '',
    days: promo.claim_recurring_every || [],
    from_time: normalizeTime(promo.claim_from_time),
    to_time: normalizeTime(promo.claim_to_time),
    excluded_dates: promo.claim_excluded_dates || [],
  },
  redeem: {
    validity: promo.coupon_validity?.validity || 'period',
    valid_from: promo.coupon_validity?.valid_from || '',
    valid_until: promo.coupon_validity?.valid_until || '',
    days: promo.coupon_validity?.recurring_every || [],
    from_time: normalizeTime(promo.coupon_validity?.recurring_from_time),
    to_time: normalizeTime(promo.coupon_validity?.recurring_to_time),
    excluded_dates: promo.coupon_validity?.excluded_dates || [],
    birthday_validity_days: promo.coupon_validity?.birthday_valid_days || 1,
  },
  max_coupon_per_table: promo.max_coupon_per_table || 1,
  max_coupon_per_promo: promo.max_coupon_per_promo || 100,
  max_claims: promo.max_claims || 5,
  max_claims_per_day: promo.max_claims_per_day || null,
  locations: promo.locations || [],
  is_birthday_coupon: promo.is_birthday_coupon || false,
  rules: (promo.rules || []).map((rule) => {
    if (rule.rule_type === 'merit_min_wallet') {
      return {
        ...rule,
        segment_token_id:
          rule.segment_token_id !== undefined && rule.segment_token_id !== null
            ? Number(rule.segment_token_id)
            : null,
        amount: rule.amount !== undefined && rule.amount !== null ? Number(rule.amount) : 0,
      };
    }
    if (rule.rule_type === 'hold_tokens' || rule.rule_type === 'burn_tokens') {
      return { ...rule, amount: rule.amount != null ? Number(rule.amount) : 0 };
    }
    if (rule.rule_type === 'merit_rule_fulfilled') {
      return {
        ...rule,
        merit_rule_name: rule.merit_rule_name || rule.rule_name || '',
        ranking_period: rule.ranking_period || 'current',
      };
    }
    return rule;
  }),
});

/* ── Main Component ────────────────────────────────────────────────────── */
const AdminPromotionUpdate = ({
  onUpdate,
  locations,
  menus,
  promotions,
  isLoading,
  formError,
  setFormError,
  platformTokens,
  tokenDecimals,
  meritSegments,
  meritRules,
  chileTime,
  mediaMap,
  refetchAllPromotions,
}) => {
  const { t } = useTranslation();
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const [formData, setFormData] = useState({ ...initialFormData, menu_item_skus: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allPromotions, setAllPromotions] = useState([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
    setAllPromotions([]);
    setHasMore(true);
    loadPromotions(1);
  }, [debouncedQuery, statusFilter, startDate, endDate]);

  const loadPromotions = useCallback(async (newPage = 1) => {
    setIsLoadingPromos(true);
    try {
      const data = await refetchAllPromotions({
        page: newPage,
        limit: 20,
        query: debouncedQuery,
        status: statusFilter,
        start_date: startDate,
        end_date: endDate,
      });
      const newPromos = data.promotions;
      setAllPromotions((prev) => (newPage === 1 ? newPromos : [...prev, ...newPromos]));
      setHasMore(newPage * 20 < data.total);
    } catch (err) {
      console.error('Error loading promotions:', err);
    } finally {
      setIsLoadingPromos(false);
    }
  }, [debouncedQuery, statusFilter, startDate, endDate, refetchAllPromotions]);

  useEffect(() => {
    if (page > 1) loadPromotions(page);
  }, [page]);

  useEffect(() => {
    setPage(1);
    if (isModalOpen) loadPromotions(1);
  }, [isModalOpen, searchQuery, statusFilter, startDate, endDate]);

  const handleSelectPromotion = (promo) => {
    setFormData(mapToFormData(promo));
    setSelectedPromotion(promo);
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleRemovePromotion = () => {
    setSelectedPromotion(null);
    setFormData({ ...initialFormData, menu_item_skus: [] });
  };

  return (
    <div className="space-y-4">
      {/* Select / Deselect promotion */}
      <div className="space-y-3">
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold
            bg-light-surface dark:bg-dark-surface
            border border-light-border/30 dark:border-dark-border/30
            text-light-text-primary dark:text-dark-text-primary
            hover:border-light-accent/50 dark:hover:border-dark-accent/50
            disabled:opacity-30 transition-colors"
        >
          <Search size={15} className="text-light-accent dark:text-dark-accent" />
          {t('promotion.select_promotion')}
        </button>

        {selectedPromotion && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl
              bg-light-accent/8 dark:bg-dark-accent/8
              border border-light-accent/20 dark:border-dark-accent/20"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-0.5">
                {t('promotion.selected_promotion')}
              </p>
              <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                {selectedPromotion.name}
              </p>
            </div>
            <button
              onClick={handleRemovePromotion}
              className="p-1.5 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error hover:bg-light-error/10 dark:hover:bg-dark-error/10 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </div>

      {/* Form */}
      {selectedPromotion && (
        <PromotionForm
          initialData={formData}
          onSubmit={({ promotionData }) => onUpdate({ promotionId: selectedPromotion.id, promotionData })}
          locations={locations}
          menus={menus}
          isLoading={isLoading}
          formError={formError}
          setFormError={setFormError}
          isUpdate={true}
          platformTokens={platformTokens}
          tokenDecimals={tokenDecimals}
          meritSegments={meritSegments}
          meritRules={meritRules}
          chileTime={chileTime}
          mediaMap={mediaMap}
        />
      )}

      {/* Search modal */}
      <SearchPromotion
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSelectPromotion={handleSelectPromotion}
        allPromotions={allPromotions}
        t={t}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        isLoadingPromos={isLoadingPromos}
        hasMore={hasMore}
        loadMore={() => setPage((p) => p + 1)}
      />
    </div>
  );
};

export default AdminPromotionUpdate;