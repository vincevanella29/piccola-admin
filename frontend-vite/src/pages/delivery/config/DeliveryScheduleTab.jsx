// src/pages/delivery/config/DeliveryScheduleTab.jsx
// Apple-style unified schedule management — per-location hours,
// special dates/holidays, and scheduling config in one place.
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLocations, updateLocation } from '../../../utils/clubNonnaData';
import YearTimeline from './schedule/YearTimeline';
import SpecialDatesManager from './schedule/SpecialDatesManager';
import SchedulingSection from './schedule/SchedulingSection';
import { MapPin, ChevronDown, ChevronUp, Clock, Truck, ShoppingBag, Copy, Save, Loader2, RefreshCw, UtensilsCrossed } from 'lucide-react';

const DAYS_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAYS_ISO = ['1','2','3','4','5','6','7'];

const SERVICES = [
  { key: 'delivery', i18n: 'delivery', icon: Truck },
  { key: 'pickup', i18n: 'pickup', icon: ShoppingBag },
  { key: 'dinein', i18n: 'dinein', icon: UtensilsCrossed },
];

const SCHED_DEFAULTS = {
  scheduling_enabled: true, allow_asap: true, advance_days: 1,
  slot_interval_minutes: 30, min_lead_time_minutes: 30, max_slots_per_day: 20,
};

