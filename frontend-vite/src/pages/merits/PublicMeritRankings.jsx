// src/pages/PublicMeritRankings.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useMeritRankings from '../../hooks/useMeritRankings.jsx';
import PublicToolbar from './components/publicDash/PublicToolbar.jsx';
import PublicTable from './components/publicDash/PublicTable.jsx';
import PublicMeritModal from './components/publicDash/PublicMeritModal.jsx';

const PublicMeritRankings = ({ appState }) => {
  const { t } = useTranslation();

  const {
    data,
    loading,
    error,
    filters: backendFilters,
    handleFilterChange,
    applyFilters,

    // historial (modal)
    historyOpen,
    historyLoading,
    historyError,
    historyData,
    historyPreview,
    showHistoryFor,
    closeHistory,
  } = useMeritRankings(appState);

  const [allEmployees, setAllEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilters, setClientFilters] = useState({ local: 'all', cargo: 'all' });

  // Toggle: Wallet vs Simulado (wallet + pending)
  const [mode, setMode] = useState('wallet'); // 'wallet' | 'simulated'

  useEffect(() => {
    if (data) setAllEmployees(data);
  }, [data]);

  // Sync backend ranking mode with page toggle
  useEffect(() => {
    handleFilterChange({ rank_mode: mode });
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const clientFilterOptions = useMemo(() => {
    const siglas = new Set();
    allEmployees.forEach((e) => e?.local && siglas.add(String(e.local)));
    const cargos = new Set(allEmployees.map((e) => e.cargo).filter(Boolean));
    return {
      locales: ['all', ...Array.from(siglas).sort()],
      cargos: ['all', ...Array.from(cargos).sort()],
    };
  }, [allEmployees]);

  const filtered = useMemo(() => {
    let result = [...allEmployees];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((emp) =>
        (emp.nombre || '').toLowerCase().includes(q) ||
        (emp.apellido || '').toLowerCase().includes(q) ||
        (emp.rut || '').includes(q)
      );
    }
    if (clientFilters.local !== 'all') result = result.filter((e) => e.local === clientFilters.local);
    if (clientFilters.cargo !== 'all') result = result.filter((e) => e.cargo === clientFilters.cargo);
    return result;
  }, [allEmployees, searchTerm, clientFilters]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-full mx-auto p-4 md:p-6 space-y-6 bg-dark-background text-dark-text">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold text-dark-text-primary tracking-tight">
          {t('merits.rankings_title')}
        </h1>
        <p className="text-dark-text-secondary mt-1">
          {t('merits.rankings_desc')}
        </p>
      </header>

      {error && (
        <div className="p-4 bg-dark-error/10 text-dark-error border border-dark-error/20 rounded-lg">
          <strong>{t('common.error', 'Error')}:</strong> {String(error)}
        </div>
      )}

      <PublicToolbar
        backendFilters={backendFilters}
        onBackendFilterChange={handleFilterChange}
        onApplyBackendFilters={applyFilters}
        isLoading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        clientFilters={clientFilters}
        setClientFilters={setClientFilters}
        clientFilterOptions={clientFilterOptions}
      />

      {/* Toggle de puntos: Wallet / Simulado */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-dark-text-secondary">
          {t('merits.mode_note')}
        </div>
        <div className="inline-flex rounded-lg overflow-hidden border border-dark-border/30 text-sm">
          <button
            onClick={() => setMode('wallet')}
            className={`px-3 py-1.5 transition-colors ${mode === 'wallet'
              ? 'bg-matrix-green/20 text-matrix-green font-semibold'
              : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
            title={t('merits.mode_wallet')}
          >
            {t('merits.mode_wallet')}
          </button>
          <button
            onClick={() => setMode('simulated')}
            className={`px-3 py-1.5 border-l border-dark-border/30 transition-colors ${mode === 'simulated'
              ? 'bg-matrix-green/20 text-matrix-green font-semibold'
              : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}
            title={t('merits.mode_simulated')}
          >
            {t('merits.mode_simulated')}
          </button>
        </div>
      </div>

      <PublicTable
        employees={filtered}
        loading={loading}
        mode={mode}
        onSelectEmployee={(emp) => showHistoryFor(emp)}
      />

      {/* Modal de perfil + historial */}
      <PublicMeritModal
        open={historyOpen}
        loading={historyLoading}
        error={historyError}
        data={historyData}
        preview={historyPreview}     // ⬅️ pre-llenado visual
        onClose={closeHistory}
      />
    </div>
  );
};

export default PublicMeritRankings;

export const pageMetadata = {
  path: '/app/public-merit-rankings',
  label: 'merits.label',
  category: 'analytics.Análisis',
  minRoleLevel: 1,
  maxRoleLevel: 7,
  order: 4,
  locations: ['sidebar'],
  description: 'merits.description',
  icon: 'FaMedal',
  isMainPage: false,
  isSearchable: true,
};
