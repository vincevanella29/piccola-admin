import React, { useEffect } from 'react';
import MyFichaPanel from './components/MyFichaPanel.jsx';
import RegisterPanel from './components/RegisterPanel.jsx';
import LandingPanel from './components/LandingPanel.jsx';
import { useTranslation } from 'react-i18next';
import useMiFicha from '../../hooks/useMiFicha.jsx';
import { LoaderCircle } from 'lucide-react';

const EmployeesRegister = ({ appState }) => {
  const { t } = useTranslation([]); // ← también ‘landing’
  
  // Hook: ficha es “source of truth”
  const fichaContext = useMiFicha(appState, t);
  const { loadingStates, ficha, fetchFicha } = fichaContext;

  useEffect(() => {
    if (appState?.token) {
      fetchFicha();
    }
  }, [appState?.token, fetchFicha]);

  const isLinked = ficha && ficha.rut;
  const isLoggedIn = !!(appState?.account && appState?.token);

  return (
    <div className="p-2 sm:p-4">
      {isLoggedIn ? (
        loadingStates.ficha ? (
          <div className="flex flex-col items-center justify-center h-64 text-dark-text-secondary text-sm">
            <LoaderCircle className="animate-spin text-matrix-green mb-4" size={32} />
            {t('mificha.cargando_ficha')}
          </div>
        ) : isLinked ? (
          <MyFichaPanel appState={appState} fichaContext={fichaContext} />
        ) : (
          <>
            <div className="p-3 mb-3 rounded bg-yellow-900/50 border border-yellow-700/50 text-yellow-300 text-sm">
              {t('mificha.not_linked')}
            </div>
            <RegisterPanel appState={appState} onRegistered={fetchFicha} />
          </>
        )
      ) : (
        // ← LANDING: bienvenida + botón conectar
        <LandingPanel appState={appState} />
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
  isMainPage: true,
  isSearchable: true,
};
