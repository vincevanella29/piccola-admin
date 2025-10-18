// src/components/CameraBox.jsx
import React from 'react';

const CameraBox = ({ videoRef, cameraStarted, usingFront, permError, startCamera, t }) => {
  return (
    <div className="relative h-full w-full overflow-hidden bg-light-surface-secondary dark:bg-dark-surface-secondary">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-500 ${cameraStarted ? 'opacity-100' : 'opacity-0'} ${usingFront ? 'transform scale-x-[-1]' : ''}`}
        autoPlay
        playsInline
        muted
      />

      {/* Guía visual para apuntar */}
      {cameraStarted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[80%] aspect-[3/4] max-w-[400px] max-h-[80%] rounded-3xl border-2 border-white/20 border-dashed"></div>
        </div>
      )}

      {/* Overlay para iniciar la cámara */}
      {!cameraStarted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-light-surface-secondary dark:bg-dark-surface-secondary p-4">
          <button
            onClick={() => startCamera(false)}
            className="px-6 py-3 rounded-xl bg-matrix-green text-white font-semibold shadow-lg active:scale-95 transition-transform"
          >
            {t('dishes.actions.allow_camera')}
          </button>
          {permError && (
            <div className="mt-4 text-xs text-red-300 bg-red-900/40 border border-red-800 rounded-lg px-3 py-2 max-w-sm text-center dark:bg-red-900/40 dark:border-red-800">
              {permError}
            </div>
          )}
          <p className="mt-4 text-xs text-dark-text-secondary text-center max-w-sm">
            {t('dishes.hints.ios_tap')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CameraBox;