// ── DayRow ─────────────────────────────────────────────────────────
const DayRow = ({ dayLabel, value, onChange, closedLabel }) => {
  const isOpen = !!value;
  const timeCls = "px-2 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/15 dark:border-dark-border/15 text-[11px] text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30 w-[90px]";
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
      isOpen ? 'bg-light-accent/4 dark:bg-dark-accent/4 border border-light-accent/20 dark:border-dark-accent/20'
             : 'bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 border border-transparent opacity-50'
    }`}>
      <button onClick={() => onChange(isOpen ? null : { open: '12:00', close: '23:00' })}
        className={`relative w-9 h-5 rounded-full transition-all duration-300 shrink-0 ${isOpen ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'}`}>
        <motion.span layout className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm ${isOpen ? 'left-[18px]' : 'left-0.5'}`}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
      <span className="text-[11px] font-bold text-light-text-primary dark:text-dark-text-primary w-12 shrink-0 truncate">{dayLabel}</span>
      {isOpen ? (
        <div className="flex items-center gap-1.5 flex-1">
          <input type="time" value={value?.open || '12:00'} onChange={e => onChange({ ...value, open: e.target.value })} className={timeCls} />
          <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">→</span>
          <input type="time" value={value?.close || '23:00'} onChange={e => onChange({ ...value, close: e.target.value })} className={timeCls} />
        </div>
      ) : (
        <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary flex-1">{closedLabel}</span>
      )}
    </div>
  );
};

// ── ServiceBlock ───────────────────────────────────────────────────
const ServiceBlock = ({ svc, schedule, onChange, t }) => {
  const [open, setOpen] = useState(true);
  const count = Object.keys(schedule).length;
  const Icon = svc.icon;
  const svcLabel = t(`delivery.schedule.${svc.i18n}`);
  const closedLabel = t('delivery.schedule.closed');
  const copyLabel = t('delivery.schedule.copyMon');
  const daysLabel = t('delivery.schedule.days');

  const setDay = (iso, val) => { const n = { ...schedule }; if (val === null) delete n[iso]; else n[iso] = val; onChange(n); };
  const copyMonday = () => { const m = schedule['1']; if (!m) return; const n = {}; DAYS_ISO.forEach(d => { if (schedule[d]) n[d] = { ...m }; }); onChange(n); };

  return (
    <div className="rounded-xl border border-light-border/10 dark:border-dark-border/10 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-light-accent dark:text-dark-accent" />
          <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{svcLabel}</span>
          <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{count} {daysLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {count > 1 && (
            <button onClick={e => { e.stopPropagation(); copyMonday(); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors">
              <Copy className="w-2.5 h-2.5" /> {copyLabel}
            </button>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 space-y-1">
              {DAYS_ISO.map((iso, i) => (
                <DayRow key={iso} dayLabel={t(`days.${DAYS_KEYS[i]}`)} value={schedule[iso] ?? null}
                  onChange={v => setDay(iso, v)} closedLabel={closedLabel} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── LocationCard ───────────────────────────────────────────────────
const LocationCard = ({ location, openingHours, onHoursChange, isSaving, onSave, isDirty, t }) => {
  const [expanded, setExpanded] = useState(false);
  const saveLabel = t('delivery.schedule.saveHours');
  const daysLabel = t('delivery.schedule.days');

  return (
    <motion.div layout className="rounded-2xl border border-light-border/10 dark:border-dark-border/10 bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-light-surface-secondary/20 dark:hover:bg-dark-surface-secondary/20 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          {location.cover_image_url ? (
            <img src={location.cover_image_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 border border-light-border/10 dark:border-dark-border/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            </div>
          )}
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{location.nombre}</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate">
              {[location.commune || location.city, location.direccion].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {SERVICES.map(svc => {
            const count = Object.keys((openingHours?.[svc.key]) || {}).length;
            return count > 0 ? (
              <span key={svc.key} className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent">
                {t(`delivery.schedule.${svc.i18n}`).slice(0, 3)} {count}d
              </span>
            ) : null;
          })}
          {isDirty && <span className="w-2 h-2 rounded-full bg-matrix-green animate-pulse" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" /> : <ChevronDown className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }} className="overflow-hidden">
            <div className="px-5 pb-4 space-y-3 border-t border-light-border/5 dark:border-dark-border/5 pt-3">
              {SERVICES.map(svc => (
                <ServiceBlock key={svc.key} svc={svc} schedule={openingHours?.[svc.key] || {}}
                  onChange={s => onHoursChange(svc.key, s)} t={t} />
              ))}
              {isDirty && (
                <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  onClick={onSave} disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-neon">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saveLabel}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// Main Tab
// ═══════════════════════════════════════════════════════════════════
const DeliveryScheduleTab = ({ appState, schedulingConfig: parentSchedConfig, onSaveSchedulingConfig }) => {
  const { t } = useTranslation();
  const s = (k) => t(`delivery.schedule.${k}`);
  const [locations, setLocations] = useState([]);
  const [hoursMap, setHoursMap] = useState({});
  const [dirtySet, setDirtySet] = useState(new Set());
  const [savingLoc, setSavingLoc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMonth, setActiveMonth] = useState(null);
  const [schedExpanded, setSchedExpanded] = useState(false);
  const [schedConfig, setSchedConfig] = useState({ ...SCHED_DEFAULTS, ...(parentSchedConfig || {}) });
  const [schedDirty, setSchedDirty] = useState(false);
  const origSchedRef = useRef(null);

  useEffect(() => {
    if (parentSchedConfig) {
      const merged = { ...SCHED_DEFAULTS, ...parentSchedConfig };
      setSchedConfig(merged);
      origSchedRef.current = JSON.stringify(merged);
    }
  }, [parentSchedConfig]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLocations(appState?.account, appState?.token);
      const locs = Array.isArray(data) ? data : data?.locations || [];
      setLocations(locs);
      const map = {};
      locs.forEach(l => { map[String(l._id)] = l.opening_hours || { dinein: {}, delivery: {}, pickup: {} }; });
      setHoursMap(map);
      setDirtySet(new Set());
    } catch (e) { console.error('[ScheduleTab] Load error:', e); }
    finally { setIsLoading(false); }
  }, [appState?.account, appState?.token]);

  useEffect(() => { load(); }, [load]);

  const handleHoursChange = (locId, serviceKey, schedule) => {
    setHoursMap(prev => ({ ...prev, [locId]: { ...(prev[locId] || {}), [serviceKey]: schedule } }));
    setDirtySet(prev => new Set(prev).add(locId));
  };

  const handleSaveLoc = async (locId) => {
    setSavingLoc(locId);
    try {
      await updateLocation({ locationId: locId, data: { opening_hours: hoursMap[locId] }, walletAddress: appState?.account, token: appState?.token });
      setDirtySet(prev => { const n = new Set(prev); n.delete(locId); return n; });
    } catch (e) { console.error('[ScheduleTab] Save error:', e); }
    finally { setSavingLoc(null); }
  };

  const handleSchedChange = (newConfig) => { setSchedConfig(newConfig); setSchedDirty(JSON.stringify(newConfig) !== origSchedRef.current); };
  const handleSaveSched = async () => { if (!onSaveSchedulingConfig) return; await onSaveSchedulingConfig(schedConfig); origSchedRef.current = JSON.stringify(schedConfig); setSchedDirty(false); };

  const allSpecialDates = useMemo(() => { const a = []; locations.forEach(l => (l.special_dates || []).forEach(sd => a.push(sd))); return a; }, [locations]);
  const specialDatesByLocation = useMemo(() => { const m = {}; locations.forEach(l => { m[String(l._id)] = l.special_dates || []; }); return m; }, [locations]);

  const handleSpecialDateSave = async (locIds, entry, action) => {
    for (const locId of locIds) {
      const loc = locations.find(l => String(l._id) === locId);
      if (!loc) continue;
      let existing = Array.isArray(loc.special_dates) ? [...loc.special_dates] : [];
      if (action === 'add') {
        if (!existing.find(d => d.date === entry.date)) existing.push(entry);
        existing.sort((a, b) => a.date.localeCompare(b.date));
      } else if (action === 'remove') {
        existing = existing.filter(d => d.date !== entry.date);
      }
      await updateLocation({ locationId: locId, data: { special_dates: existing }, walletAddress: appState?.account, token: appState?.token });
    }
    load();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-light-accent dark:text-dark-accent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary flex items-center gap-2">
            <Clock className="w-4 h-4 text-light-accent dark:text-dark-accent" />
            {s('title')}
          </h3>
          <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{s('subtitle')}</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-light-text-secondary dark:text-dark-text-secondary" />
        </button>
      </div>

      <YearTimeline year={new Date().getFullYear()} specialDates={allSpecialDates}
        activeMonth={activeMonth} onMonthClick={m => setActiveMonth(activeMonth === m ? null : m)} />

      <SpecialDatesManager locations={locations} specialDatesByLocation={specialDatesByLocation}
        onSave={handleSpecialDateSave} activeMonth={activeMonth} />

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary px-1">
          {s('locationsTitle')} ({locations.length})
        </p>
        {locations.map(loc => {
          const id = String(loc._id);
          return (
            <LocationCard key={id} location={loc} openingHours={hoursMap[id]}
              onHoursChange={(svc, sched) => handleHoursChange(id, svc, sched)}
              isSaving={savingLoc === id} onSave={() => handleSaveLoc(id)}
              isDirty={dirtySet.has(id)} t={t} />
          );
        })}
      </div>

      <SchedulingSection config={schedConfig} onChange={handleSchedChange}
        expanded={schedExpanded} onToggle={() => setSchedExpanded(!schedExpanded)} />
      {schedDirty && (
        <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSaveSched}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-xs font-bold hover:opacity-90 transition-all shadow-neon">
          <Save className="w-3.5 h-3.5" /> {s('saveProgramming')}
        </motion.button>
      )}
    </div>
  );
};

export default DeliveryScheduleTab;
