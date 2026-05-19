// schedule/SchedulingSection.jsx — ASAP/slot config (absorbed from SchedulingTab)
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Calendar, Clock, Hourglass, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

const Toggle = ({ label, desc, icon: Icon, value, onChange }) => (
  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl border border-light-border/10 dark:border-dark-border/10">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
      </div>
      <div>
        <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{desc}</p>
      </div>
    </div>
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 ${value ? 'bg-matrix-green' : 'bg-light-border dark:bg-dark-border'}`}>
      <motion.span layout className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ${value ? 'left-[22px]' : 'left-0.5'}`}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
    </button>
  </div>
);

const Slider = ({ label, desc, icon: Icon, value, min, max, display, onChange }) => (
  <div className="px-4 py-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl border border-light-border/10 dark:border-dark-border/10">
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-light-accent dark:text-dark-accent" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{label}</p>
        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{desc}</p>
      </div>
      <span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-matrix-green/10 text-matrix-green min-w-[50px] text-center">{display}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1 rounded-full appearance-none cursor-pointer accent-matrix-green bg-light-surface-secondary dark:bg-dark-surface-secondary" />
  </div>
);

const SchedulingSection = ({ config, onChange, expanded, onToggle }) => {
  const { t } = useTranslation();
  const s = (k) => t(`delivery.schedule.${k}`);
  const update = (key, val) => onChange({ ...config, [key]: val });

  const INTERVAL_OPTIONS = [
    { value: 15, label: s('min15') }, { value: 30, label: s('min30') }, { value: 45, label: s('min45') },
    { value: 60, label: s('hour1') }, { value: 90, label: s('hour1half') }, { value: 120, label: s('hour2') },
  ];
  const advLabel = (v) => {
    if (v === 0) return s('todayOnly');
    if (v === 1) return s('todayTomorrow');
    if (v === 7) return s('oneWeek');
    return t('delivery.schedule.nDays', { n: v });
  };

  return (
    <div className="rounded-2xl border border-light-border/10 dark:border-dark-border/10 overflow-hidden bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl">
      <button onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4 text-light-accent dark:text-dark-accent" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{s('schedulingTitle')}</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{s('schedulingDesc')}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" /> : <ChevronDown className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-4 space-y-2">
            <Toggle icon={Rocket} label={s('asapLabel')} desc={s('asapDesc')} value={config.allow_asap} onChange={v => update('allow_asap', v)} />
            <Toggle icon={Calendar} label={s('scheduledLabel')} desc={s('scheduledDesc')} value={config.scheduling_enabled} onChange={v => update('scheduling_enabled', v)} />
            {config.scheduling_enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2 border-l-2 border-light-accent/20 dark:border-dark-accent/20 ml-3">
                <div className="pl-3 space-y-2">
                  <Slider icon={Calendar} label={s('advanceDays')} desc={s('advanceDaysDesc')}
                    value={config.advance_days} min={0} max={10} display={advLabel(config.advance_days)} onChange={v => update('advance_days', v)} />
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl border border-light-border/10 dark:border-dark-border/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center"><Clock className="w-4 h-4 text-light-accent dark:text-dark-accent" /></div>
                      <div><p className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{s('slotInterval')}</p><p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{s('slotIntervalDesc')}</p></div>
                    </div>
                    <select value={config.slot_interval_minutes} onChange={e => update('slot_interval_minutes', Number(e.target.value))}
                      className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/15 dark:border-dark-border/15 text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30">
                      {INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <Slider icon={Hourglass} label={s('minLead')} desc={s('minLeadDesc')}
                    value={config.min_lead_time_minutes} min={0} max={180} display={`${config.min_lead_time_minutes} min`} onChange={v => update('min_lead_time_minutes', v)} />
                  <Slider icon={SlidersHorizontal} label={s('maxSlots')} desc={s('maxSlotsDesc')}
                    value={config.max_slots_per_day} min={1} max={150} display={config.max_slots_per_day} onChange={v => update('max_slots_per_day', v)} />
                </div>
              </motion.div>
            )}
            {!config.allow_asap && !config.scheduling_enabled && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-light-error/10 dark:bg-dark-error/10 border border-light-error/20 dark:border-dark-error/20 text-xs text-light-error dark:text-dark-error font-bold">
                <span className="w-2 h-2 rounded-full bg-light-error dark:bg-dark-error animate-pulse" /> ⚠️ {s('bothDisabled')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchedulingSection;
