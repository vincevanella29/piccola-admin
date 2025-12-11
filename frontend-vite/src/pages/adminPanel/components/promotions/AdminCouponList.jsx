// src/pages/adminPanel/components/promotions/AdminCouponList.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  CalendarIcon, 
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ArrowUturnLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import CouponModal from './CouponModal';

// Componente para el badge de estado
const StatusBadge = ({ status, t }) => {
  const styles = {
    claimed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    redeemed: 'bg-matrix-green/10 text-matrix-green border-matrix-green/20',
    reactivated: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    expired: 'bg-light-text-secondary/10 text-light-text-secondary border-light-text-secondary/20',
  };

  const defaultStyle = 'bg-light-surface-secondary/50 text-light-text-secondary border-light-border/20';
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || defaultStyle} flex items-center gap-1 w-fit`}>
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'redeemed' ? 'bg-matrix-green' : 'bg-current'}`} />
      {t(`promotion.${status}`) || status}
    </span>
  );
};

// Componente Skeleton para carga
const TableSkeleton = () => (
  <div className="animate-pulse space-y-4 p-6">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4">
        <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/6"></div>
        <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/4"></div>
        <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/6"></div>
        <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/12"></div>
        <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/6"></div>
      </div>
    ))}
  </div>
);

const AdminCouponList = ({ appState, coupons: initialCoupons, isLoading: initialLoading, onReactivate, refetchCoupons }) => {
  const { t } = useTranslation();
  
  // Data State
  const [coupons, setCoupons] = useState(initialCoupons || []);
  const [loading, setLoading] = useState(initialLoading);
  const [total, setTotal] = useState(0);
  const [selectedCoupon, setSelectedCoupon] = useState(null);

  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // 10 items por página se ve más limpio en desktop
  
  const [filters, setFilters] = useState({
    wallet: '',
    promotion: '',
    start_date: '',
    end_date: '',
    status: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // Effect para fetch
  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, filters]); // Se dispara cuando cambian los filtros (debounce recomendado en inputs reales)

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const response = await refetchCoupons({
        page,
        limit,
        ...filters
      });
      setCoupons(response.coupons);
      setTotal(response.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset a página 1 al filtrar
  };

  const clearFilters = () => {
    setFilters({
      wallet: '',
      promotion: '',
      start_date: '',
      end_date: '',
      status: ''
    });
    setPage(1);
  };

  const handleReactivate = async (couponCode) => {
    try {
      await onReactivate({ couponCode });
      fetchCoupons();
    } catch (err) {
      console.error(err);
    }
  };

  // Helpers visuales
  const abbreviateWallet = (wallet) => {
    if (!wallet) return 'N/A';
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  };

  const getRewardDisplay = (promotion) => {
    if (!promotion) return <span className="text-light-text-secondary/50">-</span>;
    if (promotion.reward_type === 'discount') {
      return (
        <span className="font-mono font-medium text-light-text-primary dark:text-dark-text-primary">
          {promotion.reward_details.discount}
          {promotion.reward_details.type === 'percentage' ? '%' : '$'}
        </span>
      );
    }
    return <span className="text-xs truncate max-w-[150px] block">{promotion.menu_item_skus?.join(', ')}</span>;
  };

  const totalPages = Math.ceil(total / limit);
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-4"
    >
      {/* HEADER & TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-light-surface dark:bg-dark-surface p-4 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg text-light-text-secondary dark:text-dark-text-secondary">
            <MagnifyingGlassIcon className="h-5 w-5" />
          </div>
          <div>
             <h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">
               {t('promotion.coupons')}
             </h2>
             <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
               {total} registros encontrados
             </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           {/* Search Input Compacto */}
           <div className="relative group">
              <input 
                type="text" 
                placeholder={t('promotion.search_promotion')}
                value={filters.promotion}
                onChange={(e) => handleFilterChange('promotion', e.target.value)}
                className="w-full md:w-64 pl-9 pr-3 py-2 bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-matrix-green/50 transition-all"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-light-text-secondary/60 group-focus-within:text-matrix-green transition-colors" />
           </div>

           {/* Botón Filtros Avanzados */}
           <button 
             onClick={() => setShowFilters(!showFilters)}
             className={`p-2 rounded-xl border transition-all relative ${showFilters || activeFiltersCount > 0 ? 'bg-matrix-green/10 border-matrix-green text-matrix-green' : 'bg-light-background dark:bg-dark-background border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'}`}
           >
             <FunnelIcon className="h-5 w-5" />
             {activeFiltersCount > 0 && (
               <span className="absolute -top-1 -right-1 h-3 w-3 bg-matrix-green rounded-full border border-white dark:border-dark-surface" />
             )}
           </button>

           <button 
             onClick={fetchCoupons}
             className="p-2 rounded-xl bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 text-light-text-secondary dark:text-dark-text-secondary hover:text-matrix-green hover:border-matrix-green/50 transition-all"
           >
             <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      {/* FILTROS AVANZADOS (COLLAPSIBLE) */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-light-surface dark:bg-dark-surface p-4 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-inner grid grid-cols-1 md:grid-cols-4 gap-4">
               <div>
                  <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block uppercase">{t('promotion.search_wallet')}</label>
                  <input
                    type="text"
                    value={filters.wallet}
                    onChange={(e) => handleFilterChange('wallet', e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-matrix-green font-mono"
                  />
               </div>
               <div>
                  <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block uppercase">{t('promotion.status')}</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-matrix-green appearance-none"
                  >
                    <option value="">{t('promotion.all')}</option>
                    <option value="claimed">{t('promotion.claimed')}</option>
                    <option value="redeemed">{t('promotion.redeemed')}</option>
                    <option value="reactivated">{t('promotion.reactivated')}</option>
                  </select>
               </div>
               <div className="md:col-span-2 flex items-end gap-2">
                  <div className="flex-1">
                     <label className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5 block uppercase flex items-center gap-1">
                       <CalendarIcon className="h-3 w-3" /> {t('promotion.period')}
                     </label>
                     <div className="flex items-center gap-2">
                       <input
                         type="date"
                         value={filters.start_date}
                         onChange={(e) => handleFilterChange('start_date', e.target.value)}
                         className="flex-1 px-3 py-2 bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-matrix-green"
                       />
                       <span className="text-light-text-secondary">-</span>
                       <input
                         type="date"
                         value={filters.end_date}
                         onChange={(e) => handleFilterChange('end_date', e.target.value)}
                         className="flex-1 px-3 py-2 bg-light-background dark:bg-dark-background border border-light-border/30 dark:border-dark-border/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-matrix-green"
                       />
                     </div>
                  </div>
                  {activeFiltersCount > 0 && (
                     <button 
                       onClick={clearFilters}
                       className="px-3 py-2 h-[38px] bg-light-error/10 text-light-error hover:bg-light-error/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                     >
                       <XMarkIcon className="h-4 w-4" />
                       Limpiar
                     </button>
                  )}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TABLE */}
      <div className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
             <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-4 rounded-full mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-light-text-secondary/50" />
             </div>
             <h3 className="text-lg font-medium text-light-text-primary dark:text-dark-text-primary">No se encontraron cupones</h3>
             <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Intenta ajustar tus filtros de búsqueda</p>
             {activeFiltersCount > 0 && (
                <button onClick={clearFilters} className="mt-4 text-matrix-green text-sm font-medium hover:underline">
                   Limpiar filtros
                </button>
             )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border-b border-light-border/20 dark:border-dark-border/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.coupon_code')}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.promotion_name')}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.customer')}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.status')}</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.reward')}</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">{t('promotion.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border/10 dark:divide-dark-border/10">
                {coupons.map((coupon) => (
                  <tr key={coupon.coupon_code} className="hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-medium text-light-text-primary dark:text-dark-text-primary bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-2 py-1 rounded">
                        {coupon.coupon_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                         {coupon.promotion?.name || 'N/A'}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="font-mono text-xs text-light-text-secondary dark:text-dark-text-secondary" title={coupon.wallet}>
                         {abbreviateWallet(coupon.wallet)}
                       </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <StatusBadge status={coupon.status} t={t} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-light-text-secondary dark:text-dark-text-secondary">
                       {getRewardDisplay(coupon.promotion)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                       <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedCoupon(coupon)} 
                            className="p-1.5 text-light-text-secondary hover:text-matrix-green hover:bg-matrix-green/10 rounded-lg transition-all"
                            title={t('promotion.view_details')}
                          >
                             <EyeIcon className="h-5 w-5" />
                          </button>
                          {coupon.status === 'redeemed' && (
                            <button 
                              onClick={() => handleReactivate(coupon.coupon_code)} 
                              className="p-1.5 text-light-text-secondary hover:text-vanellix-purple hover:bg-vanellix-purple/10 rounded-lg transition-all"
                              title={t('promotion.reactivate')}
                            >
                               <ArrowUturnLeftIcon className="h-5 w-5" />
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && coupons.length > 0 && (
          <div className="px-6 py-4 border-t border-light-border/20 dark:border-dark-border/20 flex items-center justify-between bg-light-surface-secondary/10 dark:bg-dark-surface-secondary/10">
             <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Mostrando página <span className="font-semibold text-light-text-primary dark:text-dark-text-primary">{page}</span> de <span className="font-semibold">{totalPages}</span>
             </div>
             <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-light-border/30 dark:border-dark-border/30 text-light-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-light-border/30 dark:border-dark-border/30 text-light-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
             </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedCoupon && (
          <CouponModal
            coupon={selectedCoupon}
            onClose={() => setSelectedCoupon(null)}
            onReactivate={handleReactivate}
            t={t}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminCouponList;