import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, ChevronDown, ChevronUp } from 'lucide-react';
import useDishRecognition from '../../hooks/useDishRecognition.jsx';

import CameraBox from './components/CameraBox.jsx';
import ResultSheet from './components/ResultSheet.jsx';
import StickyActions from './components/StickyActions.jsx';
import Pill from './components/ui/Pill.jsx';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function DishesPage({ appState }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);

  // cam & ui
  const [cameraStarted, setCameraStarted] = useState(false);
  const [usingFront, setUsingFront] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [permError, setPermError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  // inference loop
  const [lastShotAt, setLastShotAt] = useState(0);
  const TICK_MS = 1200;
  const COOLDOWN_MS = 1000;
  const MIN_GESTURE_GAP = 600;

  // hook back
  const {
    doSyncCatalog, syncing, syncError,
    classifyFromVideo, classifying, result, classifyError,
  } = useDishRecognition(appState);

  // media stream refs
  const streamRef = useRef(null);
  const trackRef = useRef(null);

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
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
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

  const switchCamera = useCallback(async () => {
    await startCamera(!usingFront);
  }, [startCamera, usingFront]);

  const toggleTorch = useCallback(async () => {
    const ok = await applyTorch(!torchOn);
    if (!ok) {
      try { navigator.vibrate?.(30); } catch {}
    }
  }, [torchOn, applyTorch]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // auto-loop
  useEffect(() => {
    if (!autoMode || !cameraStarted || classifying) return;
    let active = true;
    const id = setInterval(async () => {
      if (!active || !videoRef.current) return;
      if (Date.now() - lastShotAt < COOLDOWN_MS) return;
      try {
        setLastShotAt(Date.now());
        await classifyFromVideo(videoRef.current);
      } catch {}
    }, TICK_MS);
    return () => { active = false; clearInterval(id); };
  }, [autoMode, cameraStarted, classifying, classifyFromVideo, lastShotAt]);

  // cooldown badge
  useEffect(() => {
    if (!cameraStarted) return;
    const h = setInterval(() => {
      const left = Math.max(0, (COOLDOWN_MS - (Date.now() - lastShotAt)) / 1000);
      setCooldown(left > 0 && left < 1 ? 0.5 : Math.ceil(left));
    }, 100);
    return () => clearInterval(h);
  }, [cameraStarted, lastShotAt]);

  // results mapping
  const topk = result?.topk || [];
  const topkInfo = result?.topk_info || [];
  const best = topk[0];
  const hasLabel = !!result?.label;
  const labelDoc = result?.label_info;
  const conf = useMemo(() => {
    const s = Math.max(-1, Math.min(1, best?.score ?? 0));
    return (s + 1) / 2;
  }, [best]);

  const handleManualShot = useCallback(async () => {
    if (Date.now() - lastShotAt < MIN_GESTURE_GAP) return;
    setLastShotAt(Date.now());
    try {
      await classifyFromVideo(videoRef.current);
      if (isIOS()) try { navigator.vibrate?.(20); } catch {}
    } catch {}
  }, [classifyFromVideo, lastShotAt]);

  return (
    <div className="min-h-[100svh] bg-dark-background text-dark-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-dark-background/80 backdrop-blur border-b border-dark-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-dark-surface border border-dark-border flex items-center justify-center">
            <Utensils className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold">{t('dishes.title')}</div>
            <div className="text-xs text-dark-text-secondary">
              {t('dishes.subtitle')}
            </div>
          </div>
          <Pill
            onClick={() => setSheetOpen(v => !v)}
            active={sheetOpen}
            aria-label={t('dishes.actions.toggle_details')}
          >
            {sheetOpen ? (
              <span className="inline-flex items-center gap-1">
                <ChevronDown className="h-4 w-4" /> {t('dishes.details')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <ChevronUp className="h-4 w-4" /> {t('dishes.details')}
              </span>
            )}
          </Pill>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-md mx-auto px-4 pt-3 pb-24">
        <CameraBox
          t={t}
          videoRef={videoRef}
          cameraStarted={cameraStarted}
          usingFront={usingFront}
          torchOn={torchOn}
          cooldown={cooldown}
          permError={permError}
          startCamera={startCamera}
        />

        <ResultSheet
          t={t}
          sheetOpen={sheetOpen}
          setSheetOpen={setSheetOpen}
          autoMode={autoMode}
          setAutoMode={setAutoMode}
          result={result}
          hasLabel={hasLabel}
          labelDoc={labelDoc}
          conf={conf}
          topkInfo={topkInfo}
        />

        {/* errors */}
        {syncError && <div className="mt-2 text-xs text-red-400">{t('dishes.errors.sync_prefix')}: {syncError}</div>}
        {classifyError && <div className="mt-2 text-xs text-red-400">{t('dishes.errors.classify_prefix')}: {classifyError}</div>}
      </div>

      <StickyActions
        t={t}
        cameraStarted={cameraStarted}
        usingFront={usingFront}
        torchOn={torchOn}
        syncing={syncing}
        classifying={classifying}
        switchCamera={() => switchCamera()}
        toggleTorch={() => toggleTorch()}
        handleManualShot={() => handleManualShot()}
        handleSync={() => doSyncCatalog().catch(() => {})}
      />
    </div>
  );
}

export const pageMetadata = {
  path: '/app/analytics/dishes',
  label: 'dishes.label',
  category: 'analytics.Análisis',
  minRoleLevel: 3,
  maxRoleLevel: 4,
  order: 2,
  orderWalletMenu: 2,
  orderFooter: 1,
  locations: ['sidebar', 'header', 'footer', 'walletMenu'],
  description: 'dishes.description',
  icon: 'FaUtensils',
  isMainPage: false,
  isSearchable: true,
};
