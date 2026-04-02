import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, LoaderCircle, ListX, PencilLine, ChevronDown, Layers, Briefcase, Zap, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RuleEditModal from './RuleEditModal.jsx';

// --- Reusable UI Components ---

const Pill = ({ active }) => (
  <span
    className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-sm border ${
      active 
        ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20 dark:bg-matrix-green/20' 
        : 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20'
    }`}
  >
    <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-matrix-green' : 'bg-rose-500'} ${active ? 'animate-pulse' : ''}`} />
    {active ? 'Activa' : 'Inactiva'}
  </span>
);

const nf = new Intl.NumberFormat();

function ParamChips({ params = {} }) {
  const entries = Object.entries(params || {});
  if (!entries.length) return <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary italic">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {entries.map(([k, v]) => {
        const text =
          typeof v === 'object' ? JSON.stringify(v) :
          typeof v === 'number' ? nf.format(v) :
          String(v);
        const truncated = text.length > 30 ? `${text.slice(0, 30)}…` : text;
        return (
          <span
            key={k}
            title={`${k}: ${text}`}
            className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-dark-surface-secondary/50 border border-dark-border/5 dark:border-dark-border/20 text-[11px] font-mono shadow-sm"
          >
            <b className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">{k}</b>: 
            <span className="text-light-text-primary dark:text-gray-300 ml-1">{truncated}</span>
          </span>
        );
      })}
    </div>
  );
}

