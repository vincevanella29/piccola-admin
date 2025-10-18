import React from 'react';
import { Bolt, Repeat, Zap } from 'lucide-react';

const CameraControls = ({
  t,
  cameraStarted,
  usingFront,
  torchOn,
  classifying,
  autoMode,
  setAutoMode,
  switchCamera,
  toggleTorch,
  handleManualShot,
}) => {
  if (!cameraStarted) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-light-surface-secondary/90 dark:from-dark-surface-secondary/90 to-transparent pb-[env(safe-area-inset-bottom)] pt-8">
      <div className="max-w-md mx-auto px-6 flex items-center justify-between">
        
        <ControlButton
          onClick={toggleTorch}
          disabled={usingFront}
          active={torchOn}
          icon={<Bolt className="h-6 w-6" />}
          label={t('dishes.actions.flash')}
        />
        
        <button
          onClick={handleManualShot}
          disabled={classifying}
          aria-label={t('dishes.actions.classify')}
          className="h-20 w-20 rounded-full bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 border-4 border-light-border dark:border-dark-border flex items-center justify-center text-light-text-primary dark:text-dark-text-primary active:scale-90 transition-transform ring-4 ring-light-border/40 dark:ring-dark-border/40 disabled:opacity-50"
        >
          {classifying ? (
            <div className="h-6 w-6 border-2 border-light-text-primary dark:border-dark-text-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border" />
          )}
        </button>
        
        <ControlButton
          onClick={switchCamera}
          icon={<Repeat className="h-6 w-6" />}
          label={t('dishes.actions.camera')}
        />
        
      </div>
      
      <div className="mt-4 text-center">
         <button 
           onClick={() => setAutoMode(v => !v)}
           className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
             autoMode 
               ? 'bg-matrix-green/20 text-matrix-green border border-matrix-green/40' 
               : 'bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 text-light-text-secondary dark:text-dark-text-secondary border border-light-border/60 dark:border-dark-border/60'
           }`}
         >
           <Zap className={`h-4 w-4 ${autoMode ? 'text-matrix-green' : 'text-light-text-tertiary dark:text-dark-text-tertiary'}`} />
           <span>{autoMode ? t('dishes.modes.auto_on', 'Auto ON') : t('dishes.modes.auto_off', 'Auto OFF')}</span>
         </button>
      </div>
    </div>
  );
};

const ControlButton = ({ onClick, disabled, active, icon, label }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={`h-12 w-12 rounded-full flex items-center justify-center text-light-text-primary dark:text-dark-text-primary active:scale-90 transition-all duration-200 disabled:opacity-30 ${
      active ? 'bg-light-surface-tertiary/70 dark:bg-dark-surface-tertiary/70' : 'bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40'
    }`}
  >
    {icon}
  </button>
);

export default CameraControls;
