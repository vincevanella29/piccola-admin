// src/components/promotions/sections/rules/components/MeritRuleModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const MeritRuleModal = ({ isOpen, onClose, meritRules, onSelect, t, initialRuleName }) => {
  const [searchText, setSearchText] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedCargo, setSelectedCargo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSearchText(initialRuleName || '');
    }
  }, [isOpen, initialRuleName]);

  // Lógica original de extracción de catálogos
  const allSections = useMemo(() => Array.from(
    new Set((meritRules || []).flatMap((r) => r.scope?.secciones?.include || []))
  ).sort(), [meritRules]);

  const allCargos = useMemo(() => Array.from(
    new Set((meritRules || []).flatMap((r) => r.scope?.cargos?.include || []))
  ).sort(), [meritRules]);

  // Lógica original de filtrado
  const filteredMeritRules = useMemo(() => {
    if (!Array.isArray(meritRules)) return [];
    return meritRules.filter((r) => {
      if (selectedSection) {
        const secs = r.scope?.secciones?.include || [];
        if (!secs.includes(selectedSection)) return false;
      }
      if (selectedCargo) {
        const cargos = r.scope?.cargos?.include || [];
        if (!cargos.includes(selectedCargo)) return false;
      }
      if (searchText) {
        const name = (r.rule_name || '').toLowerCase();
        if (!name.includes(searchText.toLowerCase())) return false;
      }
      return true;
    });
  }, [meritRules, selectedSection, selectedCargo, searchText]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-black/5"
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-10">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {t('promotion.rules.select_merit_rule_title')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('promotion.rules.select_merit_rule_subtitle')}
              </p>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors">
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Filters Toolbar */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30 border-b border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('promotion.rules.search_rule_placeholder')}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-matrix-green/50 focus:border-matrix-green transition-all"
              />
            </div>
            {allSections.length > 0 && (
              <div className="sm:col-span-3">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full py-2 px-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-matrix-green/50"
                >
                  <option value="">{t('promotion.rules.filter_all_sections')}</option>
                  {allSections.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {allCargos.length > 0 && (
              <div className="sm:col-span-3">
                 <select
                  value={selectedCargo}
                  onChange={(e) => setSelectedCargo(e.target.value)}
                  className="w-full py-2 px-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-matrix-green/50"
                >
                  <option value="">{t('promotion.rules.filter_all_cargos')}</option>
                  {allCargos.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-neutral-100/50 dark:bg-black/20">
            {filteredMeritRules.length === 0 && (
              <div className="text-center py-10 text-neutral-500 text-sm">
                {t('promotion.rules.no_merit_rules_filtered')}
              </div>
            )}
            {filteredMeritRules.map((rule) => (
              <button
                key={rule.rule_name}
                onClick={() => onSelect(rule)}
                className="w-full text-left p-4 rounded-xl bg-white dark:bg-neutral-800 border border-transparent hover:border-matrix-green/50 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm group-hover:text-matrix-green transition-colors">
                    {rule.rule_name}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300">
                    {rule.template_key}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>
                    {rule.params?.position_type === 'top_n' ? `Top ${rule.params?.position_to}` : `Pos: ${rule.params?.ranking_position}`}
                  </span>
                  <span>•</span>
                  <span>Segmento #{rule.segment_token_id} ({rule.merit_points} pts)</span>
                  {rule.params?.metric && (
                    <>
                      <span>•</span>
                      <span className="text-matrix-green dark:text-matrix-green/80 font-medium">
                        {rule.params.metric}
                      </span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeritRuleModal;