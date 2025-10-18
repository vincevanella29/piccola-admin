import React from 'react';

const CameraBox = ({
  t,
  videoRef,
  cameraStarted,
  usingFront,
  torchOn,
  cooldown,
  permError,
  startCamera,
}) => {
  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-dark-border aspect-[3/4] bg-black">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${usingFront ? 'transform scale-x-[-1]' : ''}`}
        autoPlay playsInline muted
      />

      {!cameraStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => startCamera(false)}
              className="px-5 py-3 rounded-xl bg-matrix-green text-white font-semibold shadow-lg active:scale-[0.98]"
            >
              {t('dishes.actions.allow_camera')}
            </button>
            {permError && (
              <div className="text-xs text-red-300 bg-red-900/30 border border-red-800 rounded px-2 py-1 max-w-[18rem] text-center">
                {permError}
              </div>
            )}
            <div className="text-[11px] text-dark-text-secondary text-center max-w-[18rem]">
              {t('dishes.hints.ios_tap')}
            </div>
          </div>
        </div>
      )}

      {cameraStarted && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[11px]">
          <div className="px-2 py-1 rounded bg-dark-surface/80 border border-dark-border">
            {usingFront ? t('dishes.camera.front') : t('dishes.camera.rear')}
          </div>

          {!!cooldown && (
            <div className="px-2 py-1 rounded bg-dark-surface/80 border border-dark-border">
              {t('dishes.cooldown', { s: cooldown })}
            </div>
          )}
        </div>
      )}

      {cameraStarted && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[68%] h-[68%] rounded-2xl border-2 border-white/25" />
        </div>
      )}
    </div>
  );
};

export default CameraBox;
