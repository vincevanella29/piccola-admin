// src/pages/employees_register/components/ui/IdCardStep.jsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw, LoaderCircle, CreditCard } from 'lucide-react';

const IdCardStep = ({ hook, onScanComplete }) => {
  const { t } = useTranslation();
  const {
    videoRef, ready, startLiveVerification, cameraStarted, 
    switchCamera, usingFront, processIdCard, rut
  } = hook;

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Iniciar cámara al montar
  useEffect(() => {
    if (ready && !cameraStarted) startLiveVerification({ preferFront: false }).catch(() => {});
  }, [ready, cameraStarted, startLiveVerification]);

  const handleCapture = async () => {
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const result = await processIdCard({ rut });
      if (result?.success) {
        onScanComplete();
      }
    } catch (e) {
      console.error('Error carnet:', e);
      const msg = e?.response?.data?.detail || e?.message || 'Error procesando carnet.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!ready) return <div className="h-64 flex items-center justify-center"><LoaderCircle className="animate-spin text-matrix-green"/></div>;

  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-6 animate-fadeIn">
      
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <CreditCard className="text-matrix-green" /> 
            {t('register.scan_id_title', 'Escanea tu Carnet')}
        </h3>
        <p className="text-sm text-dark-text-secondary max-w-xs mx-auto">
            {t('register.scan_id_desc', 'Necesitamos validar tu identidad física. Ubica el frente de tu carnet en el recuadro.')}
        </p>
      </div>

      {/* Contenedor de Video (Formato Carnet) */}
      <div className="relative w-full max-w-sm aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-dark-surface-secondary">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${usingFront ? 'scale-x-[-1]' : ''}`}
          autoPlay
          playsInline
          muted
        />
        
        {/* Máscara Rectangular para Carnet */}
        <div className="absolute inset-0 pointer-events-none bg-black/40">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] aspect-[1.586/1] border-2 border-white/50 rounded-xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
              {/* Esquinas brillantes */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-matrix-green -mt-1 -ml-1 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-matrix-green -mt-1 -mr-1 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-matrix-green -mb-1 -ml-1 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-matrix-green -mb-1 -mr-1 rounded-br-lg"></div>
           </div>
        </div>

        {isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                <LoaderCircle size={48} className="animate-spin text-matrix-green mb-3" />
                <p className="text-white font-bold text-sm">{t('register.processing_id', 'Analizando Carnet...')}</p>
                <p className="text-xs text-white/50">Extrayendo datos y rostro</p>
            </div>
        )}
      </div>

      {/* Controles */}
      <div className="w-full flex gap-3 mt-2">
        <button
            onClick={switchCamera}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-dark-surface-secondary hover:bg-white/10 text-white transition-colors flex items-center justify-center gap-2"
        >
            <RefreshCw size={16} /> {t('register.switch', 'Voltear')}
        </button>
        <button
            onClick={handleCapture}
            disabled={isProcessing}
            className="flex-[2] py-3 rounded-xl font-bold text-sm bg-white text-black hover:bg-gray-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
        >
          {t('register.capture_btn', 'Capturar Carnet')} <Camera size={18} />
        </button>
      </div>

      {errorMessage && (
        <div className="mt-3 w-full max-w-sm text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default IdCardStep;