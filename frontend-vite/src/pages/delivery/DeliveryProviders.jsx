// src/pages/delivery/DeliveryProviders.jsx
// Provider management — Apple-style, fully i18n (es/en/it/pt)
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaCog, FaSync, FaEdit, FaLink, FaTrash,
  FaPause, FaPlay, FaEllipsisV, FaShieldAlt,
  FaStore, FaGlobe, FaLock, FaChevronRight,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useDeliveryProviders from '../../hooks/useDeliveryProviders';
import ProviderModal from './providers/ProviderModal';

/* ── Status mapping ───────────────────────────────────────────── */
const STATUS_MAP = {
  active:   { key: 'prov_status_active',   dot: 'bg-green-500' },
  paused:   { key: 'prov_status_paused',   dot: 'bg-amber-500' },
  disabled: { key: 'prov_status_disabled', dot: 'bg-red-500'   },
};

/* ── External platforms (coming soon) ─────────────────────────── */
const EXTERNAL_PLATFORMS = [
  { id: 'ubereats',   name: 'Uber Eats',   logo: '🟢', status: 'coming_soon' },
  { id: 'pedidosya',  name: 'PedidosYa',   logo: '🟠', status: 'coming_soon' },
  { id: 'rappi',      name: 'Rappi',        logo: '🔴', status: 'coming_soon' },
];

