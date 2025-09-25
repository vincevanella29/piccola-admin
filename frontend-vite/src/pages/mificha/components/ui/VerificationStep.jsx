import React, { useEffect, useMemo, useRef } from 'react';
import { FaCheck, FaSpinner, FaRedo } from 'react-icons/fa';

const ChallengePill = ({ label, isComplete }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all duration-300 ${
    isComplete
      ? 'bg-matrix-green/20 text-matrix-green'
      : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'
  }`}
  >
    {isComplete ? <FaCheck /> : <div className="w-4 h-4 rounded-full border-2 border-current opacity-50" />}
    <span>{label}</span>
  </div>
);

const MaskOverlay = ({ hasFace }) => (
  <div className="absolute inset-0 pointer-events-none">
    <svg className="w-full h-full" viewBox="0 0 100 133" preserveAspectRatio="xMidYMid slice">
      <defs>
        <mask id="face-mask-vertical">
          <rect x="0" y="0" width="100" height="133" fill="white" />
          <ellipse cx="50" cy="60" rx="35" ry="45" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100" height="133" fill="rgba(0,0,0,0.65)" mask="url(#face-mask-vertical)" />
      <ellipse cx="50" cy="60" rx="35" ry="45" fill="none" strokeWidth="0.8" className={`transition-colors duration-300 ${hasFace ? 'stroke-matrix-green' : 'stroke-dark-border'}`} />
    </svg>
  </div>
);

const VerificationStep = ({ hook, onComplete, isLoading }) => {
  const {
    videoRef, ready, hasFace, statusMessage,
    turnedLeft, turnedRight, lookedForward,
    startLiveVerification, stopCamera, reset, nextInstruction, loadingModels,
    identityVerified,
    forwardCountdown,
  } = hook;

  const initOnceRef = useRef(false);
  useEffect(() => {
    if (!initOnceRef.current) {
      initOnceRef.current = true;
      startLiveVerification().catch(console.error);
    }
    return () => {
      stopCamera();
    };
  }, [startLiveVerification, stopCamera]);

  const allChallengesMet = useMemo(() => {
    return turnedLeft && turnedRight && lookedForward;
  }, [turnedLeft, turnedRight, lookedForward]);

  const instructionText = useMemo(() => {
    if (!hasFace) return 'Alinea tu rostro en el óvalo';
    if (!identityVerified) return statusMessage || 'Verificando identidad...';
    if (allChallengesMet) return '¡Excelente! Todo listo para validar.';
    
    switch (nextInstruction) {
      case 'turn_left': return 'Identidad verificada. Gira tu cabeza a la IZQUIERDA';
      case 'turn_right': return 'Ahora, gira a la DERECHA';
      case 'look_forward': return 'Perfecto. MIRA AL FRENTE para la foto final';
      default: return 'Sigue las instrucciones';
    }
  }, [hasFace, nextInstruction, allChallengesMet, identityVerified, statusMessage]);

  const isPreparingModels = loadingModels || !ready;
  const isPreparingReference = !isPreparingModels && !identityVerified && (statusMessage || '').toLowerCase().includes('preparando referencia');
  const isVerifyingIdentity = !isPreparingModels && !identityVerified && (statusMessage || '').toLowerCase().includes('verificando identidad');

  if (isPreparingModels) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 text-center h-96 animate-fadeIn">
        <div className="w-16 h-16 rounded-full border-4 border-matrix-green/30 border-t-matrix-green animate-spin" />
        <div>
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">Preparando IA para la verificación…</h3>
          <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">Cargando modelos y optimizando el entorno</p>
        </div>
        <div className="w-64 h-2 rounded bg-dark-border overflow-hidden">
          <div className="h-full w-1/2 bg-matrix-green animate-pulseSlow rounded" />
        </div>
        <style>{`@keyframes pulseSlow { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} } .animate-pulseSlow{animation:pulseSlow 1.6s linear infinite}`}</style>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-fadeIn">
      <div className="w-full max-w-xs mx-auto relative rounded-2xl overflow-hidden border-2 border-dark-border aspect-[3/4] bg-dark-background">
        <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" autoPlay playsInline muted />
        <MaskOverlay hasFace={hasFace} />
        {!hasFace && (
          <div className="absolute top-3 left-3 right-3 bg-dark-surface/80 backdrop-blur-xs border border-dark-border rounded-lg p-2 text-xs text-dark-text-primary flex items-center gap-2">
            <FaSpinner className="animate-spin" />
            <span>Buscando rostro… Alinea tu rostro en el óvalo</span>
          </div>
        )}
        {(!identityVerified) && (isPreparingReference || isVerifyingIdentity) && (
          <div className="absolute top-3 left-3 right-3 bg-dark-surface/80 backdrop-blur-xs border border-dark-border rounded-lg p-3 text-xs text-dark-text-primary shadow-lg">
            <div className="flex items-center gap-2 font-semibold">
              <FaSpinner className="animate-spin" />
              <span>Preparando IA para la verificación…</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-[11px]">
              <div className={`flex items-center justify-between ${isPreparingReference ? 'text-matrix-green' : 'text-dark-text-secondary'}`}>
                <span>• Descargando foto de referencia</span>
                <span className={`w-2 h-2 rounded-full ${isPreparingReference ? 'bg-matrix-green animate-ping' : 'bg-dark-border'}`} />
              </div>
              <div className={`flex items-center justify-between ${isVerifyingIdentity ? 'text-matrix-green' : 'text-dark-text-secondary'}`}>
                <span>• Extrayendo rasgos faciales</span>
                <span className={`w-2 h-2 rounded-full ${isVerifyingIdentity ? 'bg-matrix-green animate-ping' : 'bg-dark-border'}`} />
              </div>
            </div>
          </div>
        )}
        {identityVerified && forwardCountdown !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-matrix-green/30" />
              <div className="absolute inset-0 rounded-full border-4 border-matrix-green border-t-transparent animate-spin-slow" />
              <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-matrix-green">{forwardCountdown}</div>
            </div>
            <div className="px-3 py-1 rounded bg-dark-surface/80 text-dark-text-primary text-xs border border-dark-border">Mantén la mirada al frente…</div>
          </div>
        )}
        <style>{`.animate-spin-slow{animation:spin 1.2s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div className={`absolute bottom-4 left-4 right-4 text-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-300 backdrop-blur-xs ${
            statusMessage.includes('no coincide') ? 'bg-dark-error/80 text-white' : 'bg-dark-surface/80 text-dark-text-primary'
          }`}
        >
          {instructionText}
        </div>
      </div>

      <div className="flex flex-wrap justify-center items-center gap-3">
        <ChallengePill label="Derecha" isComplete={turnedLeft} />
        <ChallengePill label="Izquierda" isComplete={turnedRight} />
        <ChallengePill label="Frente" isComplete={lookedForward} />
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3 mt-4">
        <button
          onClick={onComplete}
          disabled={isLoading || !allChallengesMet}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white bg-matrix-green hover:bg-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-matrix-green/20"
        >
          {isLoading ? <FaSpinner className="animate-spin" /> : 'Completar Registro'}
        </button>
        <button
          onClick={reset}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary disabled:opacity-50 transition-colors"
        >
          <FaRedo /> Reiniciar Pruebas
        </button>
      </div>
    </div>
  );
};

export default VerificationStep;