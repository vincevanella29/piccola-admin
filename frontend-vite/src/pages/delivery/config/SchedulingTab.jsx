// src/pages/delivery/config/SchedulingTab.jsx
// Configurable order scheduling parameters
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FaSave, FaSpinner, FaClock, FaCalendarAlt,
  FaRocket, FaHourglass, FaSlidersH,
} from 'react-icons/fa';
import * as deliveryApi from '../../../utils/deliveryData';

const DEFAULTS = {
  scheduling_enabled: true,
  allow_asap: true,
  advance_days: 1,
  slot_interval_minutes: 30,
  min_lead_time_minutes: 30,
  max_slots_per_day: 20,
};

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1.5 horas' },
  { value: 120, label: '2 horas' },
];

const ADVANCE_LABELS = [
  'Solo hoy', 'Hoy + mañana', '2 días', '3 días', '4 días',
  '5 días', '6 días', '1 semana', '8 días', '9 días', '10 días',
];

// ── Toggle Row ──────────────────────────────────────────────────────
const ToggleRow = ({ icon: Icon, iconColor, label, description, value, onChange }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-12 h-6 rounded-full transition-all duration-200 ${
        value
          ? 'bg-matrix-green/80'
          : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20'
      }`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
        value ? 'left-[26px]' : 'left-0.5'
      }`} />
    </button>
  </div>
);