/* ── Own Provider Card ────────────────────────────────────────── */
const OwnProviderCard = ({ provider, t, onEdit, onToggleStatus, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const status = STATUS_MAP[provider.status] || STATUS_MAP.disabled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/10 p-5 transition-all duration-200 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-light-border/20 dark:hover:border-dark-border/20"
    >
      {/* Top row */}
      <div className="flex items-center gap-3.5 mb-3">
        <div className="w-11 h-11 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center text-lg shrink-0">
          🔑
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] text-light-text-primary dark:text-dark-text-primary truncate leading-tight">
            {provider.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1.5 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {t(`delivery.${status.key}`)}
            </span>
            {provider.dilithium_pk && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary font-medium flex items-center gap-1">
                <FaShieldAlt size={7} /> Dilithium2
              </span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
          >
            <FaEllipsisV size={13} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 z-50 bg-light-surface dark:bg-dark-surface border border-light-border/15 dark:border-dark-border/15 rounded-xl shadow-xl py-1 min-w-[150px] backdrop-blur-xl"
              >
                <button
                  onClick={() => { onEdit(provider); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                >
                  <FaEdit size={11} /> {t('delivery.prov_action_edit')}
                </button>
                <button
                  onClick={() => { onToggleStatus(provider); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                >
                  {provider.status === 'active' ? <FaPause size={11} /> : <FaPlay size={11} />}
                  {provider.status === 'active' ? t('delivery.prov_action_pause') : t('delivery.prov_action_activate')}
                </button>
                <hr className="my-1 border-light-border/8 dark:border-dark-border/8" />
                <button
                  onClick={() => { onDelete(provider); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  <FaTrash size={11} /> {t('delivery.prov_action_disable')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
        </div>
      </div>

      {/* Description */}
      <p className="text-[13px] text-light-text-secondary dark:text-dark-text-secondary line-clamp-2 leading-relaxed">
        {provider.description || t('delivery.prov_modal_type_apikey_desc')}
      </p>

      {/* Domain link */}
      {(provider.domain || provider.sync_url) && (
        <div className="flex items-center gap-1.5 mt-3 text-[11px] font-mono text-light-text-secondary dark:text-dark-text-secondary opacity-60">
          <FaLink size={8} />
          <span className="truncate">{provider.domain || provider.sync_url}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-light-border/6 dark:border-dark-border/6">
        <span className="text-[11px] font-mono text-light-text-secondary/40 dark:text-dark-text-secondary/40">
          {provider.slug}
        </span>
        {provider.created_at && (
          <span className="text-[11px] text-light-text-secondary/40 dark:text-dark-text-secondary/40">
            {new Date(provider.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </motion.div>
  );
};

/* ── External Platform Card ───────────────────────────────────── */
const ExternalPlatformCard = ({ platform, t }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/10 p-5 opacity-50"
  >
    <div className="absolute top-4 right-4">
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
        {t('delivery.prov_ext_coming_soon')}
      </span>
    </div>

    <div className="flex items-center gap-3.5 mb-3">
      <div className="w-11 h-11 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl flex items-center justify-center text-xl shrink-0">
        {platform.logo}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[15px] text-light-text-primary dark:text-dark-text-primary">
          {platform.name}
        </h3>
        <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1">
          <FaGlobe size={8} /> Webhook
        </span>
      </div>
    </div>

    <div className="mt-3 px-3 py-2.5 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-lg">
      <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-1.5">
        <FaLock size={8} className="opacity-40" />
        {t('delivery.prov_ext_requires', { name: platform.name })}
      </p>
    </div>
  </motion.div>
);


/* ── Main Component ───────────────────────────────────────────── */
const DeliveryProviders = ({ appState }) => {
  const { t } = useTranslation();
  const api = useDeliveryProviders(appState, t);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [modalMode, setModalMode] = useState('own');

  useEffect(() => {
    api.fetchProviders();
    api.fetchProviderPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownProviders = api.providers.filter((p) => p.type === 'api_key');
  const externalProviders = api.providers.filter((p) => p.type === 'webhook');

  const handleAddOwn = () => { setModalMode('own'); setEditingProvider(null); setIsModalOpen(true); };
  const handleEdit = (provider) => { setModalMode(provider.type === 'webhook' ? 'external' : 'own'); setEditingProvider(provider); setIsModalOpen(true); };
  const handleSave = async (data, providerId) => { if (providerId) await api.updateProvider(providerId, data); else await api.createProvider(data); };
  const handleAutoLink = async (data) => await api.autoLinkProvider(data);
  const handleToggleStatus = async (provider) => { await api.updateProvider(provider._id, { status: provider.status === 'active' ? 'paused' : 'active' }); };
  const handleDelete = async (provider) => { if (!window.confirm(t('delivery.prov_action_disable_confirm', { name: provider.name }))) return; await api.deleteProvider(provider._id); };

  return (
    <motion.div
      className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">
            {t('delivery.prov_title')}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            {t('delivery.prov_subtitle')}
          </p>
        </div>
        <button
          onClick={() => api.fetchProviders()}
          className="px-4 py-2 bg-light-surface dark:bg-dark-surface border border-light-border/15 dark:border-dark-border/15 hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium transition-colors text-sm flex items-center gap-2"
        >
          <FaSync size={11} className={api.isLoading ? 'animate-spin' : ''} />
          {t('delivery.prov_refresh')}
        </button>
      </div>

      {/* ══ Section 1: Own Delivery ═══════════════════════════ */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-matrix-green/8 flex items-center justify-center">
              <FaStore className="text-matrix-green" size={13} />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-light-text-primary dark:text-dark-text-primary tracking-tight">
                {t('delivery.prov_own_title')}
              </h2>
              <p className="text-[12px] text-light-text-secondary dark:text-dark-text-secondary">
                {t('delivery.prov_own_subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={handleAddOwn}
            className="px-4 py-2 bg-matrix-green text-white rounded-xl font-semibold text-sm hover:bg-matrix-green/90 transition-all flex items-center gap-2 shadow-sm active:scale-[0.97]"
          >
            <FaShieldAlt size={11} /> {t('delivery.prov_own_link')}
          </button>
        </div>

        {api.isLoading && ownProviders.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-light-surface dark:bg-dark-surface rounded-2xl p-5 animate-pulse border border-light-border/5 dark:border-dark-border/5">
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-11 h-11 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-2/3" />
                    <div className="h-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : ownProviders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-light-border/15 dark:border-dark-border/15 rounded-2xl bg-light-surface/50 dark:bg-dark-surface/50">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-matrix-green/8 flex items-center justify-center">
              <FaShieldAlt className="text-matrix-green/50" size={24} />
            </div>
            <p className="text-light-text-primary dark:text-dark-text-primary font-semibold text-[15px]">
              {t('delivery.prov_own_empty_title')}
            </p>
            <p className="text-[13px] text-light-text-secondary dark:text-dark-text-secondary mt-1 max-w-sm mx-auto">
              {t('delivery.prov_own_empty_desc')}
            </p>
            <button
              onClick={handleAddOwn}
              className="mt-5 px-5 py-2.5 bg-matrix-green text-white rounded-xl font-semibold text-sm hover:bg-matrix-green/90 transition-all inline-flex items-center gap-2 shadow-sm active:scale-[0.97]"
            >
              <FaShieldAlt size={11} /> {t('delivery.prov_own_empty_cta')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ownProviders.map((p) => (
              <OwnProviderCard key={p._id} provider={p} t={t} onEdit={handleEdit} onToggleStatus={handleToggleStatus} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* ══ Section 2: External Integrations ════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center">
            <FaGlobe className="text-light-text-secondary dark:text-dark-text-secondary" size={13} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-light-text-primary dark:text-dark-text-primary tracking-tight">
              {t('delivery.prov_ext_title')}
            </h2>
            <p className="text-[12px] text-light-text-secondary dark:text-dark-text-secondary">
              {t('delivery.prov_ext_subtitle')}
            </p>
          </div>
        </div>

        {externalProviders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {externalProviders.map((p) => (
              <OwnProviderCard key={p._id} provider={p} t={t} onEdit={handleEdit} onToggleStatus={handleToggleStatus} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXTERNAL_PLATFORMS.map((platform) => (
            <ExternalPlatformCard key={platform.id} platform={platform} t={t} />
          ))}
        </div>
      </section>

      {/* Provider Modal */}
      <ProviderModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingProvider(null); }}
        onSave={handleSave}
        onAutoLink={handleAutoLink}
        onResync={(providerId) => api.resyncProvider(providerId)}
        provider={editingProvider}
        presets={api.providerPresets}
        mode={modalMode}
        t={t}
        appState={appState}
      />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        className="mt-16 sm:mt-20"
        toastClassName="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-neon rounded-lg"
      />
    </motion.div>
  );
};

export default DeliveryProviders;

export const pageMetadata = {
  path: '/app/delivery/providers',
  label: 'delivery.providers_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  locations: ['sidebar'],
  description: 'delivery.providers_description',
  icon: 'FaCog',
  isSearchable: true,
};
