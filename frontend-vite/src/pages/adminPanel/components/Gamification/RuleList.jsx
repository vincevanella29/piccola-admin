// src/pages/components/Gamification/RuleList.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, LoaderCircle, ListX } from 'lucide-react';

const RuleList = ({ isLoading, rules = [], onRefresh }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary">{t('gamification.rules_defined') || 'Reglas Definidas'}</h2>
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface dark:hover:bg-dark-surface border border-dark-border/20 transition-all disabled:opacity-60"
          onClick={() => onRefresh?.({})}
          disabled={isLoading}
        >
          {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          {isLoading ? (t('common.loading') || 'Cargando…') : (t('common.refresh') || 'Refrescar')}
        </button>
      </div>

      {rules.length === 0 && !isLoading ? (
        <div className="text-center py-16 px-6 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary/40 border border-dashed border-dark-border/20">
          <ListX size={40} className="mx-auto text-dark-text-secondary" />
          <h3 className="mt-4 text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">
            {t('gamification.no_rules_defined') || 'Aún no se han definido reglas'}
          </h3>
          <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
            Crea tu primera regla en la pestaña "Crear".
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dark-border/20">
          <table className="min-w-full text-sm">
            <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Nombre Regla</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Puntos</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Template</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Parámetros</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/20">
              {rules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-light-surface/40 dark:hover:bg-dark-surface-secondary/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold">{rule.rule_name}</td>
                  <td className="px-6 py-4 text-matrix-green font-bold text-base">{rule.merit_points}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{rule.template_key || rule.trigger_type || '-'}</td>
                  <td className="px-6 py-4">
                    <pre className="text-xs bg-light-surface dark:bg-dark-surface p-2 rounded-md font-mono max-h-28 overflow-y-auto">{JSON.stringify(rule.params || rule.trigger_params || {}, null, 2)}</pre>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${rule.is_active ? 'bg-matrix-green/20 text-matrix-green' : 'bg-rose-500/20 text-rose-400'}`}>
                      {rule.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RuleList;