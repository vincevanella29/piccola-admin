import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import MyFichaPanel from './components/MyFichaPanel.jsx';
import RegisterPanel from './components/RegisterPanel.jsx';
import LandingPanel from '../home/components/LandingPanel.jsx';
import useMiFicha from '../../hooks/useMiFicha.jsx';

const EmployeesRegister = ({ appState }) => {
  const { t } = useTranslation(); 
  const navigate = useNavigate();
  
  // Hook: "Source of Truth"
  const fichaContext = useMiFicha(appState, t);
  const { loadingStates, ficha, fetchFicha } = fichaContext;

  useEffect(() => {
    if (appState?.account || appState?.isAuthenticated) {
      fetchFicha();
    }
  }, [appState?.account, appState?.isAuthenticated, fetchFicha]);

  const isLinked = ficha && ficha.rut;
  const isLoggedIn = !!(appState?.account || appState?.isAuthenticated);

  const handleRegistered = async () => {
    try {
      await fetchFicha({ force: true });
      navigate('/app/mi-ficha');
    } catch (e) {
      // Si falla la navegación o el fetch, al menos el refetch normal seguirá ocurriendo por el estado.
      console.error('Post-register redirect error', e);
    }
  };

  // Variantes de animación para transiciones "Apple-smooth"
  const contentVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.99 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } // Curva "cubic-bezier" estilo iOS
    },
    exit: { opacity: 0, scale: 0.99, transition: { duration: 0.2 } }
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <motion.div
            key="landing"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <LandingPanel appState={appState} />
          </motion.div>
        ) : loadingStates.ficha ? (
          <motion.div
            key="loading"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col items-center justify-center h-[60vh] space-y-4"
          >
            {/* Spinner ultra fino y minimalista */}
            <div className="relative">
              <div className="absolute inset-0 bg-matrix-green/20 blur-xl rounded-full opacity-50 animate-pulse" />
              <LoaderCircle className="relative animate-spin text-matrix-green w-10 h-10 stroke-[1.5]" />
            </div>
            <p className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary tracking-wide animate-pulse">
              {t('mificha.cargando_ficha')}
            </p>
          </motion.div>
        ) : isLinked ? (
          <motion.div
            key="dashboard"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <MyFichaPanel appState={appState} fichaContext={fichaContext} />
          </motion.div>
        ) : (
          <motion.div
            key="register"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* Alerta estilo "Glass Card" moderna, no invasiva */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 backdrop-blur-sm">
              <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500">
                <AlertCircle size={20} className="stroke-2" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">
                  {t('mificha.status.not_linked_title', 'Cuenta no vinculada')}
                </h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                  {t('mificha.not_linked')}
                </p>
              </div>
            </div>

            <RegisterPanel appState={appState} onRegistered={handleRegistered} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeesRegister;

export const pageMetadata = {
  path: '/app/mi-ficha/employees',
  label: 'employees.profiles.label',
  category: 'team.category',
  minRoleLevel: -1,
  order: 3,
  orderWalletMenu: 3,
  orderFooter: 2,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'employees.profiles.description',
  icon: 'FaUserCheck',
  isSearchable: true,
};