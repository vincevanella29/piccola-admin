import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, RefreshCw } from 'lucide-react';
import useDishRecognition from '../../hooks/useDishRecognition.jsx';

import CameraBox from './components/CameraBox.jsx';
import ResultSheet from './components/ResultSheet.jsx';
import CameraControls from './components/CameraControls.jsx';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function DishesPage({ appState }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);

  // --- State ---
  const [cameraStarted, setCameraStarted] = useState(false);
  const [usingFront, setUsingFront] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [permError, setPermError] = useState(null);
  const [lastShotAt, setLastShotAt] = useState(0);

  const TICK_MS = 1200;
  const COOLDOWN_MS = 1000;
  const MIN_GESTURE_GAP = 600;

  const {
    doSyncCatalog, syncing,
    classifyFromVideo, classifying, result,
  } = useDishRecognition(appState);

  const streamRef = useRef(null);
  const trackRef = useRef(null);

  // --- Lógica de Control de Cámara (Completa) ---
  const stopCamera = useCallback(() => {
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
    } catch {}
    streamRef.current = null;
    trackRef.current = null;
    setCameraStarted(false);
    setTorchOn(false);
  }, []);

  const applyTorch = useCallback(async (on) => {
    try {
      const track = trackRef.current;
      if (!track) return false;
      const caps = track.getCapabilities?.() || {};
      if (!('torch' in caps)) return false;
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
      setTorchOn(!!on);
      return true;
    } catch {
      return false;
    }
  }, []);

  const startCamera = useCallback(async (front = false) => {
    setPermError(null);
    try {
      stopCamera();
      const constraints = {
        audio: false,
        video: {
          facingMode: front ? 'user' : 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraStarted(true);
      setUsingFront(front);
      if (front) setTorchOn(false);
    } catch (e) {
      setPermError(e?.message || t('dishes.errors.camera_access'));
      setCameraStarted(false);
    }
  }, [stopCamera, t]);

  const switchCamera = useCallback(() => startCamera(!usingFront), [startCamera, usingFront]);
  const toggleTorch = useCallback(() => applyTorch(!torchOn), [applyTorch, torchOn]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!autoMode || !cameraStarted || classifying) return;
    let active = true;
    const id = setInterval(async () => {
      if (!active || !videoRef.current || (Date.now() - lastShotAt < COOLDOWN_MS)) return;
      try {
        setLastShotAt(Date.now());
        await classifyFromVideo(videoRef.current);
      } catch {}
    }, TICK_MS);
    return () => { active = false; clearInterval(id); };
  }, [autoMode, cameraStarted, classifying, classifyFromVideo, lastShotAt]);

  const handleManualShot = useCallback(async () => {
    if (classifying || (Date.now() - lastShotAt < MIN_GESTURE_GAP)) return;
    setLastShotAt(Date.now());
    try {
      await classifyFromVideo(videoRef.current);
      if (isIOS()) try { navigator.vibrate?.(20); } catch {}
    } catch {}
  }, [classifyFromVideo, lastShotAt, classifying]);

  return (
    <div className="h-[80svh] w-full bg-light-surface dark:bg-dark-surface overflow-hidden relative select-none">
      
      <CameraBox
        videoRef={videoRef}
        cameraStarted={cameraStarted}
        usingFront={usingFront}
        permError={permError}
        startCamera={startCamera}
        t={t}
      />
      
      <header className="absolute top-0 left-0 right-0 z-30 pt-[env(safe-area-inset-top)]">
         <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 backdrop-blur-sm border border-light-border dark:border-dark-border flex items-center justify-center">
              <Utensils className="h-5 w-5 text-light-text-primary dark:text-dark-text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary">{t('dishes.title')}</h1>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('dishes.subtitle')}</p>
            </div>
          </div>
          {cameraStarted && (
             <button
              onClick={() => doSyncCatalog().catch(() => {})}
              disabled={syncing}
              className="h-10 w-10 rounded-xl bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 backdrop-blur-sm border border-light-border dark:border-dark-border flex items-center justify-center text-light-text-primary dark:text-dark-text-primary active:scale-95 transition-transform disabled:opacity-50"
             >
                <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
             </button>
          )}
        </div>
      </header>

      <ResultSheet
        result={result}
        classifying={classifying}
        t={t}
      />
      
      <CameraControls
        cameraStarted={cameraStarted}
        usingFront={usingFront}
        torchOn={torchOn}
        classifying={classifying}
        autoMode={autoMode}
        setAutoMode={setAutoMode}
        switchCamera={switchCamera}
        toggleTorch={toggleTorch}
        handleManualShot={handleManualShot}
        t={t}
      />
    </div>
  );
}

export const pageMetadata = {
  path: '/app/analytics/dishes',
  label: 'dishes.label',
  category: 'analytics.category',
  minRoleLevel: 3,
  maxRoleLevel: 5,
  order: 2,
  locations: ['sidebar'],
  description: 'dishes.description',
  icon: 'FaBrain',
  isMainPage: false,
  isSearchable: true,
};
