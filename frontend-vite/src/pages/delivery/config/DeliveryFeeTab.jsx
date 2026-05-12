// src/pages/delivery/components/DeliveryFeeTab.jsx
// Platform delivery fee — separated into Vanellix (fixed) and restaurant markup (editable)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FaDollarSign, FaPercent, FaSave, FaSpinner,
  FaGift, FaArrowDown, FaBan, FaLock, FaStore,
  FaInfoCircle, FaLayerGroup,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchDeliveryFeeConfig, updateDeliveryFeeConfig } from '../../../utils/deliveryData';

/* ─── Vanellix commissions charged TO the restaurant (La Piccola) ──── */
/* These are NOT charged to the end customer — they're Vanellix's cut   */
const VANELLIX_TIERS = [
  {
    label: 'Delivery',
    emoji: '🚚',
    desc: 'Sobre el costo del carrier (Uber, PedidosYa, etc.)',
    detail: 'Vanellix paga al carrier y cobra al restaurante: costo del carrier + este %.',
    base: 'Costo del envío',
  },
  {
    label: 'Plataforma',
    emoji: '💻',
    desc: 'Sobre la venta total del pedido (subtotal de productos)',
    detail: 'Comisión por uso de la plataforma tecnológica Vanellix.',
    base: 'Subtotal del pedido',
  },
  {
    label: 'Medio de Pago',
    emoji: '💳',
    desc: 'Sobre el monto total cobrado con tarjeta',
    detail: 'Cubre Transbank / pasarela de pago. Solo aplica a pagos con tarjeta, no efectivo.',
    base: 'Total pagado con tarjeta',
  },
];

/* ─── Markup type options ────────────────────────────────────────────── */
const FEE_TYPES = [
  { value: 'percentage', label: 'Porcentaje',  icon: FaPercent,    desc: 'Agrega un % sobre el costo del carrier',   example: 'Carrier $1.500 + 20% → $1.800' },
  { value: 'fixed',      label: 'Monto fijo',  icon: FaDollarSign, desc: 'Agrega un monto fijo sobre el carrier',     example: 'Carrier $1.500 + $500 → $2.000' },
  { value: 'none',       label: 'Sin markup',  icon: FaBan,        desc: 'Cobra al cliente exactamente lo del carrier', example: 'Carrier $1.500 → Cliente $1.500' },
];

