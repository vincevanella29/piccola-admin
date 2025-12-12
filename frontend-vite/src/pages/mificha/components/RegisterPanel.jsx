// src/pages/employees_register/components/RegisterPanel.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ScanFace, CreditCard, AlertTriangle } from 'lucide-react';

import useRegistroBiometrico from '../../../hooks/useRegistroBiometrico';
import { toBackendRut } from './utils/rut';
import RutStep from './ui/RutStep';
import BiometricModal from './ui/BiometricModal'; // Nuevo componente Modal

function useAppAuth(appState) {
  const token = appState?.token || appState?.accessToken || null;
  const walletAddress = appState?.account || appState?.walletAddress || null;
  return { token, walletAddress };
}

const RegisterPanel = ({ appState, onRegistered }) => {
  const { t } = useTranslation();
  const { token, walletAddress } = useAppAuth(appState);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [startWithScan, setStartWithScan] = useState(false);
  const [rut, setRut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rutError, setRutError] = useState('');
  const [needsScanOption, setNeedsScanOption] = useState(false);

  // Hook Biométrico (se mantiene vivo mientras el modal esté abierto)
  const hook = useRegistroBiometrico({
    modelsBaseUrl: '/models',
    tinyFaceOptions: { inputSize: 224, scoreThreshold: 0.4 },
    maxVideoFps: 20,
    appState,
  });

  // Paso 1: Validar RUT y abrir Modal (modo normal)
  const handleRutSubmit = async () => {
    if (!rut) {
      setRutError(t('register.errors.rut_required'));
      return;
    }
    setIsSubmitting(true);
    setRutError('');
    setNeedsScanOption(false);
    try {
      const backendRut = toBackendRut(rut);
      await hook.prepareVerificationSession({ rut: backendRut, walletAddress, token });
      setStartWithScan(false);
      setIsModalOpen(true);
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e?.message || t('register.errors.generic');

      if (errorMsg.includes('Falta foto') || errorMsg.includes('foto de referencia')) {
        setRutError(
          t(
            'register.errors.no_photo_found',
            'No encontramos una foto de perfil válida para este RUT.',
          ),
        );
        setNeedsScanOption(true);
      } else {
        setRutError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartScanFlow = () => {
    setStartWithScan(true);
    setIsModalOpen(true);
    setRutError('');
  };

  const handleCloseModal = () => {
    // Si cerramos el modal, reseteamos todo excepto el RUT por si quiere reintentar
    setIsModalOpen(false);
    hook.stopCamera();
    hook.reset();
  };

  const handleSuccess = () => {
    if (onRegistered) onRegistered();
    // Dejamos el modal abierto un momento para mostrar el CompletionStep, 
    // luego el usuario lo cierra o se cierra solo tras un delay si quisieras.
  };

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center p-8 
                    bg-light-surface dark:bg-dark-surface 
                    rounded-3xl shadow-2xl 
                    border border-light-border/20 dark:border-white/10 overflow-hidden">
      
      <ToastContainer position="top-center" theme="colored" autoClose={4000} />

      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 mb-6 
                        rounded-3xl bg-light-surface-secondary dark:bg-white/5 
                        border border-light-border/20 dark:border-white/10 shadow-inner">
          <ScanFace size={40} className="text-light-text-secondary dark:text-dark-text-secondary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-light-text-primary dark:text-white">
          {t('register.welcome_title', 'Activa tu Identidad')}
        </h1>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-3 max-w-sm mx-auto">
          {t(
            'register.welcome_desc',
            'Ingresa tu RUT para comenzar el proceso de validación biométrica segura.',
          )}
        </p>
      </div>

      <RutStep 
        rut={rut} 
        setRut={setRut} 
        onSubmit={handleRutSubmit} 
        isLoading={isSubmitting} 
        error={rutError} 
      />

      {needsScanOption && !isSubmitting && (
        <div className="mt-4 w-full max-w-sm animate-fadeIn">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 shrink-0" size={20} />
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                {t(
                  'register.scan_suggestion',
                  'No te preocupes. Puedes validar tu identidad escaneando tu Carnet de Identidad físico.',
                )}
              </p>
            </div>
            <button
              onClick={handleStartScanFlow}
              className="w-full py-3 rounded-lg bg-white text-black font-bold text-sm shadow-md hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={16} />
              {t('register.btn_scan_id', 'Escanear Carnet ahora')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 text-[10px] text-light-text-tertiary dark:text-dark-text-secondary/50 text-center">
        {t('register.footer_secure', 'Powered by Vanellix ID • Encriptación de grado militar')}
      </div>

      {/* EL MODAL "HEAVY" (Portal) */}
      {isModalOpen && (
        <BiometricModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          hook={hook}
          onSuccess={handleSuccess}
          startWithScan={startWithScan}
        />
      )}
    </div>
  );
};

export default RegisterPanel;