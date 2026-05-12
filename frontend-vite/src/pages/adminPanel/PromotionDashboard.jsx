// src/pages/adminPanel/PromotionDashboard.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Eye, Loader2, AlertTriangle, Key, PlusCircle, RefreshCcw, Building2 } from 'lucide-react';
import usePromotionAdmin from '../../hooks/usePromotionAdmin';
import usePromotionsData from '../../hooks/usePromotionsData';
import useRestaurantData from '../../hooks/useRestaurantData';
import AdminPromotionCreate from './components/promotions/AdminPromotionCreate';
import AdminPromotionUpdate from './components/promotions/AdminPromotionUpdate';
import AdminCouponList from './components/promotions/AdminCouponList';
import AdminApiKeys from './components/promotions/AdminApiKeys';
import AdminB2BPartners from './components/promotions/AdminB2BPartners';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const TABS = [
  { key: 'create', icon: PlusCircle,   labelKey: 'promotion.create'   },
  { key: 'update', icon: RefreshCcw,   labelKey: 'promotion.update'   },
  { key: 'coupons',icon: Eye,          labelKey: 'promotion.coupons'  },
  { key: 'api',    icon: Key,          labelKey: 'promotion.api_keys' },
  { key: 'b2b',    icon: Building2,    labelKey: 'promotion.b2b_partners' },
];

const PromotionDashboard = ({ appState }) => {
  const { t } = useTranslation();
  const {
    error: adminError,
    isLoading: adminLoading,
    promotions,
    coupons,
    create,
    update,
    reactivate,
    redeem,
    refetchAllPromotions,
    refetchCoupons,
    platformTokens,
    tokenDecimals,
    meritSegments,
    meritRules,
    fetchApiToken,
    generateApiToken,
  } = usePromotionAdmin(appState, t);

  const { locations, menus, isLoading: restaurantLoading, error: restaurantError, refresh: refreshRestaurantData } = usePromotionsData(appState);
  const { data: restaurantData } = useRestaurantData();
  const [activeTab, setActiveTab]     = useState('create');
  const [formError, setFormError]     = useState(null);

  const handleTabClick = key => {
    setActiveTab(key);
    setFormError(null);
    if (key === 'coupons') refetchCoupons();
  };

  const isLoading = adminLoading || restaurantLoading;
  const anyError  = adminError || restaurantError;

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-10 flex flex-col gap-5">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <Settings className="text-matrix-green" size={22} />
            {t('promotion.dashboard')}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            {t('promotion.description')}
          </p>
        </div>

        {/* Status indicators */}
        {isLoading && (
          <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">{t('promotion.loading')}</span>
          </div>
        )}
      </div>

      {/* ── ERROR BANNERS ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {(anyError || formError) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2.5 p-3 bg-light-error/8 dark:bg-dark-error/8 border border-light-error/20 dark:border-dark-error/20 rounded-xl text-sm text-light-error dark:text-dark-error"
          >
            <AlertTriangle size={15} className="shrink-0" />
            <span>{formError || anyError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LAYOUT: tabs sidebar (md+) | top bar (mobile) ─────────── */}
      <div className="flex flex-col md:flex-row gap-4 flex-1">

        {/* TABS — horizontal on mobile, vertical pill list on desktop */}
        <nav className="md:w-48 shrink-0">
          {/* Mobile: horizontal scroll bar */}
          <div className="flex md:hidden gap-1 p-1 bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/30 dark:border-dark-border/30 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2 px-2 rounded-xl text-[10px] font-bold transition-all ${
                    active
                      ? 'bg-matrix-green/10 text-matrix-green'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }`}
                >
                  <Icon size={14} />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical pill nav */}
          <div className="hidden md:flex flex-col gap-1 p-1.5 bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/30 dark:border-dark-border/30 sticky top-6">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    active
                      ? 'bg-matrix-green/10 text-matrix-green'
                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50 hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }`}
                >
                  <Icon size={15} className={active ? 'text-matrix-green' : ''} />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* TAB CONTENT */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'create' && (
                restaurantLoading || !Array.isArray(locations) || !Array.isArray(menus) ? (
                  <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    {t('promotion.loading_data')}
                  </div>
                ) : (
                  <AdminPromotionCreate
                    appState={appState}
                    onCreate={async args => { const r = await create(args); await refreshRestaurantData(); return r; }}
                    locations={locations}
                    menus={menus}
                    isLoading={adminLoading}
                    setFormError={setFormError}
                    platformTokens={platformTokens}
                    tokenDecimals={tokenDecimals}
                    meritSegments={meritSegments}
                    meritRules={meritRules}
                    chileTime={appState.chileTime}
                    mediaMap={restaurantData.mediaMap || {}}
                  />
                )
              )}

              {activeTab === 'update' && (
                restaurantLoading || !Array.isArray(locations) || !Array.isArray(menus) ? (
                  <div className="text-center py-12 text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    {t('promotion.loading_data')}
                  </div>
                ) : (
                  <AdminPromotionUpdate
                    appState={appState}
                    onUpdate={async args => { const r = await update(args); await refreshRestaurantData(); return r; }}
                    locations={locations}
                    menus={menus}
                    promotions={promotions}
                    isLoading={adminLoading}
                    formError={formError}
                    setFormError={setFormError}
                    platformTokens={platformTokens}
                    tokenDecimals={tokenDecimals}
                    meritSegments={meritSegments}
                    meritRules={meritRules}
                    chileTime={appState.chileTime}
                    mediaMap={restaurantData.mediaMap || {}}
                    refetchAllPromotions={refetchAllPromotions}
                  />
                )
              )}

              {activeTab === 'coupons' && (
                <AdminCouponList
                  appState={appState}
                  coupons={coupons}
                  isLoading={adminLoading}
                  onReactivate={reactivate}
                  onRedeem={redeem}
                  refetchCoupons={refetchCoupons}
                />
              )}

              {activeTab === 'api' && (
                <AdminApiKeys
                  appState={appState}
                  fetchApiToken={fetchApiToken}
                  generateApiToken={generateApiToken}
                  isLoading={adminLoading}
                  setFormError={setFormError}
                />
              )}

              {activeTab === 'b2b' && (
                <AdminB2BPartners
                  appState={appState}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface/90 dark:bg-dark-surface/90 text-light-text-primary dark:text-dark-text-primary shadow-lg rounded-xl"
      />
    </div>
  );
};

export default PromotionDashboard;

export const pageMetadata = {
  path: '/app/promotions',
  label: 'promotion.label',
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 6,
  locations: ['sidebar'],
  description: 'promotion.description',
  icon: 'FaTicketAlt',
};