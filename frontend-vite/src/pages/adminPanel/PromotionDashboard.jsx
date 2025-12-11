// src/pages/adminPanel/PromotionDashboard.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Eye, Loader2, CheckCircle, AlertTriangle, Key } from 'lucide-react';
import usePromotionAdmin from '../../hooks/usePromotionAdmin';
import usePromotionsData from '../../hooks/usePromotionsData';
import useRestaurantData from '../../hooks/useRestaurantData';
import AdminPromotionCreate from './components/promotions/AdminPromotionCreate';
import AdminPromotionUpdate from './components/promotions/AdminPromotionUpdate';
import AdminCouponList from './components/promotions/AdminCouponList';
import AdminApiKeys from './components/promotions/AdminApiKeys';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'; const PromotionDashboard = ({ appState }) => {
    const { t } = useTranslation();
    const {
        error: adminError,
        isLoading: adminLoading,
        promotions,
        coupons,
        create,
        update,
        reactivate,
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
    const [activeTab, setActiveTab] = useState('create');
    const [fetchedTabs, setFetchedTabs] = useState({
        create: true,
        update: false,
        list: false,
        coupons: false,
    });
    const [formError, setFormError] = useState(null); const handleTabClick = (tabKey) => {
        setActiveTab(tabKey);
        setFetchedTabs((prev) => ({ ...prev, [tabKey]: true }));
        setFormError(null);
        if (tabKey === 'coupons') {
            refetchCoupons();
        }
    }; const tabs = [
        { key: 'create', label: t('promotion.create'), icon: Settings },
        { key: 'update', label: t('promotion.update'), icon: Settings },
        { key: 'coupons', label: t('promotion.coupons'), icon: Eye },
        { key: 'api', label: t('promotion.api_keys'), icon: Key },
    ]; return (
        <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col">
            <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-2xl sm:text-3xl lg:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6 text-center flex items-center justify-center gap-2 sm:gap-3"
            >
                <Settings className="text-matrix-green" size={24} sm={28} lg={36} />
                {t('promotion.dashboard')}
            </motion.h1>
            <AnimatePresence>
                {(adminError || restaurantError) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface/20 dark:bg-dark-surface/20 rounded-lg flex items-center gap-2 shadow-neon-error"
                    >
                        <AlertTriangle size={18} sm={20} className="text-vanellix-purple dark:text-vanellix-purple" />
                        <p className="text-vanellix-purple dark:text-vanellix-purple text-sm sm:text-base">{adminError || restaurantError}</p>
                    </motion.div>
                )}
                {appState.success && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface/20 dark:bg-dark-surface/20 rounded-lg flex items-center gap-2 shadow-neon"
                    >
                        <CheckCircle size={18} sm={20} className="text-matrix-green dark:text-matrix-green" />
                        <span className="text-matrix-green dark:text-matrix-green text-sm sm:text-base">{appState.success}</span>
                    </motion.div>
                )}
                {(adminLoading || restaurantLoading) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface/20 dark:bg-dark-surface/20 rounded-lg flex items-center gap-2 shadow-neon"
                    >
                        <Loader2 size={18} sm={20} className="text-light-text-secondary dark:text-dark-text-secondary animate-spin" />
                        <span className="text-light-text-secondary dark:text-dark-text-secondary animate-pulse text-sm sm:text-base">
                            {t('promotion.loading')}
                        </span>
                    </motion.div>
                )}
                {formError && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mb-6 w-full max-w-3xl mx-auto p-4 bg-light-surface/20 dark:bg-dark-surface/20 rounded-lg flex items-center gap-2 shadow-neon-error"
                    >
                        <AlertTriangle size={18} sm={20} className="text-vanellix-purple dark:text-vanellix-purple" />
                        <p className="text-vanellix-purple dark:text-vanellix-purple text-sm sm:text-base">{formError}</p>
                    </motion.div>
                )}
            </AnimatePresence>  <motion.div
                className="flex justify-center mb-6 sm:mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-2 sm:gap-3 bg-light-surface/50 dark:bg-dark-surface/50 p-2 sm:p-3 rounded-xl border border-light-border/20 dark:border-dark-border/20 w-full">
                    {tabs.map((tab) => (
                        <motion.button
                            key={tab.key}
                            className={`w-full sm:w-auto flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold ${activeTab === tab.key
                                    ? 'bg-gradient-to-r from-matrix-green to-vanellix-cyan text-light-text-primary dark:text-dark-text-primary shadow-neon'
                                    : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface/10 dark:hover:bg-dark-surface/10'
                                }`}
                            onClick={() => handleTabClick(tab.key)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <tab.icon size={16} sm={18} className={activeTab === tab.key ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-matrix-green'} />
                            {tab.label}
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mx-auto w-full max-w-4xl rounded-2xl border border-light-border/20 dark:border-dark-border/20 p-4 sm:p-6 shadow-neon backdrop-blur-md bg-light-surface/90 dark:bg-dark-surface/90"
            >
                <AnimatePresence mode="wait">
                    {activeTab === 'create' && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {(restaurantLoading || !Array.isArray(locations) || !Array.isArray(menus)) ? (
                                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                                    {t('promotion.loading_data') || 'Cargando ubicaciones y menús...'}
                                </div>
                            ) : (
                                <AdminPromotionCreate
                                    appState={appState}
                                    onCreate={async (args) => {
                                        const response = await create(args);
                                        await refreshRestaurantData();
                                        return response;
                                    }}
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
                            )}
                        </motion.div>
                    )}
                    {activeTab === 'update' && (
                        <motion.div
                            key="update"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {(restaurantLoading || !Array.isArray(locations) || !Array.isArray(menus)) ? (
                                <div className="text-center py-8 text-light-text-secondary dark:text-dark-text-secondary">
                                    {t('promotion.loading_data') || 'Cargando ubicaciones y menús...'}
                                </div>
                            ) : (
                                <AdminPromotionUpdate
                                    appState={appState}
                                    onUpdate={async (args) => {
                                        const response = await update(args);
                                        await refreshRestaurantData();
                                        return response;
                                    }}
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
                            )}
                        </motion.div>
                    )}
                    {activeTab === 'coupons' && (
                        <motion.div
                            key="coupons"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <AdminCouponList
                                appState={appState}
                                coupons={coupons}
                                isLoading={adminLoading}
                                onReactivate={reactivate}
                                refetchCoupons={refetchCoupons}
                            />
                        </motion.div>
                    )}
                    {activeTab === 'api' && (
                        <motion.div
                            key="api"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <AdminApiKeys
                                appState={appState}
                                fetchApiToken={fetchApiToken}
                                generateApiToken={generateApiToken}
                                isLoading={adminLoading}
                                setFormError={setFormError}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.section>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                className="mt-16 sm:mt-20"
                toastClassName="bg-light-surface/90 dark:bg-dark-surface/90 text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
            />
        </div>);
}; export default PromotionDashboard;

export const pageMetadata = {
    path: '/app/promotions',
    label: 'promotion.label',
    category: 'admin.category',
    minRoleLevel: 3,
    maxRoleLevel: 4,
    order: 4,
    locations: ['sidebar'],
    description: 'promotion.description',
    icon: 'FaTicketAlt',
};