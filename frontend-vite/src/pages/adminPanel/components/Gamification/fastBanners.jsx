import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, LoaderCircle, RefreshCcw, ToggleLeft, ToggleRight, UserX, UserCheck } from 'lucide-react';
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
      // El hook ya muestra un toast de error
    }
  };

  const handleToggle = async (minter, currentStatus) => {
    try {
      await setFastMinter({ minterWallet: minter, enabled: !currentStatus });
    } catch (error) {
      // El hook ya muestra un toast de error
    }
  };

  const inputStyles = "w-full bg-light-surface-secondary dark:bg-dark-surface border border-dark-border/20 rounded-lg px-3 py-2 focus:ring-2 focus:ring-matrix-green focus:border-matrix-green transition";

  return (
    <div className="bg-light-surface dark:bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6 mt-8">
      <h3 className="text-lg font-bold">{t('gamification.minter.title') || 'Gestión de Fast Minters'}</h3>
      <p className="text-sm text-dark-text-secondary mt-1 mb-6">{t('gamification.minter.desc') || 'Controla qué wallets pueden ejecutar batches de méritos.'}</p>
      
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-8">
        <input value={newMinter} onChange={(e) => setNewMinter(e.target.value)} className={inputStyles} placeholder={t('gamification.minter.address_ph') || '0x... nueva dirección de minter'} required />
        <button type="submit" className="btn-primary h-10 col-span-1 md:col-span-2" disabled={isLoading}>
          {isLoading ? <LoaderCircle className="animate-spin" /> : <PlusCircle size={20} />}
          {t('gamification.minter.add_btn') || 'Añadir y Habilitar Minter'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-dark-border/20">
        <table className="min-w-full text-sm">
          <thead className="bg-light-surface-secondary dark:bg-dark-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Minter Address</th>
              <th className="px-6 py-3 text-left font-semibold">Estado</th>
              <th className="px-6 py-3 text-left font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/20">
            {fastMinters.map((minter) => (
              <tr key={minter.minter} className="hover:bg-dark-surface-secondary/40">
                <td className="px-6 py-4 font-mono text-xs">{minter.minter}</td>
                <td className="px-6 py-4">
                  {minter.enabled ? 
                    <span className="flex items-center gap-2 text-matrix-green"><UserCheck size={16} /> Habilitado</span> :
                    <span className="flex items-center gap-2 text-red-400"><UserX size={16} /> Deshabilitado</span>
                  }
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleToggle(minter.minter, minter.enabled)} disabled={isLoading}>
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
          <div className="text-center py-8 text-dark-text-secondary">{t('gamification.minter.empty') || 'No hay Fast Minters configurados.'}</div>
        )}
      </div>
    </div>
  );
};

export default FastMinterManager;