import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaShippingFast, FaPlus, FaSync, FaTrash, FaEdit,
  FaPause, FaPlay, FaEllipsisV, FaFlask, FaRocket, FaPlug,
  FaBell, FaSpinner, FaCheckCircle, FaTimesCircle, FaExchangeAlt,
  FaCopy,
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import useDeliveryCarriers from '../../hooks/delivery/useDeliveryCarriers';
import CarrierModal from './carriers/CarrierModal';
import TestOrderPanel from './carriers/TestOrderPanel';
import CoverageTester from './carriers/CoverageTester';
import { registerWebhook, getWebhookStatus, disableWebhook } from '../../utils/deliveryData';

// ── Carrier card ─────────────────────────────────────────────
const CARRIER_EMOJIS = {
  uber_direct: '🔵',
  pedidosya: '🟠',
  getjusto: '🟣',
};

const MODE_STYLES = {
  test: { icon: FaFlask, bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Test' },
  production: { icon: FaRocket, bg: 'bg-green-500/10', text: 'text-green-500', label: 'Producción' },
};

const CarrierCard = ({ carrier, onEdit, onToggleStatus, onDelete, appState }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [registering, setRegistering] = useState(false);
  const isActive = carrier.status === 'active';
  const modeStyle = MODE_STYLES[carrier.mode] || MODE_STYLES.test;
  const ModeIcon = modeStyle.icon;

  // Load webhook status on mount
  useEffect(() => {
    if (!isActive || !appState?.token) return;
    const load = async () => {
      setLoadingWebhook(true);
      try {
        const res = await getWebhookStatus({
          token: appState.token,
          walletAddress: appState.account,
          carrierSlug: carrier.slug,
        });
        setWebhookInfo(res);
      } catch {
        // silent
      } finally {
        setLoadingWebhook(false);
      }
    };
    load();
  }, [carrier.slug, isActive, appState?.token]);

  const handleDisableWebhook = async () => {
    setRegistering(true);
    try {
      const res = await disableWebhook({
        token: appState.token,
        walletAddress: appState.account,
        carrierSlug: carrier.slug,
      });
      toast.success(res.message || 'Webhook desactivado → polling 30s');
      setWebhookInfo({ ...webhookInfo, status: 'disabled', callback_url: null });
    } catch (err) {
      toast.error(err.message || 'Error desactivando webhook');
    } finally {
      setRegistering(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    try {
      const res = await registerWebhook({
        token: appState.token,
        walletAddress: appState.account,
        carrierSlug: carrier.slug,
      });
      toast.success(res.message || 'Webhook registrado');
      setWebhookInfo({
        ...webhookInfo,
        callback_url: res.callback_url,
        status: res.manual ? 'manual' : 'active',
      });
    } catch (err) {
      toast.error(err.message || 'Error registrando webhook');
    } finally {
      setRegistering(false);
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  };

  const webhookStatus = webhookInfo?.status || carrier.webhook?.status || 'not_registered';
  const callbackUrl = webhookInfo?.callback_url || carrier.webhook?.callback_url;

  const WEBHOOK_STYLES = {
    active:         { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Webhook activo', icon: FaCheckCircle },
    manual:         { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Manual (registrar en dashboard)', icon: FaBell },
    pending:        { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Pendiente', icon: FaBell },
    disabled:       { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Desactivado → polling 30s', icon: FaExchangeAlt },
    not_registered: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Sin webhook → polling 30s', icon: FaExchangeAlt },
  };
  const whStyle = WEBHOOK_STYLES[webhookStatus] || WEBHOOK_STYLES.not_registered;
  const WhIcon = whStyle.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-2xl p-5 hover:shadow-lg transition-shadow group relative"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl flex items-center justify-center text-xl shrink-0">
          {CARRIER_EMOJIS[carrier.slug] || '🚚'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-light-text-primary dark:text-dark-text-primary truncate">{carrier.name}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
            }`}>
              {isActive ? 'Activo' : 'Desactivado'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${modeStyle.bg} ${modeStyle.text} flex items-center gap-1`}>
              <ModeIcon size={8} /> {modeStyle.label}
            </span>
            <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono">
              {carrier.auth?.type === 'oauth2' ? 'OAuth2' : 'API Key'}
            </span>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors"
          >
            <FaEllipsisV size={14} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-10 z-50 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 rounded-xl shadow-xl py-1 min-w-[160px]"
              >
                <button
                  onClick={() => { onEdit(carrier); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                >
                  <FaEdit size={12} /> Editar
                </button>
                <button
                  onClick={() => { onToggleStatus(carrier); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-light-text-primary dark:text-dark-text-primary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                >
                  {isActive ? <FaPause size={12} /> : <FaPlay size={12} />}
                  {isActive ? 'Desactivar' : 'Activar'}
                </button>
                <hr className="my-1 border-light-border/10 dark:border-dark-border/10" />
                <button
                  onClick={() => { onDelete(carrier); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  <FaTrash size={12} /> Eliminar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}
        </div>
      </div>

      <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary line-clamp-2">
        {carrier.description || carrier.slug}
      </p>

      {carrier.endpoints?.base_url && (
        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
          <FaPlug size={8} />
          <span className="truncate">{carrier.endpoints.base_url}</span>
        </div>
      )}

      {/* Webhook / Sync Status */}
      {isActive && (
        <div className="mt-3 pt-3 border-t border-light-border/10 dark:border-dark-border/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <WhIcon size={10} className={whStyle.text} />
              <span className={`text-[10px] font-semibold ${whStyle.text}`}>{whStyle.label}</span>
            </div>
            {(webhookStatus === 'not_registered' || webhookStatus === 'pending' || webhookStatus === 'disabled') ? (
              <button
                onClick={handleRegisterWebhook}
                disabled={registering}
                className="text-[10px] px-2.5 py-1 rounded-lg font-semibold bg-matrix-green/10 text-matrix-green border border-matrix-green/30 hover:bg-matrix-green/20 transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {registering ? <FaSpinner size={8} className="animate-spin" /> : <FaBell size={8} />}
                {registering ? 'Registrando...' : 'Registrar Webhook'}
              </button>
            ) : (webhookStatus === 'active' || webhookStatus === 'manual') ? (
              <button
                onClick={handleDisableWebhook}
                disabled={registering}
                className="text-[10px] px-2.5 py-1 rounded-lg font-semibold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {registering ? <FaSpinner size={8} className="animate-spin" /> : <FaTimesCircle size={8} />}
                {registering ? 'Desactivando...' : 'Usar Polling'}
              </button>
            ) : null}
          </div>
          {callbackUrl && (
            <div className="flex items-center gap-1 mt-1.5">
              <code className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono truncate flex-1 bg-light-surface-secondary dark:bg-dark-surface-secondary px-2 py-1 rounded-lg">
                {callbackUrl}
              </code>
              <button
                onClick={() => copyUrl(callbackUrl)}
                className="p-1 rounded-md hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary transition-colors shrink-0"
                title="Copiar URL"
              >
                <FaCopy size={10} />
              </button>
            </div>
          )}
          {webhookStatus === 'manual' && (
            <p className="text-[9px] text-amber-500/80 mt-1 italic">
              Registra esta URL en el dashboard de {carrier.name}
            </p>
          )}
        </div>
      )}

      {carrier.created_at && (
        <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
          Creado: {new Date(carrier.created_at).toLocaleDateString('es-CL')}
        </p>
      )}
    </motion.div>
  );
};

// ── Main Component ───────────────────────────────────────────
const DeliveryCarriers = ({ appState }) => {
  const { t } = useTranslation();
  const api = useDeliveryCarriers(appState, t);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState(null);

  useEffect(() => {
    api.fetchCarriers();
    api.fetchCarrierPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditingCarrier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (carrier) => {
    setEditingCarrier(carrier);
    setIsModalOpen(true);
  };

  const handleSave = async (data, carrierId) => {
    if (carrierId) {
      await api.updateCarrier(carrierId, data);
    } else {
      await api.createCarrier(data);
    }
  };

  const handleToggleStatus = async (carrier) => {
    const newStatus = carrier.status === 'active' ? 'disabled' : 'active';
    await api.updateCarrier(carrier._id, { status: newStatus });
  };

  const handleDelete = async (carrier) => {
    if (!window.confirm(`¿Eliminar carrier "${carrier.name}"?`)) return;
    await api.deleteCarrier(carrier._id);
  };

  return (
    <motion.div
      className="w-full max-w-[1400px] mx-auto p-4 sm:p-6 min-h-screen pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-futurist font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-3">
            <FaShippingFast className="text-matrix-green" />
            {t?.('delivery.carriers_title') || 'Carriers de Última Milla'}
          </h1>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
            Configura Uber Direct, PedidosYa, GetJusto u otros servicios de despacho
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => api.fetchCarriers()}
            className="px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary rounded-xl font-medium transition-colors text-sm flex items-center gap-2 border border-light-border/10 dark:border-dark-border/10"
          >
            <FaSync size={12} className={api.isLoading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-matrix-green text-white rounded-xl font-semibold text-sm hover:bg-matrix-green/90 transition-colors flex items-center gap-2 shadow-sm"
          >
            <FaPlus size={12} /> Agregar Carrier
          </button>
        </div>
      </div>

      {/* Content */}
      {api.isLoading && api.carriers.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-light-surface dark:bg-dark-surface rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-2/3" />
                  <div className="h-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded w-full" />
            </div>
          ))}
        </div>
      ) : api.carriers.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-light-border/20 dark:border-dark-border/20 rounded-2xl">
          <FaShippingFast className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-4" size={48} />
          <p className="text-light-text-secondary dark:text-dark-text-secondary font-semibold text-lg">
            No hay carriers configurados
          </p>
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2 max-w-md mx-auto">
            Agrega Uber Direct, PedidosYa o GetJusto para despachar pedidos.
            Puedes empezar en modo Test con credenciales sandbox.
          </p>
          <button
            onClick={handleAdd}
            className="mt-6 px-5 py-2.5 bg-matrix-green text-white rounded-xl font-semibold text-sm hover:bg-matrix-green/90 transition-colors inline-flex items-center gap-2 shadow-sm"
          >
            <FaPlus size={12} /> Agregar primer carrier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {api.carriers.map((c) => (
            <CarrierCard
              key={c._id}
              carrier={c}
              onEdit={handleEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
              appState={appState}
            />
          ))}
        </div>
      )}

      {/* Test Orders Panel */}
      {api.carriers.length > 0 && (
        <TestOrderPanel appState={appState} carriers={api.carriers} />
      )}

      {/* Coverage Tester */}
      {api.carriers.length > 0 && (
        <CoverageTester appState={appState} carriers={api.carriers} />
      )}

      {/* Carrier Modal */}
      <CarrierModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCarrier(null); }}
        onSave={handleSave}
        onTestConnection={api.testConnection}
        carrier={editingCarrier}
        presets={api.carrierPresets}
        t={t}
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

export default DeliveryCarriers;

export const pageMetadata = {
    path: '/app/delivery/carriers',
    label: 'delivery.carriers_label',
    category: 'delivery.category',
    minRoleLevel: 3,
    maxRoleLevel: 5,
    order: 1,
    locations: ['sidebar'],
    description: 'delivery.carriers_description',
    icon: 'FaShippingFast',
    isSearchable: true,
};
