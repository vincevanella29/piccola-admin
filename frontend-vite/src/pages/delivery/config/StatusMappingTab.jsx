// src/pages/delivery/config/StatusMappingTab.jsx
// Dual pipeline editor (delivery + pickup) + carrier mapping + KDS control
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaArrowRight, FaSave, FaSpinner, FaGripVertical,
  FaUtensils, FaRobot, FaChevronDown, FaChevronUp,
  FaTruck, FaStoreAlt,
} from 'react-icons/fa';

// ── Pipeline Tabs ───────────────────────────────────────────
const PIPELINE_TABS = [
  { id: 'delivery', label: 'Delivery', icon: FaTruck, emoji: '🛵', color: '#06b6d4' },
  { id: 'pickup',   label: 'Pickup',   icon: FaStoreAlt, emoji: '🏪', color: '#8b5cf6' },
];

// ── Status Pipeline Card ────────────────────────────────────────
const StatusCard = ({ status, index, total, onChange, pipelineColor }) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div className="flex items-stretch gap-0">
      {/* Pipeline connector */}
      <div className="flex flex-col items-center w-8 shrink-0">
        {!isFirst && <div className="w-0.5 flex-1" style={{ backgroundColor: `${pipelineColor}30` }} />}
        <div
          className="w-4 h-4 rounded-full border-2 shrink-0 z-10"
          style={{ borderColor: status.color, backgroundColor: `${status.color}30` }}
        />
        {!isLast && <div className="w-0.5 flex-1" style={{ backgroundColor: `${pipelineColor}30` }} />}
      </div>

      {/* Card */}
      <div className="flex-1 mb-2">
        <div className="rounded-xl border border-light-border/15 dark:border-dark-border/15 bg-light-surface dark:bg-dark-surface overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <FaGripVertical size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary cursor-grab shrink-0" />

            <input
              type="text"
              value={status.icon}
              onChange={(e) => onChange({ ...status, icon: e.target.value })}
              className="w-10 text-center text-lg bg-transparent outline-none shrink-0"
              maxLength={2}
            />

            <input
              type="text"
              value={status.label}
              onChange={(e) => onChange({ ...status, label: e.target.value })}
              className="flex-1 px-3 py-1.5 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 text-sm font-semibold text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-matrix-green/40"
            />

            <div className="flex items-center gap-2 shrink-0">
              <input
                type="color"
                value={status.color}
                onChange={(e) => onChange({ ...status, color: e.target.value })}
                className="w-7 h-7 rounded-lg border-0 cursor-pointer"
              />
              <span
                className="text-[10px] font-mono px-2 py-1 rounded-md"
                style={{ backgroundColor: `${status.color}15`, color: status.color }}
              >
                {status.key}
              </span>
            </div>

            {/* KDS Toggle */}
            <div className="flex items-center shrink-0 ml-1">
              <button
                onClick={() => onChange({ ...status, kds_controllable: !status.kds_controllable })}
                className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
                  status.kds_controllable
                    ? 'bg-matrix-green/80'
                    : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/20 dark:border-dark-border/20'
                }`}
                title={status.kds_controllable ? 'KDS puede controlar' : 'Automático'}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  status.kds_controllable ? 'left-[22px]' : 'left-0.5'
                }`} />
              </button>
              <span className="ml-1.5 text-[10px] w-10 shrink-0 font-medium">
                {status.kds_controllable ? (
                  <span className="flex items-center gap-1 text-matrix-green"><FaUtensils size={8} /> KDS</span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400"><FaRobot size={8} /> Auto</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Carrier mapping card ────────────────────────────────────────
const CarrierMappingCard = ({ carrier, internalStatuses, onSave, isSaving }) => {
  const [mapping, setMapping] = useState(carrier.status_mapping || {});
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleChange = (carrierStatus, internalKey) => {
    setMapping(prev => ({ ...prev, [carrierStatus]: internalKey }));
    setDirty(true);
  };

  const handleSave = () => { onSave(carrier._id, mapping); setDirty(false); };
  const carrierStatuses = Object.keys(mapping);
  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-light-border/15 dark:border-dark-border/15 overflow-hidden bg-light-surface/50 dark:bg-dark-surface/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{carrier.slug === 'uber_direct' ? '🔵' : carrier.slug === 'pedidosya' ? '🟠' : '🟣'}</span>
          <div className="text-left">
            <span className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{carrier.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                carrier.mode === 'test' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'
              }`}>{carrier.mode}</span>
              <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">{mappedCount}/{carrierStatuses.length}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <FaSpinner size={10} className="animate-spin" /> : <FaSave size={10} />}
              Guardar
            </button>
          )}
          {expanded ? <FaChevronUp size={12} className="text-light-text-tertiary" /> : <FaChevronDown size={12} className="text-light-text-tertiary" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-light-border/10 dark:border-dark-border/10">
              <div className="grid grid-cols-[1fr_32px_1fr] gap-2 px-2 py-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary">Carrier</span>
                <span />
                <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary dark:text-dark-text-tertiary">Nuestro Estado</span>
              </div>
              <div className="space-y-1.5">
                {carrierStatuses.map((cs) => {
                  const mappedStatus = internalStatuses.find(s => s.key === mapping[cs]);
                  return (
                    <div key={cs} className="grid grid-cols-[1fr_32px_1fr] gap-2 items-center">
                      <span className="text-xs font-mono px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/10 dark:border-dark-border/10 truncate">{cs}</span>
                      <FaArrowRight size={10} className="text-light-text-tertiary dark:text-dark-text-tertiary mx-auto" />
                      <select
                        value={mapping[cs] || ''}
                        onChange={(e) => handleChange(cs, e.target.value)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold bg-light-surface dark:bg-dark-surface border border-light-border/15 dark:border-dark-border/15 text-light-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-matrix-green/40"
                        style={mappedStatus ? { borderColor: `${mappedStatus.color}40` } : {}}
                      >
                        <option value="">— sin mapear —</option>
                        {internalStatuses.map((s) => (
                          <option key={s.key} value={s.key}>{s.icon} {s.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Pipeline Editor (reusable for both delivery & pickup) ────────
const PipelineEditor = ({
  statuses, setStatuses, onSave, isSaving, isDirty, setDirty, pipelineColor, pipelineLabel,
}) => {
  const handleChange = (index, updated) => {
    const next = [...statuses];
    next[index] = updated;
    setStatuses(next);
    setDirty(true);
  };

  const kdsCount = statuses.filter(s => s.kds_controllable !== false).length;
  const autoCount = statuses.filter(s => s.kds_controllable === false).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary max-w-lg">
            Activa "KDS" para estados que la cocina puede avanzar manualmente.
            Los "Auto" son controlados por el carrier o el sistema.
          </p>
        </div>
        {isDirty && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm shrink-0"
          >
            {isSaving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />}
            Guardar {pipelineLabel}
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 px-3 py-2 rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 border border-light-border/10 dark:border-dark-border/10">
        <div className="flex items-center gap-1.5 text-[11px]">
          <FaUtensils size={10} className="text-matrix-green" />
          <span className="font-semibold text-matrix-green">KDS</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">= Manual</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-matrix-green/10 text-matrix-green text-[10px] font-bold">{kdsCount}</span>
        </div>
        <div className="w-px h-4 bg-light-border/20 dark:bg-dark-border/20" />
        <div className="flex items-center gap-1.5 text-[11px]">
          <FaRobot size={10} className="text-amber-400" />
          <span className="font-semibold text-amber-400">Auto</span>
          <span className="text-light-text-secondary dark:text-dark-text-secondary">= Sistema/Carrier</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">{autoCount}</span>
        </div>
      </div>

      {/* Pipeline cards */}
      <div className="pl-1">
        {statuses.map((status, i) => (
          <StatusCard
            key={status.key}
            status={status}
            index={i}
            total={statuses.length}
            onChange={(s) => handleChange(i, s)}
            pipelineColor={pipelineColor}
          />
        ))}
      </div>
    </div>
  );
};

// ── Main Tab ─────────────────────────────────────────────────────
const StatusMappingTab = ({
  internalStatuses, setInternalStatuses,
  pickupStatuses = [], setPickupStatuses,
  carriers,
  onSaveStatuses, onSavePickupStatuses,
  onSaveCarrierMapping,
  isSaving,
  statusesDirty, setStatusesDirty,
  pickupDirty = false, setPickupDirty,
}) => {
  const [activePipeline, setActivePipeline] = useState('delivery');

  return (
    <div className="space-y-6">
      {/* ── Pipeline Tabs ── */}
      <div className="flex p-1 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 rounded-xl">
        {PIPELINE_TABS.map((tab) => {
          const isActive = activePipeline === tab.id;
          const count = tab.id === 'delivery' ? internalStatuses.length : pickupStatuses.length;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePipeline(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all z-10 ${
                isActive ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="pipelineTabBg"
                  className="absolute inset-0 bg-light-surface dark:bg-dark-surface rounded-lg shadow-sm"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative flex items-center gap-2 z-10">
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                  backgroundColor: `${tab.color}15`, color: tab.color,
                }}>
                  {count}
                </span>
                {/* Dirty indicator */}
                {((tab.id === 'delivery' && statusesDirty) || (tab.id === 'pickup' && pickupDirty)) && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Pipeline Editor ── */}
      <AnimatePresence mode="wait">
        {activePipeline === 'delivery' && (
          <motion.div
            key="delivery"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <PipelineEditor
              statuses={internalStatuses}
              setStatuses={setInternalStatuses}
              onSave={onSaveStatuses}
              isSaving={isSaving}
              isDirty={statusesDirty}
              setDirty={setStatusesDirty}
              pipelineColor="#06b6d4"
              pipelineLabel="Delivery"
            />
          </motion.div>
        )}

        {activePipeline === 'pickup' && (
          <motion.div
            key="pickup"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            <PipelineEditor
              statuses={pickupStatuses}
              setStatuses={setPickupStatuses}
              onSave={onSavePickupStatuses}
              isSaving={isSaving}
              isDirty={pickupDirty}
              setDirty={setPickupDirty}
              pipelineColor="#8b5cf6"
              pipelineLabel="Pickup"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Carrier Mapping (only for delivery) ── */}
      {activePipeline === 'delivery' && carriers.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary mb-1 flex items-center gap-2">
            <FaArrowRight className="text-cyan-400" size={12} />
            Mapeo por Carrier
          </h3>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-4">
            Los webhooks del carrier se convierten automáticamente a tus estados de delivery.
          </p>
          <div className="space-y-3">
            {carriers.map((c) => (
              <CarrierMappingCard
                key={c._id}
                carrier={c}
                internalStatuses={internalStatuses}
                onSave={onSaveCarrierMapping}
                isSaving={isSaving}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusMappingTab;
