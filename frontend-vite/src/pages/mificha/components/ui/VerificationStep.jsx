// src/pages/employees_register/components/ui/VerificationStep.jsx
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderCircle, Check, ArrowRight, ArrowLeft, ScanFace, Camera } from 'lucide-react';

// Instrucciones visuales grandes
const InstructionOverlay = ({ stage, countdown, feedback, t }) => {
    let icon = <ScanFace size={48} className="animate-pulse" />;
    let text = t('register.verify_step.align', 'Alinea tu rostro');
    let subtext = feedback || '';
    let color = 'text-white';

    switch (stage) {
        case 'detecting':
            text = t('register.verify_step.detecting', 'Detectando rostro...');
            break;
        case 'verifying':
            text = t('register.verify_step.analyzing', 'Analizando identidad...');
            subtext = t('register.verify_step.hold_still', 'No te muevas');
            icon = <LoaderCircle size={48} className="animate-spin text-matrix-green" />;
            break;
        case 'challenge_right':
            text = t('register.verify_step.turn_right', 'Gira a la DERECHA');
            subtext = t('register.verify_step.slowly', 'Lentamente');
            icon = <ArrowRight size={64} className="animate-bounce-x text-yellow-400" />;
            break;
        case 'challenge_left':
            text = t('register.verify_step.turn_left', 'Gira a la IZQUIERDA');
            subtext = t('register.verify_step.slowly', 'Lentamente');
            icon = <ArrowLeft size={64} className="animate-bounce-x-reverse text-yellow-400" />;
            break;
        case 'challenge_front':
            text = t('register.verify_step.look_front', 'Mira al FRENTE');
            subtext = countdown ? `${countdown}...` : t('register.verify_step.hold', 'Mantén la pose');
            icon = countdown 
                ? <span className="text-6xl font-bold text-matrix-green font-mono">{countdown}</span>
                : <ScanFace size={48} className="text-matrix-green" />;
            break;
        case 'success':
            text = t('register.verify_step.success', '¡Captura Exitosa!');
            subtext = t('register.verify_step.processing', 'Procesando validación...');
            icon = <Check size={64} className="text-matrix-green scale-110" />;
            break;
        default:
            break;
    }

    return (
        <motion.div 
            key={stage}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] text-center p-4 z-20 pointer-events-none"
        >
            <div className="mb-4 drop-shadow-lg">{icon}</div>
            <h2 className={`text-2xl font-bold drop-shadow-md ${color} tracking-tight`}>{text}</h2>
            {subtext && <p className="text-sm font-medium text-white/80 mt-2 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">{subtext}</p>}
        </motion.div>
    );
};

// Barra de progreso segmentada
const ProgressBar = ({ stage }) => {
    const steps = ['verifying', 'challenge_right', 'challenge_left', 'challenge_front', 'success'];
    const currentIdx = steps.indexOf(stage);
    
    return (
        <div className="flex gap-1 w-full max-w-xs mt-4">
            {steps.slice(0, 4).map((s, i) => {
                const active = i <= currentIdx;
                const current = i === currentIdx;
                return (
                    <div key={s} className="h-1.5 flex-1 rounded-full bg-dark-surface-secondary overflow-hidden relative">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: active ? '100%' : '0%' }}
                            transition={{ duration: 0.3 }}
                            className={`h-full absolute left-0 top-0 ${current ? 'bg-yellow-400 animate-pulse' : 'bg-matrix-green'}`}
                        />
                    </div>
                );
            })}
        </div>
    );
};

const VerificationStep = ({ hook, onComplete }) => {
  const { t } = useTranslation();
  const {
    videoRef, ready, stage, forwardCountdown, feedback,
    startLiveVerification, cameraStarted, switchCamera, loadingModels,
    usingFront
  } = hook;

  // Auto-iniciar cámara
  useEffect(() => {
    if (ready && !cameraStarted) startLiveVerification().catch(() => {});
  }, [ready, cameraStarted, startLiveVerification]);

  // Auto-completar al éxito
  useEffect(() => {
    if (stage === 'success') {
        setTimeout(() => onComplete(), 500);
    }
  }, [stage, onComplete]);

  if (!ready || loadingModels) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <LoaderCircle size={48} className="animate-spin text-matrix-green" />
        <p className="text-light-text-secondary dark:text-dark-text-secondary font-mono text-sm animate-pulse">
            {t('register.loading_engine', 'Cargando Motor Biométrico...')}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center animate-fadeIn">
        {/* Contenedor de Video Principal */}
        <div className="relative w-full max-w-sm aspect-[3/4] md:aspect-square bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-dark-surface-secondary">
            <video
                ref={videoRef}
                className={`w-full h-full object-cover ${usingFront ? 'scale-x-[-1]' : ''}`}
                autoPlay
                playsInline
                muted
            />
            
            {/* Overlay de Instrucciones Dinámico */}
            <AnimatePresence mode="wait">
                <InstructionOverlay 
                    stage={stage} 
                    countdown={forwardCountdown} 
                    feedback={feedback}
                    t={t}
                />
            </AnimatePresence>

            {/* Máscara Ovario (Guía visual estática) */}
            {stage === 'detecting' || stage === 'verifying' ? (
                <div className="absolute inset-0 border-[3px] border-white/20 rounded-[50%] m-12 pointer-events-none" />
            ) : null}
        </div>

        {/* Barra de Progreso */}
        <ProgressBar stage={stage} />

        {/* Controles Inferiores */}
        <div className="mt-6 flex gap-4">
            <button 
                onClick={switchCamera}
                className="px-4 py-2 rounded-xl bg-dark-surface-secondary text-white text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
            >
                <Camera size={14} /> {t('register.switch_camera', 'Cambiar Cámara')}
            </button>
        </div>
        
        {/* CSS para animaciones específicas si no están en tailwind.config */}
        <style>{`
            .animate-bounce-x { animation: bounceX 1s infinite; }
            .animate-bounce-x-reverse { animation: bounceXReverse 1s infinite; }
            @keyframes bounceX { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(10px); } }
            @keyframes bounceXReverse { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-10px); } }
        `}</style>
    </div>
  );
};

export default VerificationStep;