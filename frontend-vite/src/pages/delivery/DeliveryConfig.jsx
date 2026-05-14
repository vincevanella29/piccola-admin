// src/pages/delivery/DeliveryConfig.jsx
// Delivery configuration — professional split panel with AI assistant
// Admin only (lvl 3-5)
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaCog, FaExchangeAlt, FaClock, FaCreditCard, FaMapMarkedAlt, FaSync, FaSpinner,
  FaTruck, FaGlobe, FaCalendarAlt, FaComments
} from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import * as deliveryApi from '../../utils/deliveryData';
import { fetchLocations, updateLocation } from '../../utils/clubNonnaData';
import useDeliveryCarriers from '../../hooks/delivery/useDeliveryCarriers';
import { AIChatPanel } from '../../components/common/ai-chat';
import StatusMappingTab from './config/StatusMappingTab';
import DeliveryScheduleTab from './config/DeliveryScheduleTab';
import PaymentsTab from './config/PaymentsTab';
import DeliveryFeeTab from './config/DeliveryFeeTab';
import SchedulingTab from './config/SchedulingTab';
import WebhooksTab from './config/WebhooksTab';
import ChatConfigTab from './config/ChatConfigTab';

// ── Tab Config ──────────────────────────────────────────────────
const TABS = [
  { id: 'statuses', label: 'Estados', icon: FaExchangeAlt },
  { id: 'schedule', label: 'Horarios', icon: FaClock },
  { id: 'payments', label: 'Pagos', icon: FaCreditCard },
  { id: 'delivery_fee', label: 'Tarifa', icon: FaTruck },
  { id: 'scheduling', label: 'Programación', icon: FaCalendarAlt },
  { id: 'webhooks', label: 'Webhooks', icon: FaGlobe },
  { id: 'chat', label: 'Chat', icon: FaComments },
];



