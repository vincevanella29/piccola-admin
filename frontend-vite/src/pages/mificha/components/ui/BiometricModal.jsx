// src/pages/employees_register/components/ui/BiometricModal.jsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import VerificationStep from './VerificationStep';
import CompletionStep from './CompletionStep';
import IdCardStep from './IdCardStep';
import StepIndicator from './StepIndicator';

// startWithScan: si es true, primero mostramos escaneo de carnet, luego liveness
const BiometricModal = ({ isOpen, onClose, hook, onSuccess, startWithScan = false }) => {
  const [currentStep, setCurrentStep] = useState(startWithScan ? 1 : 2);
  const [resultState, setResultState] = useState({ success: false, message: '' });

  if (!isOpen) return null;

  const handleIdScanSuccess = async () => {
    try {
      await hook.prepareVerificationSession({ rut: hook.rut, skipReferenceFetch: true });
      setCurrentStep(2);
    } catch (e) {
      setResultState({ success: false, message: e?.message || 'Error procesando carnet' });
      setCurrentStep(3);
    }
  };

  const handleVerificationComplete = async () => {
    try {
      await hook.validar();
      setResultState({ success: true, message: '' });
      setCurrentStep(3);
      hook.stopCamera();
      if (onSuccess) onSuccess();
    } catch (e) {
      setResultState({ success: false, message: e?.message || 'Error en validación' });
      setCurrentStep(3);
      hook.stopCamera();
    }
  };

  const handleRetry = () => {
    setCurrentStep(startWithScan ? 1 : 2);
    hook.reset();
    hook.startLiveVerification({ preferFront: !startWithScan });
  };

  const handleSwitchToId = () => {
    // Permite probar el flujo de escaneo de carnet desde el paso de liveness
    setCurrentStep(1);
  };

  // Portal render
  return ReactDOM.createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      >
        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl h-[85vh] md:h-[800px] flex flex-col 
                     bg-dark-surface border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header del Modal */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-dark-surface-secondary/50 backdrop-blur-sm">
            <div className="flex flex-col">
               <h2 className="text-lg font-bold text-white">Validación de Identidad</h2>
               <StepIndicator currentStep={currentStep} totalSteps={3} />
            </div>
            <div className="flex items-center gap-3">
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={handleSwitchToId}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
                >
                  Otros métodos
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Body del Modal */}
          <div className="flex-1 overflow-y-auto relative bg-black flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 pointer-events-none" />

            {currentStep === 1 && (
              <IdCardStep hook={hook} onScanComplete={handleIdScanSuccess} />
            )}

            {currentStep === 2 && (
              <VerificationStep hook={hook} onComplete={handleVerificationComplete} />
            )}

            {currentStep === 3 && (
              <CompletionStep
                success={resultState.success}
                message={resultState.message}
                onRetry={handleRetry}
                onClose={onClose}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default BiometricModal;