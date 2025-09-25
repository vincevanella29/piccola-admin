import React, { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useRegistroBiometrico from '../../../hooks/useRegistroBiometrico.jsx';
import { toBackendRut } from './utils/rut.js';
import StepIndicator from './ui/StepIndicator.jsx';
import RutStep from './ui/RutStep.jsx';
import VerificationStep from './ui/VerificationStep.jsx';
import CompletionStep from './ui/CompletionStep.jsx';

function useAppAuth(appState) {
  // Unificar el origen de credenciales según formato del proyecto
  const token = appState?.token || appState?.accessToken || null;
  const walletAddress = appState?.account || appState?.walletAddress || null;
  return { token, walletAddress };
}

const RegisterPanel = ({ appState, onRegistered }) => {
  const { token, walletAddress } = useAppAuth(appState);
  // 1: RUT, 2: Verificación, 3: Finalizado
  const [step, setStep] = useState(1);
  const [rut, setRut] = useState('');
  const [employeeData, setEmployeeData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rutError, setRutError] = useState('');
  const [completionState, setCompletionState] = useState({ message: '', isError: false });

  const hook = useRegistroBiometrico({
    modelsBaseUrl: '/models',
    tinyFaceOptions: { inputSize: 224, scoreThreshold: 0.4 },
    maxVideoFps: 20,
    appState,
  });

  // Paso 1: Verificar RUT (prepara modelos + referencia + sesión antes de encender la cámara)
  const handleRutSubmit = async () => {
    if (!rut) {
      setRutError('Por favor, ingresa un RUT.');
      return;
    }
    setIsSubmitting(true);
    setRutError('');
    try {
      const backendRut = toBackendRut(rut);
      const data = await hook.prepareVerificationSession({ rut: backendRut, walletAddress, token });
      setEmployeeData(data);
      setStep(2);
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e?.message || 'Ocurrió un error inesperado.';
      setRutError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 2: Validar biometría y pasar a final
  const handleVerificationComplete = async () => {
    setIsSubmitting(true);
    try {
      await hook.validar({ walletAddress, token });
      setCompletionState({ message: '¡Registro exitoso! Tu cuenta ha sido activada.', isError: false });
      setStep(3);
      hook.stopCamera();
      hook.reset();
      // Avisar al padre para que refresque /mi/ficha y muestre la ficha automáticamente
      if (typeof onRegistered === 'function') {
        try { onRegistered(); } catch {}
      }
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e?.message || 'La validación falló. Intenta de nuevo.';
      setCompletionState({ message: errorMsg, isError: true });
      setStep(3);
      hook.stopCamera();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 3: Reiniciar
  const handleRetry = () => {
    setStep(1);
    setRut('');
    setEmployeeData(null);
    setRutError('');
    setCompletionState({ message: '', isError: false });
    hook.reset();
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6 p-4 sm:p-6 md:p-8 bg-light-surface dark:bg-dark-surface rounded-2xl shadow-modal border border-light-border dark:border-dark-border">
      <ToastContainer position="top-center" theme="colored" autoClose={4000} />

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-futurist text-light-text-primary dark:text-dark-text-primary">Registro Biométrico</h1>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">Sigue los pasos para activar tu cuenta de forma segura.</p>
      </div>

      <StepIndicator currentStep={step} />

      <div className="w-full mt-4">
        {step === 1 && (
          <RutStep rut={rut} setRut={setRut} onSubmit={handleRutSubmit} isLoading={isSubmitting} error={rutError} />
        )}
        {step === 2 && (
          <VerificationStep hook={hook} onComplete={handleVerificationComplete} isLoading={isSubmitting} />
        )}
        {step === 3 && (
          <CompletionStep message={completionState.message} isError={completionState.isError} onRetry={handleRetry} />
        )}
      </div>
    </div>
  );
};

export default RegisterPanel;
