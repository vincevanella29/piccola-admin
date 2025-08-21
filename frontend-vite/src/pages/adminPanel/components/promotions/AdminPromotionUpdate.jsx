import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import PromotionForm from './PromotionForm';
import { initialFormData, customSelectStyles } from './PromotionFormUtils';
import { MagnifyingGlassIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import Select from 'react-select';

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
  const statusOptions = [
    { value: 'all', label: t('promotion.all') },
    { value: 'active', label: t('promotion.active') },
    { value: 'inactive', label: t('promotion.inactive') },
  ];

  if (!isModalOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4"
        variants={{
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.8 },
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={() => setIsModalOpen(false)}
      >
        <motion.div
          className="relative bg-light-surface/95 dark:bg-dark-surface/95 rounded-xl p-0 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
          style={{ backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-light-surface/95 dark:bg-dark-surface/95 rounded-t-xl px-6 pt-6 pb-2 flex flex-col">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-error dark:hover:text-dark-error transition-colors"
              aria-label={t('promotion.close')}
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-futurist text-light-text-primary dark:text-dark-text-primary mb-4 text-center">
              {t('promotion.select_promotion')}
            </h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('header.search_placeholder')}
              className="w-full p-3 mb-2 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('promotion.status')}
                </label>
                <Select
                  value={statusOptions.find((opt) => opt.value === statusFilter)}
                  onChange={(opt) => setStatusFilter(opt.value)}
                  options={statusOptions}
                  styles={customSelectStyles}
                  isSearchable={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('promotion.start_date')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">
                  {t('promotion.end_date')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                />
              </div>
            </div>
          </div>
          {/* Scrollable Promotions */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 grid grid-cols-1 gap-4 scrollbar-thin">
            {isLoadingPromos && allPromotions.length === 0 ? (
              <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
                {t('promotion.loading')}
              </p>
            ) : allPromotions.length > 0 ? (
              allPromotions.map((promo, idx) => {
                let key = promo.id || promo._id || `promo-fallback-${idx}-${Math.random().toString(36).substr(2, 5)}`; // Improved fallback: always unique with random suffix to prevent duplicates
                if (!promo.id && !promo._id) {
                  return (
                    <motion.div
                      key={key}
                      style={{ border: '2px solid red', color: 'red', padding: 8, borderRadius: 8 }}
                    >
                      ⚠️ Warning: promotion without unique id (index {idx})
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={key}
                    onClick={() => handleSelectPromotion(promo)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary p-4 rounded-lg transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-light-text-primary dark:text-dark-text-primary">
                        {promo.name || t('common.no_name')}{' '}
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${(promo.status ?? true) ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}
                        >
                          {(promo.status ?? true) ? t('promotion.active') : t('promotion.inactive')}
                        </span>
                        {!(promo.id || promo._id) && (
                          <span className="ml-2 text-xs text-red-500">[id vacío]</span>
                        )}
                      </h4>
                      <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary truncate">
                        {promo.description || t('common.no_description')}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {t('promotion.created_at')}: {promo.created_at ? new Date(promo.created_at).toLocaleDateString() : ''}
                      </p>
                      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        {t('promotion.type')}: {t(`promotion.${promo.reward_type}`)}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">
                {t('promotion.no_promotions')}
              </p>
            )}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoadingPromos}
                className="w-full p-3 bg-matrix-green/20 hover:bg-matrix-green/30 text-light-text-primary dark:text-dark-text-primary rounded-lg transition-all"
              >
                {isLoadingPromos ? t('promotion.loading') : t('promotion.load_more')}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
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
    from_time: promo.display_from_time || null,
    to_time: promo.display_to_time || null,
    excluded_dates: promo.display_excluded_dates || [],
  },
  claim: {
    start: promo.claim_start || '',
    end: promo.claim_end || '',
    days: promo.claim_recurring_every || [],
    from_time: promo.claim_from_time || null,
    to_time: promo.claim_to_time || null,
    excluded_dates: promo.claim_excluded_dates || [],
  },
  redeem: {
    validity: promo.coupon_validity?.validity || 'period',
    valid_from: promo.coupon_validity?.valid_from || '',
    valid_until: promo.coupon_validity?.valid_until || '',
    days: promo.coupon_validity?.recurring_every || [],
    from_time: promo.coupon_validity?.recurring_from_time || null,
    to_time: promo.coupon_validity?.recurring_to_time || null,
    excluded_dates: promo.coupon_validity?.excluded_dates || [],
    birthday_validity_days: promo.coupon_validity?.birthday_valid_days || 1,
  },
  max_coupon_per_table: promo.max_coupon_per_table || 1,
  max_coupon_per_promo: promo.max_coupon_per_promo || 100,
  max_claims: promo.max_claims || 5,
  locations: promo.locations || [],
  is_birthday_coupon: promo.is_birthday_coupon || false,
  rules: promo.rules || [],
});

const AdminPromotionUpdate = ({ onUpdate, locations, menus, promotions, isLoading, formError, setFormError, platformTokens, tokenDecimals, chileTime, mediaMap, refetchAllPromotions }) => {
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

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    setPage(1);
    setAllPromotions([]);
    setHasMore(true);
    loadPromotions(1);
  }, [debouncedQuery, statusFilter, startDate, endDate]);

  const loadPromotions = async (newPage = 1) => {
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
  };

  React.useEffect(() => {
    if (page > 1) {
      loadPromotions(page);
    }
  }, [page]);

  // Reset page to 1 when filters/search change or modal opens
  React.useEffect(() => {
    setPage(1);
    if (isModalOpen) {
      loadPromotions(1);
    }
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="space-y-4">
        <motion.button
          onClick={() => setIsModalOpen(true)}
          className="w-full p-4 bg-gradient-to-r from-matrix-green/30 to-vanellix-cyan/30 dark:from-matrix-green/20 dark:to-vanellix-cyan/20 border border-matrix-green/20 dark:border-matrix-green/10 rounded-xl text-light-text-primary dark:text-dark-text-primary text-center flex items-center justify-center gap-2 hover:bg-matrix-green/40 dark:hover:bg-matrix-green/30 transition-all disabled:opacity-50 shadow-neon"
          disabled={isLoading}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <MagnifyingGlassIcon className="w-5 h-5 text-matrix-green" />
          {t('promotion.select_promotion')}
        </motion.button>
        {selectedPromotion && (
          <>
            <label className="block text-sm font-medium mb-2 text-light-text-secondary dark:text-dark-text-secondary">
              {t('promotion.selected_promotion')}
            </label>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-gradient-to-r from-matrix-green/20 to-vanellix-cyan/20 dark:from-matrix-green/10 dark:to-vanellix-cyan/10 text-vanellix-cyan dark:text-vanellix-cyan px-4 py-2 rounded-full text-sm font-medium shadow-neon hover:shadow-lg transition-all"
            >
              {selectedPromotion.name}
              <XCircleIcon
                className="h-5 w-5 cursor-pointer text-vanellix-purple hover:text-vanellix-purple/70 transition-colors"
                onClick={handleRemovePromotion}
              />
            </motion.div>
          </>
        )}
      </div>

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
          chileTime={chileTime}
          mediaMap={mediaMap}
        />
      )}

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
        page={page}
      />
    </motion.div>
  );
};

export default AdminPromotionUpdate;