const Accordion = ({ title, icon: Icon, count, children, isOpen, onToggle, isInner = false }) => {
  const baseClasses = isInner 
    ? "rounded-2xl border border-dark-border/10 dark:border-dark-border/20 bg-gray-50/50 dark:bg-dark-surface-secondary/40 shadow-sm overflow-hidden" 
    : "rounded-[24px] border border-dark-border/10 dark:border-dark-border/30 bg-white/60 dark:bg-dark-surface-secondary/20 shadow-sm backdrop-blur-xl overflow-hidden";
    
  return (
    <div className={baseClasses}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-100 dark:hover:bg-dark-surface-secondary/60 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl transition-colors ${isInner ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
            <Icon size={18} strokeWidth={2.5} />
          </div>
          <span className={`capitalize font-bold tracking-tight ${isInner ? 'text-[15px]' : 'text-lg'} text-light-text-primary dark:text-dark-text-primary group-hover:text-black dark:group-hover:text-white transition-colors`}>
            {title}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-[11px] font-black text-light-text-secondary dark:text-dark-text-secondary">
            {count}
          </span>
        </div>
        <div className={`p-1.5 rounded-full transition-transform duration-300 ${isOpen ? 'rotate-180 bg-gray-200 dark:bg-gray-700' : 'bg-transparent group-hover:bg-gray-200 dark:group-hover:bg-gray-700'}`}>
          <ChevronDown size={18} className="text-light-text-secondary dark:text-dark-text-secondary" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { opacity: 1, height: 'auto' },
              collapsed: { opacity: 0, height: 0 },
            }}
            transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className={`p-5 border-t border-dark-border/10 dark:border-dark-border/20 ${isInner ? 'pt-4' : 'pt-5'}`}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main RuleList Component ---

const RuleList = ({
  isLoading,
  rules = [],
  onRefresh,
  onUpdate,
  loadTemplates,
  loadSegments,
  loadCatalogs,
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (key) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const groupedRules = useMemo(() => {
    const groups = {};
    if (!rules || rules.length === 0) return groups;

    rules.forEach(rule => {
      // Use "General" as fallback if scope is missing
      const sections = rule.scope?.secciones?.include?.length ? rule.scope.secciones.include : ['general'];
      const cargos = rule.scope?.cargos?.include?.length ? rule.scope.cargos.include : ['todos los cargos'];

      sections.forEach(sectionName => {
        if (!groups[sectionName]) groups[sectionName] = {};
        cargos.forEach(cargoName => {
          if (!groups[sectionName][cargoName]) groups[sectionName][cargoName] = [];
          groups[sectionName][cargoName].push(rule);
        });
      });
    });
    return groups;
  }, [rules]);

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      await onUpdate?.(payload);
      await onRefresh?.({});
    } finally {
      setSaving(false);
    }
  };

  const hasRules = Object.keys(groupedRules).length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/40 dark:bg-dark-surface-secondary/20 p-5 rounded-3xl border border-dark-border/10 dark:border-dark-border/20">
        <div>
          <h2 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">
            {t('gamification.rules_defined', 'Reglas Definidas')}
          </h2>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Explora o modifica las condiciones para ganar méritos.</p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-2xl bg-white dark:bg-dark-surface hover:scale-[1.02] active:scale-95 border border-dark-border/15 dark:border-dark-border/30 transition-all shadow-sm disabled:opacity-60 disabled:hover:scale-100 text-light-text-primary dark:text-dark-text-primary"
          onClick={() => onRefresh?.({})}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle size={16} className="animate-spin text-matrix-green" /> : <RefreshCcw size={16} className="text-matrix-green" />}
          {isLoading ? t('common.loading', 'Cargando…') : t('common.refresh', 'Refrescar')}
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading && !hasRules ? (
           <motion.div 
             key="loading"
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="flex flex-col items-center justify-center py-24 gap-4"
           >
              <div className="relative">
                <div className="absolute inset-0 blur-xl bg-matrix-green/20 rounded-full animate-pulse" />
                <LoaderCircle size={40} className="animate-spin text-matrix-green relative z-10" />
              </div>
              <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('common.loading', 'Cargando…')}</span>
          </motion.div>
        ) : !hasRules ? (
          <motion.div 
            key="empty"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-20 px-6 rounded-[32px] bg-white/60 dark:bg-dark-surface-secondary/40 border-2 border-dashed border-dark-border/15 dark:border-dark-border/30"
          >
            <div className="p-4 bg-gray-100 dark:bg-dark-surface rounded-2xl mb-4">
              <ListX size={48} className="text-light-text-secondary dark:text-dark-text-secondary" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary text-center">
              {t('gamification.no_rules_defined', 'Aún no se han definido reglas')}
            </h3>
            <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary text-center max-w-sm">
              {t('gamification.create_first_rule_hint', 'Las reglas determinan cómo tus empleados ganan méritos basados en ventas, asistencia o tiempos. Crea tu primera regla para empezar.')}
            </p>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {Object.entries(groupedRules).map(([sectionName, cargos]) => {
              const sectionKey = `section-${sectionName}`;
              const totalRulesInSection = Object.values(cargos).reduce((sum, list) => sum + list.length, 0);
              return (
                <Accordion
                  key={sectionKey}
                  title={sectionName}
                  icon={Layers}
                  count={totalRulesInSection}
                  isOpen={!!openItems[sectionKey]}
                  onToggle={() => toggleItem(sectionKey)}
                >
                  <div className="space-y-4">
                    {Object.entries(cargos).map(([cargoName, ruleList]) => {
                      const cargoKey = `cargo-${sectionName}-${cargoName}`;
                      return (
                        <Accordion
                          key={cargoKey}
                          title={cargoName}
                          icon={Briefcase}
                          count={ruleList.length}
                          isOpen={!!openItems[cargoKey]}
                          onToggle={() => toggleItem(cargoKey)}
                          isInner={true}
                        >
                          <div className="space-y-4">
                            {ruleList.map((rule, idx) => (
                              <div 
                                key={`${rule.rule_name}-${idx}`} 
                                className="group p-5 rounded-2xl bg-white dark:bg-dark-surface border border-dark-border/10 dark:border-dark-border/20 shadow-sm hover:shadow-md transition-shadow duration-300"
                              >
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                                  <div className="flex-grow space-y-4 w-full">
                                    <div className="flex items-center gap-3">
                                      <Pill active={!!rule.is_active} />
                                      <h4 className="font-black text-lg text-light-text-primary dark:text-dark-text-primary tracking-tight">{rule.rule_name}</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm bg-gray-50/50 dark:bg-transparent p-4 sm:p-0 rounded-xl">
                                      <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 flex items-center gap-1"><Zap size={10} /> Recompensa</div>
                                        <div className="text-matrix-green font-black text-xl">{nf.format(Number(rule.merit_points || 0))} <span className="text-xs font-bold opacity-60">pts</span></div>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1 flex items-center gap-1"><Settings2 size={10} /> Template ID</div>
                                        <div className="font-mono text-xs bg-gray-200 dark:bg-gray-800 text-light-text-primary dark:text-gray-300 px-2 py-1 rounded-lg inline-block">{rule.template_key}</div>
                                      </div>
                                      <div className="sm:col-span-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-light-text-secondary dark:text-dark-text-secondary mb-1">Parámetros Dinámicos</div>
                                        <ParamChips params={rule.params || rule.trigger_params} />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 w-full md:w-auto flex md:justify-end">
                                    <button
                                      className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border border-dark-border/20 dark:border-dark-border/30 bg-white dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary hover:border-matrix-green hover:text-matrix-green transition-all focus:ring-2 focus:ring-matrix-green/30"
                                      onClick={() => setEditing(rule)}
                                    >
                                      <PencilLine size={16} />
                                      {t('common.edit', 'Editar')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Accordion>
                      );
                    })}
                  </div>
                </Accordion>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de edición */}
      <RuleEditModal
        open={!!editing}
        rule={editing}
        onClose={() => setEditing(null)}
        onSave={handleSubmit}
        isSaving={saving}
        loadTemplates={loadTemplates}
        loadSegments={loadSegments}
        loadCatalogs={loadCatalogs}
      />
    </div>
  );
};

export default RuleList;