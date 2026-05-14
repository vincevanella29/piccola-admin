import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FaDollarSign, FaPercent, FaSave, FaSpinner,
  FaGift, FaChevronDown, FaBan, FaLock, FaStore,
  FaInfoCircle, FaLayerGroup, FaTrashAlt
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchDeliveryFeeConfig, updateDeliveryFeeConfig } from '../../../utils/deliveryData';
import { fetchLocations } from '../../../utils/clubNonnaData';

const DeliveryFeeTab = ({ appState }) => {
  const { t: rawT } = useTranslation();
  const t = (k, def) => {
    const res = rawT(`delivery.${k}`);
    return res === `delivery.${k}` ? def || k : res;
  };

  const VANELLIX_TIERS = [
    {
      label: 'Delivery',
      emoji: '🚚',
      desc: t('prov_comm_delivery_desc', 'Sobre el costo del carrier.'),
      detail: t('fee_vanellix_commissions_info_1', 'Vanellix paga al carrier y cobra al restaurante.'),
      base: t('prov_comm_carrier_cost', 'Costo del envío'),
    },
    {
      label: 'Plataforma',
      emoji: '💻',
      desc: t('prov_comm_platform_desc', 'Sobre la venta total del pedido.'),
      detail: t('fee_vanellix_commissions_info_2', 'Comisión por uso de la plataforma tecnológica.'),
      base: t('prov_comm_order_subtotal', 'Subtotal del pedido'),
    },
    {
      label: 'Medio de Pago',
      emoji: '💳',
      desc: t('prov_comm_payment_desc', 'Sobre el monto cobrado con tarjeta.'),
      detail: t('fee_vanellix_commissions_info_3', 'Cubre Transbank. Solo pagos con tarjeta.'),
      base: t('prov_comm_card_total', 'Total con tarjeta'),
    },
  ];

  const FEE_TYPES = [
    { value: 'percentage', label: t('fee_markup_type_percentage', 'Porcentaje'), icon: FaPercent, desc: t('fee_markup_type_percentage_desc'), example: t('fee_markup_type_percentage_ex') },
    { value: 'fixed', label: t('fee_markup_type_fixed', 'Monto fijo'), icon: FaDollarSign, desc: t('fee_markup_type_fixed_desc'), example: t('fee_markup_type_fixed_ex') },
    { value: 'none', label: t('fee_markup_type_none', 'Sin markup'), icon: FaBan, desc: t('fee_markup_type_none_desc'), example: t('fee_markup_type_none_ex') },
  ];

  const [config, setConfig] = useState({
    type: 'percentage',
    value: 0,
    min_fee: 0,
    max_fee: 0,
    free_above: 0,
    location_overrides: {},
  });
  const [locations, setLocations] = useState([]);
  const [expandedLocation, setExpandedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [resp, locs] = await Promise.all([
          fetchDeliveryFeeConfig({ token: appState?.token, walletAddress: appState?.account }),
          fetchLocations(appState?.account, appState?.token)
        ]);
        if (resp?.delivery_fee_config) {
          setConfig({
            ...resp.delivery_fee_config,
            location_overrides: resp.delivery_fee_config.location_overrides || {}
          });
        }
        setLocations(Array.isArray(locs) ? locs : locs?.locations || []);
      } catch (e) {
        console.warn('[fee-config] Load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [appState?.token, appState?.account]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDeliveryFeeConfig({
        token: appState?.token,
        walletAddress: appState?.account,
        data: config,
      });
      toast.success(t('fee_save_success', 'Tarifa de envío actualizada'));
    } catch (e) {
      toast.error(t('fee_save_error', 'Error al guardar: ') + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const exampleCarrierFee = 1500;
  const calculateExample = () => {
    if (config.type === 'percentage') {
      const markup = Math.round(exampleCarrierFee * (config.value || 0) / 100);
      return { carrier: exampleCarrierFee, markup, total: exampleCarrierFee + markup };
    } else if (config.type === 'fixed') {
      return { carrier: exampleCarrierFee, markup: config.value || 0, total: exampleCarrierFee + (config.value || 0) };
    }
    return { carrier: exampleCarrierFee, markup: 0, total: exampleCarrierFee };
  };
  const example = calculateExample();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner className="animate-spin text-light-text-tertiary dark:text-dark-text-tertiary" size={24} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl mx-auto pb-10"
    >
      {/* ─────────────────────────────────────────────────────────────────
          SECTION 1: Vanellix commissions (Informational)
          ───────────────────────────────────────────────────────────────── */}
      <section className="bg-light-surface dark:bg-dark-surface rounded-3xl border border-light-border/10 dark:border-dark-border/10 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-light-border/5 dark:border-dark-border/5 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <FaLock className="text-light-text-tertiary dark:text-dark-text-tertiary" size={14} />
                {t('fee_vanellix_commissions_title', 'Comisiones Vanellix → La Piccola')}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                {t('fee_vanellix_commissions_subtitle')}
              </p>
            </div>
            <span className="px-3 py-1 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-full text-[11px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary tracking-wide uppercase">
              {t('fee_vanellix_commissions_tag')}
            </span>
          </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {VANELLIX_TIERS.map((tier, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{tier.emoji}</span>
                <h4 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{tier.label}</h4>
              </div>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                {tier.desc}
              </p>
              <div className="pt-3 mt-3 border-t border-light-border/5 dark:border-dark-border/5">
                <span className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider font-medium">Base:</span>
                <p className="text-sm font-mono text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{tier.base}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-8 py-4 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 flex items-start gap-3">
          <FaInfoCircle className="text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5 shrink-0" size={14} />
          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary leading-relaxed">
            {t('fee_vanellix_commissions_info')}
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 2: Global Customer Fee (Editable)
          ───────────────────────────────────────────────────────────────── */}
      <section className="bg-light-surface dark:bg-dark-surface rounded-3xl border border-light-border/10 dark:border-dark-border/10 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-light-border/5 dark:border-dark-border/5 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <FaStore className="text-blue-500" size={14} />
                {t('fee_customer_markup_title')}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                {t('fee_customer_markup_subtitle')}
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full text-[11px] font-medium tracking-wide uppercase">
              {t('fee_customer_markup_tag')}
            </span>
          </div>
        </div>

        <div className="p-8 space-y-10">
          {/* Markup Type */}
          <div>
            <h4 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-4">
              {t('fee_markup_type_title')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {FEE_TYPES.map((ft) => {
                const Icon = ft.icon;
                const isActive = config.type === ft.value;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setConfig({ ...config, type: ft.value })}
                    className={`relative p-5 rounded-2xl border text-left transition-all duration-300 ${
                      isActive
                        ? 'border-blue-500 bg-blue-500/5 shadow-sm ring-1 ring-blue-500/50'
                        : 'border-light-border/10 dark:border-dark-border/10 hover:border-light-border/30 dark:hover:border-dark-border/30 bg-light-surface dark:bg-dark-surface'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-500/20 text-blue-500' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'}`}>
                        <Icon size={14} />
                      </div>
                      <span className={`font-semibold text-sm ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                        {ft.label}
                      </span>
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3 leading-relaxed min-h-[32px]">
                      {ft.desc}
                    </p>
                    <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary font-mono bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-2 rounded-lg inline-block w-full">
                      {ft.example}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Grid */}
          {config.type !== 'none' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left: Value Input */}
              <div>
                <label className="block text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-3">
                  {config.type === 'percentage' ? t('fee_value_percentage_label') : t('fee_value_fixed_label')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step={config.type === 'percentage' ? '1' : '100'}
                    value={config.value}
                    onChange={(e) => setConfig({ ...config, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10 rounded-2xl px-5 py-4 text-lg font-mono text-light-text-primary dark:text-dark-text-primary focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-medium text-light-text-tertiary dark:text-dark-text-tertiary">
                    {config.type === 'percentage' ? '%' : 'CLP'}
                  </span>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 rounded-2xl p-6 border border-light-border/5 dark:border-dark-border/5">
                <h4 className="text-xs font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FaLayerGroup size={12} className="text-blue-400" />
                  {t('fee_live_preview_title')}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('fee_preview_carrier')}</span>
                    <span className="font-mono">${exampleCarrierFee.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-600 dark:text-blue-400 font-medium">
                    <span>{t('fee_preview_markup')}</span>
                    <span className="font-mono">+${example.markup.toLocaleString('es-CL')}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold border-t border-light-border/10 dark:border-dark-border/10 pt-3 mt-3">
                    <span className="text-light-text-primary dark:text-dark-text-primary">{t('fee_preview_total')}</span>
                    <span className="text-lg text-green-500 font-mono">${example.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-3 text-center italic">
                  {t('fee_preview_vanellix_note')}
                </p>
              </div>
            </div>
          )}

          {/* Advanced Constraints */}
          <div className="pt-6 border-t border-light-border/5 dark:border-dark-border/5">
            <h4 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-5">
              {t('fee_advanced_title')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('fee_min_fee_label')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={config.min_fee}
                  onChange={(e) => setConfig({ ...config, min_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10 rounded-xl px-4 py-3 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:border-blue-500/50 outline-none transition-all"
                />
                <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                  {t('fee_min_fee_desc')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                  {t('fee_max_fee_label')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={config.max_fee}
                  onChange={(e) => setConfig({ ...config, max_fee: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/10 dark:border-dark-border/10 rounded-xl px-4 py-3 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:border-blue-500/50 outline-none transition-all"
                />
                <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                  {t('fee_max_fee_desc')}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-green-600 dark:text-green-500 mb-2 flex items-center gap-1.5">
                  <FaGift size={10} />
                  {t('fee_free_above_label')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={config.free_above}
                  onChange={(e) => setConfig({ ...config, free_above: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-sm font-mono text-green-600 dark:text-green-400 focus:border-green-500/50 outline-none transition-all"
                />
                <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                  {t('fee_free_above_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          SECTION 3: Location Overrides
          ───────────────────────────────────────────────────────────────── */}
      <section className="bg-light-surface dark:bg-dark-surface rounded-3xl border border-light-border/10 dark:border-dark-border/10 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-light-border/5 dark:border-dark-border/5 bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
                <FaStore className="text-orange-500" size={14} />
                {t('fee_locations_title')}
              </h3>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                {t('fee_locations_subtitle')}
              </p>
            </div>
            <span className="px-3 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full text-[11px] font-medium tracking-wide uppercase">
              {t('fee_locations_tag')}
            </span>
          </div>
        </div>
        
        <div className="p-8 space-y-4">
          {locations.map((loc) => {
            const locId = String(loc._id);
            const isExpanded = expandedLocation === locId;
            const hasOverride = !!config.location_overrides?.[locId];
            const locConfig = config.location_overrides?.[locId] || { type: 'none', value: 0, min_fee: 0, max_fee: 0, free_above: 0 };
            
            return (
              <div 
                key={locId} 
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded ? 'border-orange-500/30 bg-orange-500/5 shadow-sm' : 'border-light-border/10 dark:border-dark-border/10 bg-light-surface dark:bg-dark-surface hover:border-light-border/20 dark:hover:border-dark-border/20'
                }`}
              >
                <div 
                  className="flex items-center justify-between px-6 py-5 cursor-pointer"
                  onClick={() => setExpandedLocation(isExpanded ? null : locId)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${hasOverride ? 'bg-orange-500' : 'bg-light-text-tertiary/30 dark:text-dark-text-tertiary/30'}`} />
                    <div>
                      <h5 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{loc.nombre}</h5>
                      <p className="text-xs mt-0.5">
                        {hasOverride ? (
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            {t('fee_loc_active_override')} ({locConfig.type === 'none' ? t('fee_markup_type_none') : locConfig.type === 'percentage' ? '%' : 'Fijo'})
                            {locConfig.free_above > 0 ? ` + Gratis sobre $${locConfig.free_above.toLocaleString('es-CL')}` : ''}
                          </span>
                        ) : (
                          <span className="text-light-text-tertiary dark:text-dark-text-tertiary">{t('fee_loc_global_override')}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {hasOverride && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newOverrides = { ...config.location_overrides };
                          delete newOverrides[locId];
                          setConfig({ ...config, location_overrides: newOverrides });
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <FaTrashAlt size={10} />
                        {t('fee_loc_delete')}
                      </button>
                    )}
                    <div className={`p-2 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      <FaChevronDown size={12} />
                    </div>
                  </div>
                </div>
                
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-light-border/5 dark:border-dark-border/5 bg-light-surface/50 dark:bg-dark-surface/50 overflow-hidden"
                    >
                      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                          <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                            {t('fee_loc_type')}
                          </label>
                          <select 
                            value={locConfig.type}
                            onChange={(e) => {
                              const val = e.target.value;
                              setConfig({
                                ...config,
                                location_overrides: {
                                  ...config.location_overrides,
                                  [locId]: { ...locConfig, type: val }
                                }
                              });
                            }}
                            className="w-full bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl px-4 py-3 text-sm text-light-text-primary dark:text-dark-text-primary focus:border-orange-500/50 outline-none transition-all appearance-none"
                          >
                            <option value="none">{t('fee_markup_type_none')}</option>
                            <option value="fixed">{t('fee_markup_type_fixed')}</option>
                            <option value="percentage">{t('fee_markup_type_percentage')}</option>
                          </select>
                        </div>
                        
                        {locConfig.type !== 'none' && (
                          <div>
                            <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                              {t('fee_loc_value')} ({locConfig.type === 'percentage' ? '%' : 'CLP'})
                            </label>
                            <input 
                              type="number" 
                              min="0"
                              value={locConfig.value}
                              onChange={(e) => setConfig({
                                ...config,
                                location_overrides: {
                                  ...config.location_overrides,
                                  [locId]: { ...locConfig, value: parseFloat(e.target.value) || 0 }
                                }
                              })}
                              className="w-full bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl px-4 py-3 text-sm font-mono text-light-text-primary dark:text-dark-text-primary focus:border-orange-500/50 outline-none transition-all"
                            />
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs font-medium text-green-600 dark:text-green-500 mb-2 flex items-center gap-1.5">
                            <FaGift size={10} /> 
                            {t('fee_free_above_label')}
                          </label>
                          <input 
                            type="number" 
                            min="0"
                            step="1000"
                            value={locConfig.free_above}
                            onChange={(e) => setConfig({
                              ...config,
                              location_overrides: {
                                ...config.location_overrides,
                                [locId]: { ...locConfig, free_above: parseFloat(e.target.value) || 0 }
                              }
                            })}
                            className="w-full bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-sm font-mono text-green-600 dark:text-green-400 focus:border-green-500/50 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-8 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
            saving
              ? 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform hover:-translate-y-0.5'
          }`}
        >
          {saving ? <FaSpinner className="animate-spin" size={16} /> : <FaSave size={16} />}
          {saving ? t('fee_saving_btn') : t('fee_save_btn')}
        </button>
      </div>
    </motion.div>
  );
};

export default DeliveryFeeTab;
