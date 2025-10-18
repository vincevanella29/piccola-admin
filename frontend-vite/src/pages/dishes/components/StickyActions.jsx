import React from 'react';
import { Camera, RefreshCw, Bolt, Repeat } from 'lucide-react';

const StickyActions = ({
  t,
  cameraStarted,
  usingFront,
  torchOn,
  syncing,
  classifying,
  switchCamera,
  toggleTorch,
  handleManualShot,
  handleSync,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 mb-20 sm:mb-20">
      <div className="mx-auto max-w-md px-3 pb-[env(safe-area-inset-bottom)]">
        {/* Mobile: grid para no desbordar, icon-only; en sm+ muestra texto */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-xl p-1.5 sm:p-2 grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
          {/* Cambiar cámara */}
          <button
            className="col-span-1 sm:flex-1 px-3 sm:px-3 py-2 sm:py-3 rounded-xl bg-dark-surface text-dark-text-primary border border-dark-border active:scale-[0.98] min-w-0"
            onClick={switchCamera}
            disabled={!cameraStarted}
            title={t('dishes.actions.switch_camera')}
            aria-label={t('dishes.actions.switch_camera')}
          >
            <div className="flex items-center justify-center gap-0.5 sm:gap-2">
              <Repeat className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline text-sm font-semibold">{t('dishes.actions.camera')}</span>
            </div>
          </button>

          {/* Torch */}
          <button
            className={`col-span-1 sm:flex-1 px-3 sm:px-3 py-2 sm:py-3 rounded-xl border active:scale-[0.98] min-w-0 ${
              torchOn
                ? 'bg-matrix-green text-white border-matrix-green'
                : 'bg-dark-surface text-dark-text-primary border-dark-border'
            }`}
            onClick={toggleTorch}
            disabled={!cameraStarted || usingFront}
            title={usingFront ? t('dishes.actions.flash_unavailable') : t('dishes.actions.flash')}
            aria-label={usingFront ? t('dishes.actions.flash_unavailable') : t('dishes.actions.flash')}
          >
            <div className="flex items-center justify-center gap-0.5 sm:gap-2">
              <Bolt className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline text-sm font-semibold">
                {torchOn ? t('dishes.actions.torch_on') : t('dishes.actions.torch')}
              </span>
            </div>
          </button>

          {/* Clasificar */}
          <button
            className="col-span-1 sm:flex-[1.4] px-3 sm:px-3 py-2 sm:py-3 rounded-xl bg-matrix-green text-white border border-matrix-green shadow-lg active:scale-[0.98] min-w-0"
            onClick={handleManualShot}
            disabled={!cameraStarted || classifying}
            title={t('dishes.actions.classify')}
            aria-label={t('dishes.actions.classify')}
          >
            <div className="flex items-center justify-center gap-0.5 sm:gap-2">
              <Camera className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline text-sm font-semibold">
                {classifying ? t('dishes.actions.classifying') : t('dishes.actions.classify')}
              </span>
            </div>
          </button>

          {/* Sync catálogo */}
          <button
            className="col-span-1 sm:flex-1 px-3 sm:px-3 py-2 sm:py-3 rounded-xl bg-dark-surface text-dark-text-primary border border-dark-border active:scale-[0.98] min-w-0"
            onClick={handleSync}
            disabled={syncing}
            title={t('dishes.actions.sync')}
            aria-label={t('dishes.actions.sync')}
          >
            <div className="flex items-center justify-center gap-0.5 sm:gap-2">
              <RefreshCw className={`h-5 w-5 sm:h-4 sm:w-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-sm font-semibold">
                {syncing ? t('dishes.actions.syncing') : t('dishes.actions.sync')}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickyActions;