// ── Slider Row ──────────────────────────────────────────────────────
const SliderRow = ({ icon: Icon, iconColor, label, description, value, min, max, onChange, displayLabel }) => (
  <div className="p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
      </div>
      <span className="px-3 py-1 rounded-lg text-xs font-black bg-matrix-green/10 text-matrix-green min-w-[60px] text-center">
        {displayLabel || value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-matrix-green bg-light-surface-secondary dark:bg-dark-surface-secondary"
    />
    <div className="flex justify-between mt-1">
      <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">{min}</span>
      <span className="text-[9px] text-light-text-tertiary dark:text-dark-text-tertiary">{max}</span>
    </div>
  </div>
);

// ── Dropdown Row ────────────────────────────────────────────────────
const DropdownRow = ({ icon: Icon, iconColor, label, description, value, options, onChange }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
      </div>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="px-3 py-2 rounded-lg text-xs font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/15 dark:border-dark-border/15 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-matrix-green/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

// ── Main Tab ────────────────────────────────────────────────────────
const SchedulingTab = ({ appState }) => {
  const [config, setConfig] = useState(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const originalRef = useRef(null);

  const getAuth = useCallback(() => ({
    token: appState?.token,
    walletAddress: appState?.account,
  }), [appState?.token, appState?.account]);

  // Fetch
  useEffect(() => {
    const load = async () => {
      try {
        const res = await deliveryApi.getSchedulingConfig(getAuth());
        if (res?.scheduling_config) {
          const merged = { ...DEFAULTS, ...res.scheduling_config };
          setConfig(merged);
          originalRef.current = JSON.stringify(merged);
        }
      } catch (err) {
        console.error('[SchedulingTab] Load error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [getAuth]);

  // Track dirty
  const updateField = (key, value) => {
    setConfig(prev => {
      const next = { ...prev, [key]: value };
      setIsDirty(JSON.stringify(next) !== originalRef.current);
      return next;
    });
    setSaveMessage('');
  };

  // Save
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await deliveryApi.updateSchedulingConfig({ ...getAuth(), data: config });
      if (res?.scheduling_config) {
        originalRef.current = JSON.stringify(res.scheduling_config);
        setConfig(res.scheduling_config);
      } else {
        originalRef.current = JSON.stringify(config);
      }
      setIsDirty(false);
      setSaveMessage('✅ Configuración guardada. Recuerda Sync Config para enviar a delivery.');
    } catch (err) {
      setSaveMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FaSpinner size={24} className="animate-spin text-matrix-green" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <FaCalendarAlt className="text-violet-400" size={14} />
            Programación de Pedidos
          </h3>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
            Controla cómo los clientes eligen la hora de entrega en la tienda delivery.
          </p>
        </div>
        {isDirty && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />}
            Guardar
          </motion.button>
        )}
      </div>

      {/* Toggles */}
      <ToggleRow
        icon={FaRocket}
        iconColor="#22c55e"
        label="Pedidos inmediatos (ASAP)"
        description="Los clientes pueden pedir 'Lo antes posible'"
        value={config.allow_asap}
        onChange={(v) => updateField('allow_asap', v)}
      />

      <ToggleRow
        icon={FaCalendarAlt}
        iconColor="#8b5cf6"
        label="Pedidos programados"
        description="Los clientes pueden programar un horario de entrega"
        value={config.scheduling_enabled}
        onChange={(v) => updateField('scheduling_enabled', v)}
      />

      {/* Scheduling params — only show when scheduling is enabled */}
      {config.scheduling_enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3 pl-1 border-l-2 border-violet-500/20 ml-4"
        >
          <div className="pl-3 space-y-3">
            <SliderRow
              icon={FaCalendarAlt}
              iconColor="#06b6d4"
              label="Días de anticipación"
              description="Cuántos días hacia adelante pueden programar"
              value={config.advance_days}
              min={0}
              max={10}
              onChange={(v) => updateField('advance_days', v)}
              displayLabel={ADVANCE_LABELS[config.advance_days] || `${config.advance_days} días`}
            />

            <DropdownRow
              icon={FaClock}
              iconColor="#f59e0b"
              label="Intervalo de bloques"
              description="Duración de cada bloque horario disponible"
              value={config.slot_interval_minutes}
              options={INTERVAL_OPTIONS}
              onChange={(v) => updateField('slot_interval_minutes', v)}
            />

            <SliderRow
              icon={FaHourglass}
              iconColor="#ef4444"
              label="Tiempo mínimo de anticipación"
              description="Minutos desde ahora hasta el primer bloque disponible"
              value={config.min_lead_time_minutes}
              min={0}
              max={180}
              onChange={(v) => updateField('min_lead_time_minutes', v)}
              displayLabel={`${config.min_lead_time_minutes} min`}
            />

            <SliderRow
              icon={FaSlidersH}
              iconColor="#3b82f6"
              label="Máximo bloques por día"
              description="Limita la cantidad de horarios mostrados por día"
              value={config.max_slots_per_day}
              min={1}
              max={50}
              onChange={(v) => updateField('max_slots_per_day', v)}
              displayLabel={`${config.max_slots_per_day}`}
            />
          </div>
        </motion.div>
      )}

      {/* Preview info */}
      <div className="p-4 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/10 dark:border-dark-border/10">
        <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary mb-2">
          Vista previa del comportamiento
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${config.allow_asap ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-light-text-secondary dark:text-dark-text-secondary">
              ASAP: {config.allow_asap ? 'Los clientes pueden pedir de inmediato' : 'Deshabilitado — solo pedidos programados'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${config.scheduling_enabled ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-light-text-secondary dark:text-dark-text-secondary">
              Programar: {config.scheduling_enabled
                ? `${ADVANCE_LABELS[config.advance_days]}, bloques de ${config.slot_interval_minutes}min, min ${config.min_lead_time_minutes}min anticipación`
                : 'Deshabilitado — solo ASAP'}
            </span>
          </div>
          {!config.allow_asap && !config.scheduling_enabled && (
            <div className="flex items-center gap-2 text-[11px] text-red-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              ⚠️ Ambos modos desactivados — los clientes no podrán hacer pedidos
            </div>
          )}
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-light-text-secondary dark:text-dark-text-secondary text-center"
        >
          {saveMessage}
        </motion.p>
      )}
    </div>
  );
};

export default SchedulingTab;
