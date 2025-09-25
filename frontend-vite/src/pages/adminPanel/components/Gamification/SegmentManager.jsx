// src/pages/adminPanel/components/Gamification/SegmentManager.jsx

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { PlusCircle, LoaderCircle, RefreshCcw, ShieldCheck, Zap } from 'lucide-react';

const SegmentManager = ({ isLoading, segments = [], onSegmentCreate, onDaoAllow, onRefresh, onBootstrapSpecial, onAuthorizeAll }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await onSegmentCreate?.({ name, symbol });
      if (res?.hash || res?.data?.hash) toast.success(t('gamification.tx_sent') || 'Transacción enviada con éxito');
      setTimeout(() => onRefresh?.(), 5000);
      setName('');
      setSymbol('');
    } catch (err) {
      toast.error(err?.message || 'Error al crear segmento');
    }
  };

  const handleAllowDao = async (tokenId) => {
    try {
      const res = await onDaoAllow?.({ token_id: tokenId });
      if (res?.hash || res?.data?.hash) toast.success(t('gamification.tx_sent') || 'Transacción enviada con éxito');
    } catch (err) {
      toast.error(err?.message || 'Error al autorizar DAO');
    }
  };

  const handleBootstrap = async () => {
    try {
      await onBootstrapSpecial?.({});
      toast.success(t('gamification.bootstrap_done') || 'S.P.E.C.I.A.L. creado y autorizado');
      setTimeout(() => onRefresh?.(), 6000);
    } catch (err) {
      toast.error(err?.message || 'Error en bootstrap');
    }
  };

  const handleAuthorizeAll = async () => {
    try {
      await onAuthorizeAll?.();
      toast.success(t('gamification.authorize_all_done') || 'DAO autorizada para todos los segmentos');
    } catch (err) {
      toast.error(err?.message || 'Error al autorizar todos');
    }
  };

  const inputStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition";

  return (
    <div className="space-y-8">
      {/* Panel de Creación */}
      <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">
        <h3 className="text-lg font-bold">{t('gamification.create_title') || 'Crear Nuevo Segmento (On-Chain)'}</h3>
        <p className="text-sm text-dark-text-secondary mt-1 mb-6">{t('gamification.create_desc') || 'Crea un nuevo CategoryToken en GlobalMeritocracy.'}</p>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputStyles} placeholder={t('gamification.name_ph') || 'Nombre (e.g., Cocina)'} required />
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className={inputStyles} placeholder={t('gamification.symbol_ph') || 'Símbolo (e.g., COC)'} maxLength={6} required />
          <button type="submit" className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 disabled:opacity-50 transition-opacity h-10" disabled={isLoading}>
            {isLoading ? <LoaderCircle className="animate-spin" size={20} /> : <PlusCircle size={20} />}
            {t('gamification.create_btn') || 'Crear Segmento'}
          </button>
        </form>
      </div>
      
      {/* Panel de Acciones Globales */}
      <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">
        <h3 className="text-lg font-bold">Acciones Globales</h3>
        <p className="text-sm text-dark-text-secondary mt-1 mb-6">Ejecuta acciones que afectan a múltiples segmentos o a la configuración inicial.</p>
        <div className="flex flex-wrap gap-3">
            <button onClick={handleBootstrap} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/20 disabled:opacity-50 transition" disabled={isLoading}><Zap size={16}/> {t('gamification.bootstrap_special') || 'Bootstrap S.P.E.C.I.A.L.'}</button>
            <button onClick={handleAuthorizeAll} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-dark-surface-secondary hover:bg-dark-surface border border-dark-border/20 disabled:opacity-50 transition" disabled={isLoading}><ShieldCheck size={16}/> {t('gamification.authorize_all') || 'Autorizar DAO en todos'}</button>
        </div>
      </div>

      {/* Panel de Listado */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">{t('gamification.list_title') || 'Segmentos Existentes'}</h3>
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-surface dark:hover:bg-dark-surface border border-dark-border/20 transition-all disabled:opacity-60" disabled={isLoading}>
            {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {t('gamification.refresh') || 'Refrescar'}
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-dark-border/20">
          <table className="min-w-full text-sm">
            <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Token ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">{t('gamification.name') || 'Nombre'}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">{t('gamification.symbol') || 'Símbolo'}</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">{t('gamification.actions') || 'Acciones'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/20">
              {segments.map((seg) => (
                <tr key={seg.token_id} className="hover:bg-light-surface/40 dark:hover:bg-dark-surface-secondary/40 transition-colors">
                  <td className="px-6 py-4 font-mono">{seg.token_id}</td>
                  <td className="px-6 py-4">{seg.name}</td>
                  <td className="px-6 py-4 font-mono">{seg.symbol}</td>
                  <td className="px-6 py-4">
                    {seg.allowed ? (
                      <span className="px-3 py-1.5 text-xs font-semibold rounded-md bg-matrix-green/15 text-matrix-green border border-matrix-green/30">
                        {t('gamification.dao_authorized') || 'DAO autorizada'}
                      </span>
                    ) : (
                      <button onClick={() => handleAllowDao(seg.token_id)} className="text-xs px-3 py-1.5 font-semibold rounded-md border border-matrix-green/50 text-matrix-green hover:bg-matrix-green/10 transition" title={t('gamification.allow_dao_tip') || 'Autoriza a la DAO a mintear en este segmento'}>
                        {t('gamification.allow_dao') || 'Autorizar DAO'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!segments || segments.length === 0) && !isLoading && (
              <div className="text-center py-12 text-sm text-dark-text-secondary">{t('gamification.empty') || 'No hay segmentos creados aún.'}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SegmentManager;