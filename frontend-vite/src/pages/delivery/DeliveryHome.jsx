// src/pages/delivery/DeliveryHome.jsx
// Admin panel for delivery home page configuration
// Split-screen: Editor (left) + Live Preview (right)
// Render only — logic in useDeliveryHome hook
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaHome, FaImage, FaSave, FaSpinner, FaRocket,
  FaBullhorn, FaTags, FaBox, FaTh,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useDeliveryHome from '../../hooks/useDeliveryHome';

// Components — home/ subfolder
import LivePreview from './home/LivePreview';
import BannerEditor from './home/BannerEditor';
import PromoEditor from './home/PromoEditor';
import AnnouncementEditor from './home/AnnouncementEditor';
import AssetsPanel from './home/AssetsPanel';
import CategoryEditor from './home/CategoryEditor';

// ── Tab Button ───────────────────────────────────────────────
const Tab = ({ active, icon: Icon, label, onClick, count }) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${active
      ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm'
      : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
    }`}>
    <Icon size={11} />
    {label}
    {count !== undefined && (
      <span className={`text-[9px] px-1 rounded-full ${active ? 'bg-matrix-green/15 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
        {count}
      </span>
    )}
  </button>
);

// ── API Base URL helper ──────────────────────────────────────
const getApiBase = () =>
  import.meta.env.VITE_DEV === 'true'
    ? import.meta.env.VITE_API_URL_DEV
    : (window.env?.VITE_API_URL || import.meta.env.VITE_API_URL);

// ── Main Component ───────────────────────────────────────────
const DeliveryHome = ({ appState }) => {
  const { t } = useTranslation();
  const api = useDeliveryHome(appState, t);

  const [activeTab, setActiveTab] = useState('banners');

  useEffect(() => { api.fetchConfig(); api.fetchTemplates(); }, []);

  const handleSave = () => {
    api.saveConfig({
      hero_banners: api.config?.hero_banners,
      featured_promos: api.config?.featured_promos,
      featured_categories: api.config?.featured_categories,
      announcement: api.config?.announcement,
    });
  };

  if (api.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FaSpinner size={24} className="animate-spin text-matrix-green" />
      </div>
    );
  }

  return (
    <motion.div className="w-full max-w-[1600px] mx-auto p-3 sm:p-4 min-h-screen pb-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaHome className="text-matrix-green" />
            {t?.('delivery.home_label') || 'Home Delivery'}
          </h1>
          <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            Edita en vivo — el preview se actualiza al instante
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={api.saving}
            className="px-3 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-xs font-medium text-light-text-primary dark:text-dark-text-primary transition-colors flex items-center gap-1.5 border border-light-border/10 dark:border-dark-border/10">
            {api.saving ? <FaSpinner size={10} className="animate-spin" /> : <FaSave size={10} />}
            Guardar
          </button>
          <button onClick={api.publish} disabled={api.publishing}
            className="px-3 py-1.5 rounded-xl bg-matrix-green text-white text-xs font-bold hover:bg-matrix-green/90 transition-colors flex items-center gap-1.5 shadow-sm">
            {api.publishing ? <FaSpinner size={10} className="animate-spin" /> : <FaRocket size={10} />}
            Publicar
          </button>
        </div>
      </div>

      {/* ═══ Split Layout ═══ */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Left: Editor Panel ── */}
        <div className="w-full lg:w-[420px] xl:w-[480px] shrink-0">
          {/* Tabs */}
          <div className="flex items-center bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 p-0.5 rounded-xl gap-0.5 border border-light-border/30 dark:border-dark-border/30 mb-3 overflow-x-auto scrollbar-hide">
            <Tab active={activeTab === 'banners'} icon={FaImage} label="Banners" count={api.config?.hero_banners?.length} onClick={() => setActiveTab('banners')} />
            <Tab active={activeTab === 'promos'} icon={FaTags} label="Promos" count={api.config?.featured_promos?.length} onClick={() => setActiveTab('promos')} />
            <Tab active={activeTab === 'categories'} icon={FaTh} label="Categorías" count={api.config?.featured_categories?.length} onClick={() => setActiveTab('categories')} />
            <Tab active={activeTab === 'announcement'} icon={FaBullhorn} label="Anuncio" onClick={() => setActiveTab('announcement')} />
            <Tab active={activeTab === 'assets'} icon={FaBox} label="Assets" count={api.templates?.length} onClick={() => setActiveTab('assets')} />
          </div>

          {/* Active editor */}
          <div className="rounded-2xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/10 dark:border-dark-border/10 p-3">
            {activeTab === 'banners' && (
              <BannerEditor
                banners={api.config?.hero_banners || []}
                onUpdate={api.updateBanners}
                onUploadImage={api.uploadImage}
                uploading={api.uploading}
                appState={appState}
              />
            )}
            {activeTab === 'promos' && (
              <PromoEditor
                promos={api.config?.featured_promos || []}
                onUpdate={api.updatePromos}
                onUploadImage={api.uploadImage}
                uploading={api.uploading}
                appState={appState}
              />
            )}
            {activeTab === 'categories' && (
              <CategoryEditor
                featuredCategories={api.config?.featured_categories || []}
                onUpdate={api.updateFeaturedCategories}
                appState={appState}
                onUploadImage={api.uploadImage}
                uploading={api.uploading}
              />
            )}
            {activeTab === 'announcement' && (
              <AnnouncementEditor
                announcement={api.config?.announcement || {}}
                onUpdate={api.updateAnnouncement}
              />
            )}
            {activeTab === 'assets' && (
              <AssetsPanel
                templates={api.templates || []}
                uploadingTemplates={api.uploadingTemplates}
                onUploadAll={api.uploadAllTemplates}
                apiBaseUrl={getApiBase()}
              />
            )}
          </div>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-4">
            <LivePreview config={api.config} />
          </div>
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </motion.div>
  );
};

export default DeliveryHome;

export const pageMetadata = {
  path: '/app/delivery/home',
  label: 'delivery.home_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 1,
  locations: ['sidebar'],
  description: 'delivery.home_description',
  icon: 'FaHome',
  isSearchable: true,
};