// ── Tab Selector ────────────────────────────────────────────────
const TabSelector = ({ activeTab, setActiveTab }) => (
  <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl w-full mb-5">
    {TABS.map((tab) => {
      const isActive = activeTab === tab.id;
      const Icon = tab.icon;
      return (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`relative flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all z-10 ${
            isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
          }`}
        >
          {isActive && (
            <motion.div
              layoutId="config-tab-bg"
              className="absolute inset-0 bg-light-surface dark:bg-dark-surface rounded-lg shadow-sm"
              transition={{ type: 'spring', duration: 0.4 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">
            <Icon size={12} />
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);

// ── Main Page ───────────────────────────────────────────────────
const DeliveryConfig = ({ appState }) => {
  const { t } = useTranslation();
  const carrierApi = useDeliveryCarriers(appState, t);

  const [activeTab, setActiveTab] = useState('statuses');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Config state
  const [internalStatuses, setInternalStatuses] = useState([]);
  const [pickupStatuses, setPickupStatuses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [fullConfig, setFullConfig] = useState(null);

  // Dirty flags
  const [statusesDirty, setStatusesDirty] = useState(false);
  const [pickupDirty, setPickupDirty] = useState(false);

  const appRef = useRef(appState);
  appRef.current = appState;

  const getAuth = useCallback(() => ({
    token: appRef.current?.token,
    walletAddress: appRef.current?.account,
  }), []);

  // Fetch config + locations
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configRes, locsData] = await Promise.all([
        deliveryApi.getDeliveryConfig(getAuth()),
        fetchLocations(appRef.current?.account, appRef.current?.token),
      ]);
      if (configRes?.config) {
        // Normalize: ensure kds_controllable is always an explicit boolean
        const normalize = (arr) => (arr || []).map((s, i) => ({
          ...s,
          order: s.order ?? i,
          kds_controllable: s.kds_controllable !== false,  // undefined/null → true
        }));
        setInternalStatuses(normalize(configRes.config.internal_statuses));
        setPickupStatuses(normalize(configRes.config.pickup_statuses));
        setFullConfig(configRes.config);
      }
      setLocations(Array.isArray(locsData) ? locsData : locsData?.locations || []);
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAuth]);

  useEffect(() => {
    fetchAll();
    carrierApi.fetchCarriers();
  }, []);

  // Save handlers
  const handleSaveStatuses = async () => {
    setIsSaving(true);
    try {
      // Clean — send only fields the backend StatusItem expects
      const clean = internalStatuses.map((s, i) => ({
        key: s.key,
        label: s.label,
        color: s.color || '#666',
        icon: s.icon || '📋',
        order: s.order ?? i,
        kds_controllable: s.kds_controllable !== false,
      }));
      await deliveryApi.updateStatuses({ ...getAuth(), statuses: clean, pipelineType: 'delivery' });
      toast.success('✅ Pipeline delivery actualizado');
      setStatusesDirty(false);
    } catch (err) { toast.error(err.message); }
    finally { setIsSaving(false); }
  };

  const handleSavePickupStatuses = async () => {
    setIsSaving(true);
    try {
      const clean = pickupStatuses.map((s, i) => ({
        key: s.key,
        label: s.label,
        color: s.color || '#666',
        icon: s.icon || '📋',
        order: s.order ?? i,
        kds_controllable: s.kds_controllable !== false,
      }));
      await deliveryApi.updateStatuses({ ...getAuth(), statuses: clean, pipelineType: 'pickup' });
      toast.success('✅ Pipeline pickup actualizado');
      setPickupDirty(false);
    } catch (err) { toast.error(err.message); }
    finally { setIsSaving(false); }
  };

  const handleSaveCarrierMapping = async (carrierId, mapping) => {
    setIsSaving(true);
    try {
      await deliveryApi.updateCarrierMapping({ ...getAuth(), carrierId, statusMapping: mapping });
      toast.success('✅ Mapping actualizado');
      carrierApi.fetchCarriers();
    } catch (err) { toast.error(err.message); }
    finally { setIsSaving(false); }
  };

  // Sync handlers
  const [isSyncingConfig, setIsSyncingConfig] = useState(false);
  const [isSyncingCarta, setIsSyncingCarta] = useState(false);

  const handlePushConfig = async () => {
    setIsSyncingConfig(true);
    try {
      const res = await deliveryApi.pushConfigToDelivery(getAuth());
      const msg = res?.message || `${res?.pushed || 0} proveedores sincronizados`;
      toast.success(`🔄 ${msg}`);
      if (res?.details) {
        res.details.filter(d => !d.ok).forEach(d =>
          toast.warn(`⚠️ ${d.slug}: ${d.reason}`, { autoClose: 5000 })
        );
      }
    } catch (err) {
      toast.error(`❌ Error: ${err.message}`);
    } finally {
      setIsSyncingConfig(false);
    }
  };

  const handleSyncCarta = async () => {
    setIsSyncingCarta(true);
    try {
      await deliveryApi.triggerCatalogSync(getAuth());
      toast.success('📋 Carta sincronizada con delivery');
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setIsSyncingCarta(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-light-border/10 dark:border-dark-border/10">
        <div>
          <h1 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaCog className="text-matrix-green" /> Configuración Delivery
          </h1>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            Estados, horarios, métodos de pago y tarifas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync Config → Push schedule, payments, transbank to delivery */}
          <button
            onClick={handlePushConfig}
            disabled={isSyncingConfig}
            title="Enviar config (horarios, pagos, Transbank) a delivery"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-matrix-green/10 text-matrix-green hover:bg-matrix-green/20 border border-matrix-green/20 transition-all disabled:opacity-50"
          >
            {isSyncingConfig
              ? <FaSpinner size={11} className="animate-spin" />
              : <FaSync size={11} />
            }
            Sync Config
          </button>
          {/* Sync Carta → Triggers catalog re-sync */}
          <button
            onClick={handleSyncCarta}
            disabled={isSyncingCarta}
            title="Re-sincronizar carta digital (productos, categorías, locales)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all disabled:opacity-50"
          >
            {isSyncingCarta
              ? <FaSpinner size={11} className="animate-spin" />
              : <FaSync size={11} />
            }
            Sync Carta
          </button>
          {/* Refresh local state */}
          <button
            onClick={fetchAll}
            disabled={isLoading}
            title="Refrescar datos locales"
            className="p-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors"
          >
            {isLoading
              ? <FaSpinner size={14} className="animate-spin text-light-text-secondary dark:text-dark-text-secondary" />
              : <FaSync size={14} className="text-light-text-secondary dark:text-dark-text-secondary" />
            }
          </button>
        </div>
      </div>

      {/* Split layout: Config + AI Chat */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Left: Config panels */}
        <div className="flex-1 overflow-y-auto p-5">
          <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <FaSpinner size={24} className="animate-spin text-matrix-green" />
            </div>
          ) : (
            <>
              {activeTab === 'statuses' && (
                <StatusMappingTab
                  internalStatuses={internalStatuses}
                  setInternalStatuses={setInternalStatuses}
                  pickupStatuses={pickupStatuses}
                  setPickupStatuses={setPickupStatuses}
                  carriers={carrierApi.carriers}
                  onSaveStatuses={handleSaveStatuses}
                  onSavePickupStatuses={handleSavePickupStatuses}
                  onSaveCarrierMapping={handleSaveCarrierMapping}
                  isSaving={isSaving}
                  statusesDirty={statusesDirty}
                  setStatusesDirty={setStatusesDirty}
                  pickupDirty={pickupDirty}
                  setPickupDirty={setPickupDirty}
                />
              )}

              {activeTab === 'schedule' && (
                <DeliveryScheduleTab appState={appState} />
              )}

              {activeTab === 'payments' && (
                <PaymentsTab appState={appState} />
              )}

              {activeTab === 'delivery_fee' && (
                <DeliveryFeeTab appState={appState} />
              )}

              {activeTab === 'scheduling' && (
                <SchedulingTab appState={appState} />
              )}

              {activeTab === 'webhooks' && (
                <WebhooksTab appState={appState} />
              )}

              {activeTab === 'chat' && (
                <ChatConfigTab appState={appState} currentConfig={fullConfig} fetchConfig={fetchAll} />
              )}
            </>
          )}
        </div>

        {/* Right: AI Chat */}
        <div className="w-[340px] border-l border-light-border/10 dark:border-dark-border/10 bg-light-surface/50 dark:bg-dark-surface/50 flex flex-col">
          <AIChatPanel
            title="Asistente Delivery"
            welcomeMessage={'¡Hola! 👋 Soy tu asistente de delivery. Puedo ayudarte con:\n\n• **Horarios**: _"Pon delivery Lun-Vie de 12 a 22, Sáb 12 a 23"_\n• **Tarifas y Descuentos**: _"Pon delivery gratis sobre $20.000 en Vitacura"_\n• **Configuración**: _"¿Qué tenemos configurado?"_\n\n¿Qué necesitas?'}
            placeholder="Ej: Pon delivery Lun-Vie 12:00 a 22:00..."
            onSend={async (message, history) => {
              const context = {
                locations: locations.map(l => ({
                  _id: l._id,
                  nombre: l.nombre,
                  opening_hours: l.opening_hours || {},
                })),
                statuses: internalStatuses,
                delivery_fee_config: fullConfig?.delivery_fee_config || {},
              };
              return deliveryApi.deliveryAIChat({
                token: appState?.token,
                walletAddress: appState?.account,
                message,
                history,
                context,
              });
            }}
            onApply={async (action) => {
              const { action: actionType } = action;

              if (actionType === 'update_schedule') {
                const { location_id, service, schedule } = action;
                const targetLocs = location_id
                  ? locations.filter(l => String(l._id) === String(location_id))
                  : locations;

                for (const loc of targetLocs) {
                  const oh = { ...(loc.opening_hours || {}) };
                  if (service === 'delivery' || service === 'both') oh.delivery = schedule;
                  if (service === 'pickup' || service === 'both') oh.pickup = schedule;

                  await updateLocation({
                    locationId: loc._id,
                    data: { opening_hours: oh },
                    walletAddress: appState?.account,
                    token: appState?.token,
                  });
                }
                toast.success(`✅ Horarios actualizados en ${targetLocs.length} sucursal(es)`);
                fetchAll();
              }

              if (actionType === 'update_fee_config') {
                const { delivery_fee_config } = action;
                await deliveryApi.updateDeliveryFeeConfig({ ...getAuth(), data: delivery_fee_config });
                toast.success('✅ Configuración de tarifas actualizada');
                fetchAll();
              }

              if (actionType === 'update_scheduling_config') {
                const { scheduling_config } = action;
                await deliveryApi.updateSchedulingConfig({ ...getAuth(), data: scheduling_config });
                toast.success('✅ Configuración de programación actualizada');
                fetchAll();
              }
            }}
            actionLabel={(a) => {
              if (a.action === 'update_schedule') return '📅 Actualizar horarios';
              if (a.action === 'update_fee_config') return '🚚 Configurar tarifa / descuento';
              if (a.action === 'update_scheduling_config') return '⏱️ Actualizar programación';
              return a.action;
            }}
          />
        </div>
      </div>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        toastClassName="!bg-dark-surface !text-dark-text-primary !border !border-dark-border/20 !rounded-xl !shadow-xl"
      />
    </motion.div>
  );
};

export default DeliveryConfig;

export const pageMetadata = {
  path: '/app/delivery/config',
  label: 'delivery.config_label',
  category: 'delivery.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  locations: ['sidebar'],
  description: 'delivery.config_description',
  icon: 'FaCog',
  isSearchable: true,
};
