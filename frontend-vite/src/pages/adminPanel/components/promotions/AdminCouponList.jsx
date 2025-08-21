// src/pages/adminPanel/components/promotions/AdminCouponList.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChevronLeft, FaChevronRight, FaSearch, FaFilter, FaEye, FaRedo } from 'react-icons/fa';
import CouponModal from './CouponModal';

const AdminCouponList = ({ appState, coupons: initialCoupons, isLoading, onReactivate, refetchCoupons }) => {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState(initialCoupons || []);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchWallet, setSearchWallet] = useState('');
  const [searchPromotion, setSearchPromotion] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(isLoading);

  useEffect(() => {
    fetchCoupons();
  }, [page, limit, searchWallet, searchPromotion, startDate, endDate, statusFilter]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await refetchCoupons({
        page,
        limit,
        wallet: searchWallet,
        promotion: searchPromotion,
        start_date: startDate,
        end_date: endDate,
        status: statusFilter,
      });
      setCoupons(response.coupons);
      setTotal(response.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (couponCode) => {
    try {
      await onReactivate({ couponCode });
      fetchCoupons();
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (coupon) => {
    setSelectedCoupon(coupon);
  };

  const closeModal = () => {
    setSelectedCoupon(null);
  };

  const abbreviateWallet = (wallet) => {
    if (!wallet) return 'N/A';
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getStatusBadge = (status) => {
    let color = '';
    switch (status) {
      case 'claimed': color = 'bg-blue-500/20 text-blue-500'; break;
      case 'redeemed': color = 'bg-green-500/20 text-green-500'; break;
      case 'reactivated': color = 'bg-purple-500/20 text-purple-500'; break;
      default: color = 'bg-gray-500/20 text-gray-500';
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{t(`promotion.${status}`)}</span>;
  };

  const getRewardDisplay = (promotion) => {
    if (!promotion) return 'N/A';
    if (promotion.reward_type === 'discount') {
      return `${promotion.reward_details.discount} ${promotion.reward_details.type === 'percentage' ? '%' : '$'} off`;
    } else if (promotion.reward_type === 'product') {
      return `Free products: ${promotion.menu_item_skus.join(', ')}`;
    }
    return 'N/A';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <motion.div className="space-y-6 bg-light-surface/90 dark:bg-dark-surface/90 rounded-2xl p-6 shadow-neon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4 flex items-center gap-2">
        <FaFilter className="text-matrix-green" /> {t('promotion.coupons')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.search_wallet')}</label>
          <input
            type="text"
            value={searchWallet}
            onChange={(e) => setSearchWallet(e.target.value)}
            placeholder={t('promotion.enter_wallet')}
            className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.search_promotion')}</label>
          <input
            type="text"
            value={searchPromotion}
            onChange={(e) => setSearchPromotion(e.target.value)}
            placeholder={t('promotion.enter_promotion')}
            className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.start_date')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.end_date')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.status')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-3 rounded-lg border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-matrix-green"
          >
            <option value="">{t('promotion.all')}</option>
            <option value="claimed">{t('promotion.claimed')}</option>
            <option value="redeemed">{t('promotion.redeemed')}</option>
            <option value="reactivated">{t('promotion.reactivated')}</option>
          </select>
        </div>
      </div>
      <button
        onClick={fetchCoupons}
        className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary font-semibold rounded-xl hover:opacity-90 transition-all shadow-neon mb-6"
      >
        <FaSearch className="inline mr-2" /> {t('promotion.filter')}
      </button>
      {loading ? (
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary animate-pulse">{t('promotion.loading')}</p>
      ) : coupons.length === 0 ? (
        <p className="text-center text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.no_coupons')}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-light-border/20 dark:border-dark-border/20 shadow-neon">
            <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
              <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.coupon_code')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.promotion_name')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.customer')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.status')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.reward')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{t('promotion.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border dark:divide-dark-border">
                {coupons.map((coupon, idx) => (
                  <tr key={coupon.coupon_code || idx} className="hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light-text-primary dark:text-dark-text-primary">{coupon.coupon_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light-text-primary dark:text-dark-text-primary">{coupon.promotion?.name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light-text-primary dark:text-dark-text-primary" title={coupon.wallet}>{abbreviateWallet(coupon.wallet)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(coupon.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light-text-primary dark:text-dark-text-primary">{getRewardDisplay(coupon.promotion)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                      <button onClick={() => openModal(coupon)} className="p-2 bg-matrix-green/20 hover:bg-matrix-green/30 rounded-lg text-matrix-green" title={t('promotion.view_details')}>
                        <FaEye />
                      </button>
                      {coupon.status === 'redeemed' && (
                        <button onClick={() => handleReactivate(coupon.coupon_code)} className="p-2 bg-vanellix-cyan/20 hover:bg-vanellix-cyan/30 rounded-lg text-vanellix-cyan" title={t('promotion.reactivate')}>
                          <FaRedo />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary rounded-lg hover:opacity-90 disabled:opacity-50 shadow-neon flex items-center gap-2"
            >
              <FaChevronLeft /> {t('promotion.previous')}
            </button>
            <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('promotion.page')} {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary rounded-lg hover:opacity-90 disabled:opacity-50 shadow-neon flex items-center gap-2"
            >
              {t('promotion.next')} <FaChevronRight />
            </button>
          </div>
        </>
      )}
      <AnimatePresence>
        {selectedCoupon && (
          <CouponModal
            coupon={selectedCoupon}
            onClose={closeModal}
            onReactivate={handleReactivate}
            t={t}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminCouponList;