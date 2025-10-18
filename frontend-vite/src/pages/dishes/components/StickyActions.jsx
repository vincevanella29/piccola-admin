// src/components/StickyActions.jsx
import React from 'react';
import { Camera, RefreshCw, Bolt, Repeat, Zap } from 'lucide-react';

const StickyActions = ({ t, cameraStarted, usingFront, torchOn, syncing, classifying, autoMode, setAutoMode, switchCamera, toggleTorch, handleManualShot, handleSync }) => {
  if (!cameraStarted) return null; // Ocultar si la cámara no ha iniciado

  return (
    // Barra superior minimalista dentro del área de cámara
    <div className="absolute inset-x-0 top-20 z-30 pointer-events-none">
      <div className="max-w-md mx-auto px-3 flex items-center justify-end gap-2">
        {/* Auto toggle */}
        <ActionButton
          onClick={() => setAutoMode(v => !v)}
          active={!!autoMode}
          label={t('dishes.modes.auto')}
          icon={<Zap className={`h-4 w-4 ${autoMode ? 'text-matrix-green' : ''}`} />}
        />

        {/* Disparo / Clasificar */}
        <ActionButton
          onClick={handleManualShot}
          disabled={classifying}
          label={classifying ? t('dishes.actions.classifying') : t('dishes.actions.classify')}
          icon={<Camera className="h-4 w-4" />}
        />

        {/* Sincronizar catálogo */}
        <ActionButton
          onClick={handleSync}
          disabled={syncing}
          label={syncing ? t('dishes.actions.syncing') : t('dishes.actions.sync')}
          icon={<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
        />

        {/* Cambiar cámara */}
        <ActionButton
          onClick={switchCamera}
          label={t('dishes.actions.camera')}
          icon={<Repeat className="h-4 w-4" />}
        />

        {/* Linterna (deshabilitada en cámara frontal) */}
        <ActionButton
          onClick={toggleTorch}
          disabled={usingFront}
          active={torchOn}
          label={t('dishes.actions.flash')}
          icon={<Bolt className="h-4 w-4" />}
        />

      </div>
    </div>
  );
};

// Componente helper para botones de acción consistentes
const ActionButton = ({ onClick, disabled, active, label, icon }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className={`pointer-events-auto h-9 w-9 rounded-full flex items-center justify-center border border-white/10 bg-transparent text-white/90 hover:text-white active:scale-95 disabled:opacity-50 ${
      active ? 'ring-1 ring-white/30' : ''
    }`}
  >
    {icon}
  </button>
);


export default StickyActions;