const DeliveryFeeTab = ({ appState }) => {
  const [config, setConfig] = useState({
    type: 'percentage',
    value: 0,
    min_fee: 0,
    max_fee: 0,
    free_above: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetchDeliveryFeeConfig({
          token: appState?.token,
          walletAddress: appState?.account,
        });
        if (resp?.delivery_fee_config) {
          setConfig(resp.delivery_fee_config);
        }
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
      toast.success('✅ Tarifa de envío actualizada');
    } catch (e) {
      toast.error('Error al guardar: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  /* ─── Live example calculation ─────────────────────────────────────── */
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
      <div className="flex items-center justify-center py-12">
        <FaSpinner className="animate-spin text-light-text-tertiary dark:text-dark-text-tertiary" size={24} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: Vanellix commissions — charged TO Piccola
          ════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-transparent to-indigo-500/5">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-violet-500/10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
            <FaLock size={13} className="text-violet-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
              Comisiones Vanellix → La Piccola
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                Se configuran en Proveedores
              </span>
            </h4>
            <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
              Lo que Vanellix cobra <strong>al restaurante</strong> — el cliente final NO ve estos montos
            </p>
          </div>
        </div>

        {/* Tiers grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-violet-500/5">
          {VANELLIX_TIERS.map((tier, i) => (
            <div key={i} className="px-5 py-4 bg-light-surface dark:bg-dark-surface">
              <p className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span>{tier.emoji}</span>
                {tier.label}
              </p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                {tier.desc}
              </p>
              <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1.5 leading-relaxed italic">
                {tier.detail}
              </p>
              <p className="text-[9px] font-mono text-violet-400/50 mt-1">
                Base: {tier.base}
              </p>
            </div>
          ))}
        </div>

        {/* Info footer */}
        <div className="px-5 py-3 border-t border-violet-500/10 flex items-start gap-2">
          <FaInfoCircle size={11} className="text-violet-400/60 mt-0.5 shrink-0" />
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary leading-relaxed">
            Estas comisiones las cobra Vanellix al restaurante y se descuentan en cada cierre semanal.
            Los porcentajes exactos se configuran en <strong>Proveedores → Editar → Comisiones</strong>.
            El cliente final no ve nada de esto — solo ve el fee de envío de la sección de abajo.
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: Restaurant Markup (editable)
          ════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-cyan-500/10">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10">
            <FaStore size={13} className="text-cyan-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
              Fee de Envío al Cliente
              <span className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Editable
              </span>
            </h4>
            <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
              Esto es lo que <strong>el cliente final</strong> paga por envío — puedes cobrar de más, igual, o menos que el carrier
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Fee Type Selector */}
          <div>
            <p className="text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-2">
              Tipo de Markup
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FEE_TYPES.map((ft) => {
                const Icon = ft.icon;
                const isActive = config.type === ft.value;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setConfig({ ...config, type: ft.value })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isActive
                        ? 'border-cyan-500 bg-cyan-500/5 shadow-sm shadow-cyan-500/10'
                        : 'border-light-border/20 dark:border-dark-border/20 hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon size={14} className={isActive ? 'text-cyan-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary'} />
                      <span className={`font-bold text-sm ${isActive ? 'text-cyan-500' : 'text-light-text-primary dark:text-dark-text-primary'}`}>
                        {ft.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                      {ft.desc}
                    </p>
                    <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-1 font-mono">
                      {ft.example}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Value Input + Live Preview */}
          {config.type !== 'none' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
                  {config.type === 'percentage' ? 'Porcentaje (%)' : 'Monto Fijo (CLP)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step={config.type === 'percentage' ? '1' : '100'}
                    value={config.value}
                    onChange={(e) => setConfig({ ...config, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-xl px-3 py-2.5 text-sm font-mono text-light-text-primary dark:text-dark-text-primary pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                    {config.type === 'percentage' ? '%' : 'CLP'}
                  </span>
                </div>
              </div>

              {/* Live preview — full breakdown */}
              <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl p-4 border border-light-border/10 dark:border-dark-border/10">
                <p className="text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FaLayerGroup size={9} className="text-cyan-400" />
                  Desglose completo
                </p>
                <div className="space-y-1 text-sm">
                  {/* Carrier base */}
                  <div className="flex justify-between">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">Carrier cobra:</span>
                    <span className="font-mono">${exampleCarrierFee.toLocaleString('es-CL')}</span>
                  </div>
                  {/* Vanellix cut — informational, not visible to customer */}
                  <div className="flex justify-between text-violet-400/60">
                    <span className="text-[10px] italic">Vanellix cobra al restaurante aparte (no se suma aquí)</span>
                  </div>
                  {/* Restaurant markup */}
                  <div className="flex justify-between text-cyan-500">
                    <span>+ Tu markup:</span>
                    <span className="font-mono font-bold">+${example.markup.toLocaleString('es-CL')}</span>
                  </div>
                  {/* Total */}
                  <div className="flex justify-between font-bold border-t border-light-border/20 dark:border-dark-border/20 pt-1.5 mt-1.5">
                    <span className="text-light-text-primary dark:text-dark-text-primary">Cliente paga:</span>
                    <span className="text-green-500 font-mono">${example.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced: min, max, free threshold */}
          <div>
            <h4 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-3 flex items-center gap-2">
              <FaArrowDown size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
              Configuración Avanzada
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider">
                  Fee Mínimo (CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={config.min_fee}
                  onChange={(e) => setConfig({ ...config, min_fee: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = sin mínimo"
                  className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-lg px-3 py-2 text-sm font-mono text-light-text-primary dark:text-dark-text-primary"
                />
                <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                  Si el total queda bajo esto, sube a este mínimo
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider">
                  Fee Máximo (CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={config.max_fee}
                  onChange={(e) => setConfig({ ...config, max_fee: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = sin tope"
                  className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-lg px-3 py-2 text-sm font-mono text-light-text-primary dark:text-dark-text-primary"
                />
                <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                  Tope máximo que paga el cliente
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-light-text-tertiary dark:text-dark-text-tertiary mb-1 uppercase tracking-wider flex items-center gap-1">
                  <FaGift size={8} className="text-green-500" />
                  Gratis sobre (CLP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={config.free_above}
                  onChange={(e) => setConfig({ ...config, free_above: parseFloat(e.target.value) || 0 })}
                  placeholder="0 = nunca gratis"
                  className="w-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20 rounded-lg px-3 py-2 text-sm font-mono text-light-text-primary dark:text-dark-text-primary"
                />
                <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                  Envío gratis si el pedido supera este monto
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
            saving
              ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/20'
          }`}
        >
          {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaSave size={14} />}
          {saving ? 'Guardando...' : 'Guardar Tarifa'}
        </button>
      </div>
    </motion.div>
  );
};

export default DeliveryFeeTab;
