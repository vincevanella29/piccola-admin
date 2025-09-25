// src/pages/adminPanel/components/Gamification/FastMinterManager.jsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PlusCircle, LoaderCircle, RefreshCcw, ToggleLeft, ToggleRight, UserX, UserCheck, ShieldQuestion } from 'lucide-react';
import { toast } from 'react-toastify';

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

  const inputStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition";

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Columna Izquierda: Añadir Minter */}
      <div className="lg:col-span-1">
        <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6 sticky top-8">
          <h3 className="text-lg font-bold">{t('gamification.minter.add_title') || 'Add Fast Minter'}</h3>
          <p className="text-sm text-dark-text-secondary mt-1 mb-6">{t('gamification.minter.add_desc') || 'Wallets added here will be able to execute merit batches on behalf of the DAO.'}</p>
          <form onSubmit={handleAdd} className="space-y-4">
            <input 
              value={newMinter} 
              onChange={(e) => setNewMinter(e.target.value)} 
              className={inputStyles} 
              placeholder={t('gamification.minter.address_ph') || '0x... wallet address'} 
              required 
            />
            <button type="submit" className="btn-primary w-full" disabled={isLoading || !newMinter.trim()}>
              {isLoading ? <LoaderCircle className="animate-spin" /> : <PlusCircle size={20} />}
              <span>{t('gamification.minter.add_btn') || 'Add and Enable'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Columna Derecha: Lista de Minters */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">{t('gamification.minter.list_title') || 'Authorized Minters'}</h3>
          <button onClick={() => listFastMinters()} className="btn-secondary" disabled={isLoading}>
            {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            <span>{t('gamification.refresh') || 'Refresh'}</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-dark-border/20">
          <table className="min-w-full text-sm">
            <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">{t('gamification.minter.col_address') || 'Minter Address'}</th>
                <th className="px-6 py-3 text-left font-semibold">{t('gamification.minter.col_status') || 'Status'}</th>
                <th className="px-6 py-3 text-center font-semibold">{t('gamification.minter.col_actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/20">
              {fastMinters.map((minter) => (
                <tr key={minter.minter} className="hover:bg-dark-surface-secondary/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs" title={minter.minter}>
                    {`${minter.minter.slice(0, 8)}...${minter.minter.slice(-6)}`}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${minter.enabled ? 'bg-matrix-green/10 text-matrix-green' : 'bg-red-500/10 text-red-400'}`}>
                      {minter.enabled ? <UserCheck size={14} /> : <UserX size={14} />}
                      {minter.enabled ? (t('gamification.minter.enabled') || 'Enabled') : (t('gamification.minter.disabled') || 'Disabled')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleToggle(minter.minter, minter.enabled)} disabled={isLoading} className="transition-transform transform hover:scale-110">
                      {minter.enabled ? 
                        <ToggleRight size={24} className="text-matrix-green" /> : 
                        <ToggleLeft size={24} className="text-gray-500" />
                      }
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fastMinters.length === 0 && !isLoading && (
            <div className="text-center py-12 text-sm text-dark-text-secondary flex flex-col items-center gap-3">
              <ShieldQuestion size={32} />
              <span>{t('gamification.minter.empty') || 'No Fast Minters configured.'}</span>
            </div>
          )}
          {isLoading && fastMinters.length === 0 && (
             <div className="text-center py-12 text-sm text-dark-text-secondary flex justify-center items-center gap-2">
               <LoaderCircle className="animate-spin" />
               <span>{t('gamification.loading') || 'Loading…'}</span>
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
;

export default FastMinterManager;