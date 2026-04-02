import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PlusCircle, LoaderCircle, RefreshCcw, UserX, UserCheck, ShieldQuestion } from 'lucide-react';

const FastMinterManager = ({ api }) => {
  const { t } = useTranslation();
  const { fastMinters, listFastMinters, setFastMinter, isLoading } = api;
  const [newMinter, setNewMinter] = useState('');

  useEffect(() => {
    listFastMinters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newMinter.trim()) return;
    try {
      await setFastMinter({ minterWallet: newMinter, enabled: true });
      setNewMinter('');
    } catch (error) {
      // El hook ya se encarga de mostrar el toast de error
    }
  };

  const handleToggle = async (minter, currentStatus) => {
    try {
      await setFastMinter({ minterWallet: minter, enabled: !currentStatus });
    } catch (error) {
      // El hook ya se encarga de mostrar el toast de error
    }
  };

  const inputStyles = "w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border/30 rounded-xl px-4 py-3 text-light-text-primary dark:text-dark-text-primary shadow-sm focus:ring-2 focus:ring-matrix-green/30 focus:border-matrix-green transition-all outline-none";

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Columna Izquierda: Añadir Minter */}
      <div className="lg:col-span-1">
        <div className="bg-white/60 dark:bg-dark-surface-secondary/40 backdrop-blur-xl border border-dark-border/10 dark:border-dark-border/20 rounded-[32px] p-6 sm:p-8 sticky top-8 shadow-sm">
          <div className="mb-8">
            <h3 className="text-xl font-bold tracking-tight text-light-text-primary dark:text-dark-text-primary">{t('gamification.minter.add_title') || 'Add Fast Minter'}</h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">{t('gamification.minter.add_desc') || 'Wallets added here will be able to execute merit batches on behalf of the DAO.'}</p>
          </div>
          
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider">Wallet Address</label>
              <input 
                value={newMinter} 
                onChange={(e) => setNewMinter(e.target.value)} 
                className={inputStyles} 
                placeholder={t('gamification.minter.address_ph') || '0x... wallet address'} 
                required 
              />
            </div>
            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-black bg-matrix-green hover:bg-emerald-400 border border-matrix-green/30 shadow-lg shadow-matrix-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed" 
              disabled={isLoading || !newMinter.trim()}
            >
              {isLoading ? <LoaderCircle className="animate-spin" size={18} /> : <PlusCircle size={18} />}
              <span>{t('gamification.minter.add_btn') || 'Add and Enable'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Columna Derecha: Lista de Minters */}
      <div className="lg:col-span-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white/40 dark:bg-dark-surface-secondary/20 p-5 rounded-3xl border border-dark-border/10 dark:border-dark-border/20">
          <div>
            <h3 className="text-2xl font-black text-light-text-primary dark:text-dark-text-primary tracking-tight">{t('gamification.minter.list_title') || 'Authorized Minters'}</h3>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-0.5">Administra los accesos de las wallets para minteo rápido.</p>
          </div>
          <button 
            onClick={() => listFastMinters()} 
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold bg-white dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary border border-dark-border/15 dark:border-dark-border/30 hover:scale-[1.02] active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:hover:scale-100 transition-all" 
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle size={16} className="animate-spin text-matrix-green" /> : <RefreshCcw size={16} className="text-matrix-green" />}
            <span>{t('gamification.refresh') || 'Refresh'}</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-dark-border/10 dark:border-dark-border/20 bg-white/70 dark:bg-dark-surface/40 backdrop-blur-md shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-dark-surface-secondary/50 text-[11px] uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary border-b border-dark-border/10 dark:border-dark-border/20">
                  <th className="px-6 py-4 font-bold">{t('gamification.minter.col_address') || 'Minter Address'}</th>
                  <th className="px-6 py-4 font-bold">{t('gamification.minter.col_status') || 'Status'}</th>
                  <th className="px-6 py-4 font-bold text-center">{t('gamification.minter.col_actions') || 'Access'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/5 dark:divide-dark-border/10">
                {fastMinters.map((minter) => (
                  <tr key={minter.minter} className="group hover:bg-white/90 dark:hover:bg-dark-surface-secondary/40 transition-colors">
                    <td className="px-6 py-5 font-mono text-sm text-light-text-primary dark:text-gray-300 font-medium">
                      {`${minter.minter.slice(0, 10)}...${minter.minter.slice(-8)}`}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase border ${minter.enabled ? 'bg-matrix-green/10 text-matrix-green border-matrix-green/20 dark:bg-matrix-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${minter.enabled ? 'bg-matrix-green animate-pulse' : 'bg-red-500'}`} />
                        {minter.enabled ? (t('gamification.minter.enabled') || 'Enabled') : (t('gamification.minter.disabled') || 'Disabled')}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative flex items-center p-1 rounded-full bg-gray-200 dark:bg-dark-surface border border-gray-300 dark:border-dark-border/40 shadow-inner overflow-hidden">
                              <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={minter.enabled}
                                  onChange={() => handleToggle(minter.minter, minter.enabled)}
                                  // disabled={isLoading} // Optional: block toggle when loading
                              />
                              <div className={`block w-10 h-5 rounded-full transition-colors duration-300 ${minter.enabled ? 'bg-matrix-green' : 'bg-transparent'}`}></div>
                              <div className={`absolute left-1 bg-white dark:bg-gray-200 shadow-md w-5 h-5 rounded-full transition-transform duration-300 ${minter.enabled ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {fastMinters.length === 0 && !isLoading && (
            <div className="text-center py-16 px-6 text-sm flex flex-col items-center gap-4 bg-gray-50/30 dark:bg-transparent">
              <div className="p-4 bg-gray-100 dark:bg-dark-surface rounded-2xl">
                <ShieldQuestion size={40} className="text-light-text-secondary dark:text-dark-text-secondary opacity-80" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary mb-1">Sin accesos configurados</h4>
                <p className="text-light-text-secondary dark:text-dark-text-secondary">{t('gamification.minter.empty') || 'No Fast Minters configured yet.'}</p>
              </div>
            </div>
          )}
          {isLoading && fastMinters.length === 0 && (
             <div className="text-center py-24 text-sm flex flex-col justify-center items-center gap-4 bg-gray-50/30 dark:bg-transparent">
                <div className="relative">
                  <div className="absolute inset-0 blur-xl bg-matrix-green/20 rounded-full animate-pulse" />
                  <LoaderCircle size={32} className="animate-spin text-matrix-green relative z-10" />
                </div>
                <span className="font-semibold text-light-text-secondary dark:text-dark-text-secondary">{t('gamification.loading') || 'Loading…'}</span>
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default FastMinterManager;