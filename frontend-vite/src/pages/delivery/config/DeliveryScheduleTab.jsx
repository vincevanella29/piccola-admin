// src/pages/delivery/components/DeliveryScheduleTab.jsx
// Delivery schedule per-location with accordion cards + photos + delivery zones
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaClock, FaSave, FaSpinner, FaSync, FaStore, FaMotorcycle, FaShoppingBag,
  FaChevronDown, FaMapMarkerAlt, FaCircle, FaPhone
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchLocations, updateLocation } from '../../../utils/clubNonnaData';

const DAYS = [
  { iso: '1', short: 'L', long: 'Lunes' },
  { iso: '2', short: 'M', long: 'Martes' },
  { iso: '3', short: 'X', long: 'Miércoles' },
  { iso: '4', short: 'J', long: 'Jueves' },
  { iso: '5', short: 'V', long: 'Viernes' },
  { iso: '6', short: 'S', long: 'Sábado' },
  { iso: '7', short: 'D', long: 'Domingo' },
];

const timeCls = "rounded-lg px-2 py-1 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 text-light-text-primary dark:text-dark-text-primary text-xs outline-none border border-light-border/50 dark:border-dark-border/50 focus:border-matrix-green transition w-[5.5rem]";

// ── Mini schedule summary ────────────────────────────────────────
const ScheduleSummary = ({ schedule, color }) => {
  const activeDays = DAYS.filter(d => schedule[d.iso]);
  if (activeDays.length === 0) return <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Sin configurar</span>;
  const first = schedule[activeDays[0].iso];
  const allSame = activeDays.every(d => schedule[d.iso]?.open === first.open && schedule[d.iso]?.close === first.close);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex gap-0.5">
        {DAYS.map(d => (
          <span key={d.iso} className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${schedule[d.iso]
            ? `${color === 'blue' ? 'bg-blue-500/20 text-blue-500' : 'bg-amber-500/20 text-amber-500'}`
            : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary'
            }`}>
            {d.short}
          </span>
        ))}
      </div>
      {allSame && first && (
        <span className="text-[10px] font-mono text-light-text-secondary dark:text-dark-text-secondary">
          {first.open}–{first.close}
        </span>
      )}
    </div>
  );
};

// ── Day Row (compact) ────────────────────────────────────────────
const DayRow = ({ day, value, onChange, color }) => {
  const isOpen = !!value;
  const accent = color === 'blue'
    ? { border: 'border-blue-500/30', bg: 'bg-blue-500/5', toggle: 'bg-blue-500' }
    : { border: 'border-amber-500/30', bg: 'bg-amber-500/5', toggle: 'bg-amber-500' };

  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${isOpen ? `${accent.border} ${accent.bg}` : 'border-light-border/20 dark:border-dark-border/20 opacity-50'
      }`}>
      <button type="button" onClick={() => onChange(isOpen ? null : { open: '12:00', close: '22:00' })}
        className={`shrink-0 w-8 h-4.5 rounded-full transition-all relative ${isOpen ? accent.toggle : 'bg-light-border dark:bg-dark-border'}`}>
        <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${isOpen ? 'translate-x-3.5' : ''}`} />
      </button>
      <span className="text-[11px] font-bold text-light-text-primary dark:text-dark-text-primary w-6">{day.short}</span>
      {isOpen ? (
        <div className="flex items-center gap-1.5 flex-1">
          <input type="time" value={value?.open || '12:00'} onChange={e => onChange({ ...value, open: e.target.value })} className={timeCls} />
          <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">→</span>
          <input type="time" value={value?.close || '22:00'} onChange={e => onChange({ ...value, close: e.target.value })} className={timeCls} />
        </div>
      ) : (
        <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">Cerrado</span>
      )}
    </div>
  );
};

// ── Location Accordion Card ──────────────────────────────────────
const LocationAccordion = ({ location, appState, onSaved }) => {
  const [isOpen, setIsOpen] = useState(false);
  const oh = location.opening_hours || {};
  const [deliverySchedule, setDeliverySchedule] = useState(oh.delivery || {});
  const [pickupSchedule, setPickupSchedule] = useState(oh.pickup || {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const cover = location.cover_image_url || (location.media_urls || [])[0] || location.media_r2;
  const commune = location.commune || location.city || location.state;
  const telefono = location.telephone || location.phone || location.telefono;
  const deliveryDays = Object.keys(deliverySchedule).length;
  const pickupDays = Object.keys(pickupSchedule).length;

  const setDay = (type, iso, val) => {
    const setter = type === 'delivery' ? setDeliverySchedule : setPickupSchedule;
    setter(prev => {
      const next = { ...prev };
      if (val === null) delete next[iso]; else next[iso] = val;
      return next;
    });
    setDirty(true);
  };

  const copyMonday = (type) => {
    const schedule = type === 'delivery' ? deliverySchedule : pickupSchedule;
    const setter = type === 'delivery' ? setDeliverySchedule : setPickupSchedule;
    const mon = schedule['1'];
    if (!mon) return;
    const next = {};
    Object.keys(schedule).forEach(k => { next[k] = { ...mon }; });
    setter(next);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLocation({
        locationId: location._id,
        data: { opening_hours: { ...oh, delivery: deliverySchedule, pickup: pickupSchedule } },
        walletAddress: appState?.account,
        token: appState?.token,
      });
      toast.success(`✅ ${location.nombre} actualizado`);
      setDirty(false);
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-light-border/20 dark:border-dark-border/20 overflow-hidden bg-light-surface dark:bg-dark-surface"
    >
      {/* Header — clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-3 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors text-left"
      >
        {/* Photo */}
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-light-surface-secondary dark:bg-dark-surface-secondary">
          {cover ? (
            <img src={cover} alt={location.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FaStore size={16} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{location.nombre}</h3>
            {dirty && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary mb-1.5">
            {commune && <span className="flex items-center gap-0.5"><FaMapMarkerAlt size={8} />{commune}</span>}
            {telefono && <span className="flex items-center gap-0.5"><FaPhone size={7} />{telefono}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <FaMotorcycle size={10} className="text-blue-500" />
              <ScheduleSummary schedule={deliverySchedule} color="blue" />
            </div>
            <div className="flex items-center gap-1">
              <FaShoppingBag size={9} className="text-amber-500" />
              <ScheduleSummary schedule={pickupSchedule} color="amber" />
            </div>
          </div>
        </div>

        {/* Chevron */}
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <FaChevronDown size={12} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-3 border-t border-light-border/10 dark:border-dark-border/10 mt-0">
              {/* Delivery */}
              <div>
                <div className="flex items-center justify-between mb-2 mt-3">
                  <div className="flex items-center gap-1.5">
                    <FaMotorcycle size={11} className="text-blue-500" />
                    <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Delivery</span>
                    <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">{deliveryDays} días</span>
                  </div>
                  {deliveryDays > 1 && (
                    <button onClick={() => copyMonday('delivery')}
                      className="text-[9px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-semibold hover:bg-blue-500/20 transition-colors">
                      Copiar Lun
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {DAYS.map(d => <DayRow key={d.iso} day={d} value={deliverySchedule[d.iso] ?? null} onChange={v => setDay('delivery', d.iso, v)} color="blue" />)}
                </div>
              </div>

              {/* Pickup */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FaShoppingBag size={10} className="text-amber-500" />
                    <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">Retiro en tienda</span>
                    <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">{pickupDays} días</span>
                  </div>
                  {pickupDays > 1 && (
                    <button onClick={() => copyMonday('pickup')}
                      className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-semibold hover:bg-amber-500/20 transition-colors">
                      Copiar Lun
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {DAYS.map(d => <DayRow key={d.iso} day={d} value={pickupSchedule[d.iso] ?? null} onChange={v => setDay('pickup', d.iso, v)} color="amber" />)}
                </div>
              </div>

              {/* Zone info (read-only for now) */}
              {location.delivery_zone && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <FaCircle size={8} className="text-emerald-500" />
                  <span className="text-[10px] text-light-text-primary dark:text-dark-text-primary">
                    Zona: {location.delivery_zone.radius_km} km — {location.delivery_zone.type === 'circular' ? 'Circular' : 'Cuadrado'}
                  </span>
                </div>
              )}

              {/* Save */}
              {dirty && (
                <button onClick={handleSave} disabled={saving}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-matrix-green text-white hover:bg-matrix-green/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <FaSpinner size={12} className="animate-spin" /> : <FaSave size={12} />}
                  Guardar cambios
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Main Tab ─────────────────────────────────────────────────────
const DeliveryScheduleTab = ({ appState }) => {
  const [locations, setLocations] = useState([]);
  const [loadingLocs, setLoadingLocs] = useState(true);

  const loadLocations = useCallback(async () => {
    setLoadingLocs(true);
    try {
      const data = await fetchLocations(appState?.account, appState?.token);
      setLocations(Array.isArray(data) ? data : data?.locations || []);
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoadingLocs(false);
    }
  }, [appState]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FaClock className="text-blue-500" size={14} />
            <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">Horarios por Sucursal</h3>
          </div>
          <button onClick={loadLocations} disabled={loadingLocs}
            className="p-1.5 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary dark:text-dark-text-tertiary transition-colors">
            <FaSync size={10} className={loadingLocs ? 'animate-spin' : ''} />
          </button>
        </div>

        {loadingLocs ? (
          <div className="flex justify-center py-10">
            <FaSpinner size={18} className="animate-spin text-matrix-green" />
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-light-border/20 dark:border-dark-border/20 rounded-xl">
            <FaStore size={24} className="mx-auto text-light-text-tertiary dark:text-dark-text-tertiary mb-2" />
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">No hay sucursales</p>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map(loc => (
              <LocationAccordion key={loc._id} location={loc} appState={appState} onSaved={loadLocations} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryScheduleTab;
