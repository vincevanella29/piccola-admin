import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, LoaderCircle, ListX, PencilLine, ChevronDown, Layers, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RuleEditModal from './RuleEditModal.jsx';

// --- Reusable UI Components ---

const Pill = ({ active }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
      active ? 'bg-matrix-green/20 text-matrix-green' : 'bg-rose-500/20 text-rose-400'
    }`}
  >
    {active ? 'Activa' : 'Inactiva'}
  </span>
);

const nf = new Intl.NumberFormat();

function ParamChips({ params = {} }) {
  const entries = Object.entries(params || {});
  if (!entries.length) return <span className="text-xs text-dark-text-secondary">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
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
            className="px-2 py-0.5 rounded-md bg-dark-surface-secondary/50 border border-dark-border/30 text-xs font-mono"
          >
            <b className="font-semibold text-dark-text-secondary">{k}</b>: {truncated}
          </span>
        );
      })}
    </div>
  );
}

const Accordion = ({ title, icon: Icon, count, children, isOpen, onToggle }) => (
  <div className="rounded-lg border border-dark-border/20 bg-dark-surface-secondary/20 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-dark-surface-secondary/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-dark-text-secondary" />
        <span className="capitalize">{title}</span>
        <span className="px-2 py-0.5 rounded-md bg-dark-surface-secondary text-xs font-mono text-dark-text-secondary">{count}</span>
      </div>
      <ChevronDown
        size={20}
        className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
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
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="p-4 border-t border-dark-border/20">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
          {t('gamification.rules_defined', 'Reglas Definidas')}
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface dark:hover:bg-dark-surface border border-dark-border/20 transition-all disabled:opacity-60"
          onClick={() => onRefresh?.({})}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          {isLoading ? t('common.loading', 'Cargando…') : t('common.refresh', 'Refrescar')}
        </button>
      </div>

      {/* Content */}
      {isLoading && !hasRules ? (
         <div className="text-center py-16">
            <LoaderCircle size={24} className="animate-spin inline-block mr-2" />
            {t('common.loading', 'Cargando…')}
        </div>
      ) : !hasRules ? (
        <div className="text-center py-16 px-6 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary/40 border border-dashed border-dark-border/20">
          <ListX size={40} className="mx-auto text-dark-text-secondary" />
          <h3 className="mt-4 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
            {t('gamification.no_rules_defined', 'Aún no se han definido reglas')}
          </h3>
          <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {t('gamification.create_first_rule_hint', 'Crea tu primera regla para empezar.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
                <div className="space-y-3">
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
                      >
                        <div className="space-y-4">
                          {ruleList.map((rule, idx) => (
                            <div key={`${rule.rule_name}-${idx}`} className="p-4 rounded-md bg-dark-surface-secondary/40 border border-dark-border/20">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow space-y-3">
                                  <div className="flex items-center gap-3">
                                    <Pill active={!!rule.is_active} />
                                    <h4 className="font-semibold text-base">{rule.rule_name}</h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                    <div>
                                      <div className="text-xs font-semibold uppercase text-dark-text-secondary mb-1">Puntos</div>
                                      <div className="text-matrix-green font-bold text-base">{nf.format(Number(rule.merit_points || 0))}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold uppercase text-dark-text-secondary mb-1">Template</div>
                                      <div className="font-mono text-xs">{rule.template_key}</div>
                                    </div>
                                    <div className="col-span-full">
                                      <div className="text-xs font-semibold uppercase text-dark-text-secondary mb-1">Parámetros</div>
                                      <ParamChips params={rule.params || rule.trigger_params} />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex-shrink-0">
                                  <button
                                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-dark-border/30 hover:bg-dark-surface-secondary"
                                    onClick={() => setEditing(rule)}
                                    title={t('common.edit', 'Editar')}
                                  >
                                    <PencilLine size={14} />
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
        </div>
      )}

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