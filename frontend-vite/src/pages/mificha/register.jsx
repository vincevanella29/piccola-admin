// src/pages/employees_register/register.jsx

import React, { useEffect } from 'react';
import MyFichaPanel from './components/MyFichaPanel.jsx';
import RegisterPanel from './components/RegisterPanel.jsx';
import { useTranslation } from 'react-i18next';
import useMiFicha from '../../hooks/useMiFicha.jsx';
import { LoaderCircle } from 'lucide-react';

const EmployeesRegister = ({ appState }) => {
  const { t } = useTranslation();
  
  // El hook se inicializa aquí y se convierte en la única fuente de verdad
  const fichaContext = useMiFicha(appState, t);
  const { loadingStates, ficha, fetchFicha } = fichaContext;

  useEffect(() => {
    if (appState?.token) {
      fetchFicha();
    }
  }, [appState?.token, fetchFicha]);

  const isLinked = ficha && ficha.rut;

  return (
    <div className="p-2 sm:p-4">
      {appState?.account && appState?.token ? (
        loadingStates.ficha ? (
          <div className="flex flex-col items-center justify-center h-64 text-dark-text-secondary text-sm">
            <LoaderCircle className="animate-spin text-matrix-green mb-4" size={32} />
            {t('ficha.cargando_ficha', 'Cargando tu ficha...')}
          </div>
        ) : isLinked ? (
          // Pasamos el objeto completo del hook como una sola prop
          <MyFichaPanel appState={appState} fichaContext={fichaContext} />
        ) : (
          <>
            <div className="p-3 mb-3 rounded bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-sm">
              {t('ficha.not_linked', 'No hay ficha de empleado vinculada a esta identidad.')}
            </div>
            <RegisterPanel appState={appState} onRegistered={fetchFicha} />
          </>
        )
      ) : (
        <div className="text-sm text-center p-8 text-dark-text-secondary">
          {t('wallet.connect_wallet', 'Conecta tu wallet e inicia sesión para continuar.')}
        </div>
      )}
    </div>
  );
};

export default EmployeesRegister;

export const pageMetadata = {
  path: '/app/mi-ficha',
  label: 'employees.profiles.label',
  category: 'employees.profiles.category',
  minRoleLevel: -1,
  order: 3,
  orderWalletMenu: 3,
  orderFooter: 2,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'employees.profiles.description',
  icon: 'FaUserCheck',
  isMainPage: false,
  isSearchable: true,
};