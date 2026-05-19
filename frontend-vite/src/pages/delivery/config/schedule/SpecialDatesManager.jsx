// schedule/SpecialDatesManager.jsx — Apple-style holiday/closure manager
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarX2, Plus, Trash2, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';

const SpecialDatesManager = ({ locations = [], specialDatesByLocation = {}, onSave, activeMonth = null }) => {
  const { t } = useTranslation();
  const s = (k) => t(`delivery.schedule.${k}`);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: '', label: '', closed: true, open: '10:00', close: '15:00' });
  const [selectedLocs, setSelectedLocs] = useState(new Set());
  const [expanded, setExpanded] = useState(true);

  const allDates = useMemo(() => {
    const map = new Map();
    locations.forEach(loc => {
      const dates = specialDatesByLocation[String(loc._id)] || [];
      dates.forEach(sd => {
        if (!sd.date) return;
        if (!map.has(sd.date)) map.set(sd.date, { ...sd, locations: [] });
        map.get(sd.date).locations.push({ id: String(loc._id), name: loc.nombre });
      });
    });
    let arr = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    if (activeMonth !== null) {
      arr = arr.filter(sd => new Date(sd.date + 'T00:00:00').getMonth() === activeMonth);
    }
    return arr;
  }, [locations, specialDatesByLocation, activeMonth]);

  const toggleLoc = (id) => setSelectedLocs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllLocs = () => setSelectedLocs(new Set(locations.map(l => String(l._id))));

  const handleAdd = () => {
    if (!draft.date || selectedLocs.size === 0) return;
    const entry = { date: draft.date, label: draft.label || 'Cierre', closed: draft.closed };
    if (!draft.closed) { entry.open = draft.open; entry.close = draft.close; }
    onSave?.(Array.from(selectedLocs), entry, 'add');
    setDraft({ date: '', label: '', closed: true, open: '10:00', close: '15:00' });
    setAdding(false);
    setSelectedLocs(new Set());
  };

  const handleRemove = (date, locIds) => onSave?.(locIds, { date }, 'remove');

  const formatDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

  const inputCls = "px-3 py-2 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/15 dark:border-dark-border/15 text-xs text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30 placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary";
  const timeCls = "px-2 py-1 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/15 dark:border-dark-border/15 text-[11px] text-light-text-primary dark:text-dark-text-primary outline-none";

  return (
    <div className="rounded-2xl border border-light-border/10 dark:border-dark-border/10 overflow-hidden bg-light-surface/60 dark:bg-dark-surface/60 backdrop-blur-xl">
      <div onClick={() => setExpanded(!expanded)}
        className="w-full cursor-pointer flex items-center justify-between px-5 py-4 hover:bg-light-surface-secondary/30 dark:hover:bg-dark-surface-secondary/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-light-error/10 dark:bg-dark-error/10 flex items-center justify-center">
            <CalendarX2 className="w-4 h-4 text-light-error dark:text-dark-error" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{s('specialDates')}</p>
            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
              {s('specialDatesDesc')} · {allDates.length} {s('configured')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); setAdding(true); setExpanded(true); selectAllLocs(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error text-[11px] font-bold hover:bg-light-error/20 dark:hover:bg-dark-error/20 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {s('addBtn')}
          </motion.button>
          {expanded ? <ChevronUp className="w-4 h-4 text-light-text-secondary" /> : <ChevronDown className="w-4 h-4 text-light-text-secondary" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.1, duration: 0.35 }} className="overflow-hidden">
            <div className="px-5 pb-4 space-y-2">
              {/* Add Form */}
              <AnimatePresence>
                {adding && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-xl bg-light-error/5 dark:bg-dark-error/5 border border-light-error/15 dark:border-dark-error/15 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-light-error dark:text-dark-error">{s('newSpecialDate')}</span>
                        <button onClick={() => setAdding(false)} className="p-1 rounded-lg hover:bg-light-error/10 dark:hover:bg-dark-error/10 text-light-error dark:text-dark-error"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="flex gap-2">
                        <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} className={`flex-1 ${inputCls}`} />
                        <input type="text" placeholder={s('datePlaceholder')} value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} className={`flex-1 ${inputCls}`} />
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setDraft(d => ({ ...d, closed: !d.closed }))}
                          className={`relative w-10 h-5 rounded-full transition-all ${draft.closed ? 'bg-light-error dark:bg-dark-error' : 'bg-light-success dark:bg-dark-success'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.closed ? '' : 'translate-x-5'}`} />
                        </button>
                        <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                          {draft.closed ? s('closedAllDay') : s('specialHours')}
                        </span>
                        {!draft.closed && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Clock className="w-3 h-3 text-light-success dark:text-dark-success" />
                            <input type="time" value={draft.open} onChange={e => {
                                let o = e.target.value, c = draft.close;
                                if (o >= c) {
                                    let mins = parseInt(o.split(':')[0])*60 + parseInt(o.split(':')[1]) + 30;
                                    if (mins >= 1440) { mins = 1439; o = '23:29'; }
                                    c = `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
                                }
                                setDraft(d => ({ ...d, open: o, close: c }));
                            }} className={timeCls} />
                            <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">→</span>
                            <input type="time" value={draft.close} onChange={e => {
                                let c = e.target.value, o = draft.open;
                                if (o >= c) {
                                    let mins = parseInt(c.split(':')[0])*60 + parseInt(c.split(':')[1]) - 30;
                                    if (mins < 0) { mins = 0; c = '00:30'; }
                                    o = `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
                                }
                                setDraft(d => ({ ...d, open: o, close: c }));
                            }} className={timeCls} />
                          </div>
                        )}
                      </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary">{s('applyTo')}</span>
                        <button onClick={selectAllLocs} className="text-[10px] text-light-accent dark:text-dark-accent font-semibold hover:underline">{s('allLocations')}</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {locations.map(loc => {
                          const id = String(loc._id);
                          const sel = selectedLocs.has(id);
                          return (
                            <button key={id} onClick={() => toggleLoc(id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                sel ? 'bg-light-accent dark:bg-dark-accent text-white' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                              }`}>
                              {loc.nombre}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleAdd}
                      disabled={!draft.date || selectedLocs.size === 0}
                      className="w-full py-2 rounded-xl bg-light-error dark:bg-dark-error text-white text-xs font-bold hover:bg-light-error-hover dark:hover:bg-dark-error-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      {s('addDateBtn')}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {allDates.length === 0 && !adding && (
                <div className="flex flex-col items-center py-8 gap-2 opacity-40">
                  <CalendarX2 className="w-6 h-6 text-light-text-secondary dark:text-dark-text-secondary" />
                  <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{s('noSpecialDates')}</p>
                  <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{s('noSpecialDatesHint')}</p>
                </div>
              )}
              {allDates.map((sd, i) => (
                <motion.div key={sd.date + i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                    sd.closed
                      ? 'border-light-error/15 dark:border-dark-error/15 bg-light-error/4 dark:bg-dark-error/6'
                      : 'border-light-accent/15 dark:border-dark-accent/15 bg-light-accent/4 dark:bg-dark-accent/6'
                  }`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sd.closed ? 'bg-light-error dark:bg-dark-error' : 'bg-light-accent dark:bg-dark-accent'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary">{formatDate(sd.date)}</span>
                      <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary truncate">{sd.label}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {sd.locations?.map(l => (
                        <span key={l.id} className="text-[9px] px-1.5 py-0.5 rounded bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">{l.name}</span>
                      ))}
                      {!sd.closed && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent font-semibold ml-1">
                          {sd.open} - {sd.close}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleRemove(sd.date, sd.locations?.map(l => l.id) || [])}
                    className="shrink-0 p-1.5 rounded-lg text-light-error dark:text-dark-error hover:bg-light-error/10 dark:hover:bg-dark-error/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpecialDatesManager;
