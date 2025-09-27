import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import registroApi, { fetchFotoProxyBlob } from '../utils/registro.jsx';

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_MATCH_THRESHOLD = 0.5;

// Utilidades de logging con timestamp y duración
function nowTs() {
  try { return new Date().toISOString(); } catch { return String(Date.now()); }
}
function logDuration(label, t0) {
  const dt = (performance.now() - t0).toFixed(1);
  // eslint-disable-next-line no-console
}

export default function useRegistroBiometrico({
  modelsBaseUrl = '/models',
  tinyFaceOptions = { inputSize: 160, scoreThreshold: 0.4 }, // Reducido para mayor velocidad
  maxVideoFps = 20,
  appState = null, // Usar appState como fuente única de wallet/token
} = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const modelsLoadedRef = useRef(false);
  const [cameras, setCameras] = useState([]); // [{deviceId,label,kind}]
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [usingFront, setUsingFront] = useState(true); // para espejar sólo si es frontal
  
  const [turnedLeft, setTurnedLeft] = useState(false);
  const [turnedRight, setTurnedRight] = useState(false);
  const [lookedUp, setLookedUp] = useState(true);
  const [lookedForward, setLookedForward] = useState(false);

  const [ready, setReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState(null);
  const [hasFace, setHasFace] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Alinea tu rostro en el óvalo');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  
  const [sessionId, setSessionId] = useState(null);
  const [rut, setRut] = useState('');
  
  const referenceDescriptorRef = useRef(null);
  const finalDescriptorRef = useRef(null);
  const authHeadersRef = useRef({});
  const lastDescAtRef = useRef(0);
  const capturingForwardRef = useRef(false);
  const forwardEndAtRef = useRef(0);
  const [forwardCountdown, setForwardCountdown] = useState(null);
  const prevHorizRef = useRef(null);
  const lastPoseOkAtRef = useRef(0);
  const neutralHorizRef = useRef(null);
  const leftHoldRef = useRef(0);
  const rightHoldRef = useRef(0);
  const lastTurnAtRef = useRef(0);
  const lastTurnDirRef = useRef(null); // 'left' | 'right' | null

  const enumerateCameras = useCallback(async () => {
    // En iOS, para ver labels hay que pedir permiso primero
    try {
      if (!streamRef.current) {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tmp.getTracks().forEach(t => t.stop());
      }
    } catch (e) {
      // si falla, igual intenta enumerar
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const vids = devices.filter(d => d.kind === 'videoinput');
    setCameras(vids);
    return vids;
  }, []);

  const loadFaceApiScript = useCallback(async () => {
    if (window.faceapi) return;
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = FACE_API_CDN;
      s.async = true;
      s.onload = () => { logDuration('loadFaceApiScript', t0); resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar face-api.js'));
      document.head.appendChild(s);
    });
  }, []);

  // Sincronizar credenciales desde appState (formato del proyecto)
  useEffect(() => {
    if (appState) {
      const walletAddress = appState.account || appState.walletAddress || null;
      const token = appState.token || appState.accessToken || null;
      authHeadersRef.current = { walletAddress, token };
    }
  }, [appState]);

  // Método expuesto para setear auth desde appState manualmente si cambia fuera del ciclo
  const setAuthFromAppState = useCallback((state) => {
    if (!state) return;
    const walletAddress = state.account || state.walletAddress || null;
    const token = state.token || state.accessToken || null;
    authHeadersRef.current = { walletAddress, token };
  }, []);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;
    setLoadingModels(true);
    const t0 = performance.now();
    try {
      await loadFaceApiScript();
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(modelsBaseUrl),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(modelsBaseUrl),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(modelsBaseUrl),
      ]);
      modelsLoadedRef.current = true;
      setReady(true);
    } catch (e) {
      console.error('[Biometría] Falló la carga de modelos.', e);
      setError(e);
      throw e;
    } finally {
      setLoadingModels(false);
      logDuration('loadModels', t0);
    }
  }, [modelsBaseUrl, loadFaceApiScript]);

  const startCamera = useCallback(async (opts = {}) => {
    const { deviceId = selectedDeviceId, preferFront = true } = opts;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    const t0 = performance.now();
    try {
      // Armar lista de intentos de constraints (de mayor preferencia a fallback)
      const attempts = [];
      if (deviceId) {
        attempts.push({ video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      }
      // Heurística: frontal primero
      if (preferFront) {
        attempts.push({ video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        attempts.push({ video: { facingMode: 'user' }, audio: false });
      }
      // Luego trasera
      attempts.push({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      attempts.push({ video: { facingMode: 'environment' }, audio: false });
      // Último recurso
      attempts.push({ video: true, audio: false });

      let stream = null;
      let chosenAttempt = null;
      for (const c of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          chosenAttempt = c;
          break;
        } catch (e) {
          // sigue intentando
        }
      }
      if (!stream) throw new Error('No se pudo obtener acceso a la cámara.');

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS necesita esto a veces si el atributo no llegó al DOM aún
        try { videoRef.current.setAttribute('playsinline', 'true'); } catch {}
        try { videoRef.current.setAttribute('muted', 'true'); } catch {}
        // Espera a que el video esté listo para reproducir (canplay) con timeout de seguridad
        await new Promise((resolve) => {
          let done = false;
          const cleanup = () => { if (!done) { done = true; resolve(); } };
          const onCanPlay = () => { videoRef.current?.removeEventListener('canplay', onCanPlay); cleanup(); };
          const onLoadedMeta = () => { videoRef.current?.removeEventListener('loadedmetadata', onLoadedMeta); cleanup(); };
          videoRef.current.addEventListener('canplay', onCanPlay, { once: true });
          videoRef.current.addEventListener('loadedmetadata', onLoadedMeta, { once: true });
          setTimeout(cleanup, 4000); // móviles pueden tardar más
        });
        await videoRef.current.play();
        // Detectar si es frontal para espejar
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings?.() || {};
        const label = track.label?.toLowerCase?.() || '';
        const isFrontByLabel = /front|frontal|user/.test(label);
        const isFrontByFacing = (settings.facingMode || '').toLowerCase() === 'user';
        setUsingFront(isFrontByLabel || isFrontByFacing || preferFront);
      }
      logDuration('startCamera', t0);
      setCameraStarted(true);
      // Actualiza listado y seleccion actual si no estaba
      const vids = await enumerateCameras();
      if (!deviceId && vids.length) {
        // intenta elegir la frontal por label
        const front = vids.find(v => /front|frontal|user/i.test(v.label)) || vids[0];
        setSelectedDeviceId(front.deviceId);
      }
    } catch (e) {
      console.error('[Biometría] Falló al iniciar la cámara.', e);
      if (e?.name === 'NotAllowedError') {
        setError(new Error('Permiso de cámara denegado. Actívalo en Ajustes.'));
      } else if (e?.name === 'NotFoundError') {
        setError(new Error('No se encontró ninguna cámara disponible.'));
      } else if (e?.name === 'OverconstrainedError') {
        setError(new Error('La cámara no soporta los parámetros solicitados.'));
      } else {
        setError(e);
      }
      throw e;
    }
  }, [enumerateCameras, selectedDeviceId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    setCameraStarted(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const vids = cameras.length ? cameras : await enumerateCameras();
    if (!vids.length) return;
    // si hay 2+, alterna entre frontal/trasea. si no, sólo reinicia
    const front = vids.find(v => /front|frontal|user/i.test(v.label));
    const back  = vids.find(v => /back|trasera|environment|rear/i.test(v.label));
    const target = usingFront ? (back || vids.find(v => v.deviceId !== selectedDeviceId) || vids[0])
                              : (front || vids.find(v => v.deviceId !== selectedDeviceId) || vids[0]);
    setSelectedDeviceId(target.deviceId);
    setUsingFront(target === front);
    await startCamera({ deviceId: target.deviceId, preferFront: target === front });
  }, [cameras, enumerateCameras, selectedDeviceId, startCamera, usingFront]);

  const buildReferenceDescriptor = useCallback(async (imageUrl) => {
    if (!imageUrl || !window.faceapi) {
      const err = new Error("URL de imagen inválida o face-api no cargado.");
      setError(err);
      throw err;
    }
    const t0 = performance.now();
    try {
      const blob = await fetchFotoProxyBlob({
        imageUrl,
        walletAddress: authHeadersRef.current.walletAddress,
        token: authHeadersRef.current.token,
      });
      const img = await window.faceapi.bufferToImage(blob);
      const detection = await window.faceapi
        .detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions(tinyFaceOptions))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!detection) {
        const err = new Error('No se detectó un rostro en la foto de perfil. Contacta a RRHH.');
        setError(err);
        throw err;
      }
      logDuration('buildReferenceDescriptor', t0);
      return detection.descriptor;
    } catch (e) {
      console.error("[Biometría] Error construyendo descriptor de referencia:", e);
      setError(e);
      throw e;
    }
  }, [tinyFaceOptions]);

  const nextInstruction = useMemo(() => {
    if (!identityVerified) return 'verify_identity';
    if (!turnedLeft) return 'turn_left';
    if (!turnedRight) return 'turn_right';
    if (!lookedForward) return 'look_forward';
    return null;
  }, [identityVerified, turnedLeft, turnedRight, lookedForward]);

  useEffect(() => {
    // Carga modelos al montar el componente
    const t0 = performance.now();
    loadModels().catch((e) => {
      console.error('[Biometría] Error al cargar modelos al inicio:', e);
      setError(e);
    }).finally(() => {
      logDuration('initialLoadModels', t0);
    });
  }, [loadModels]);

  useEffect(() => {
    if (!cameraStarted || !ready) return;

    let lastTick = 0;
    const minDelta = 1000 / maxVideoFps;

    const detectLoop = async () => {
      if (!videoRef.current || videoRef.current.paused) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }
      // Asegura que el video tenga dimensiones válidas antes de detectar
      if ((videoRef.current.videoWidth || 0) === 0 || (videoRef.current.videoHeight || 0) === 0) {
        // eslint-disable-next-line no-console
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }
      
      const now = performance.now();
      if (now - lastTick > minDelta) {
        lastTick = now;
        const detectT0 = performance.now();
        const tfdOptions = new window.faceapi.TinyFaceDetectorOptions(tinyFaceOptions);
        let needDescriptor = !identityVerified || nextInstruction === 'look_forward';
        if (!identityVerified && needDescriptor && (now - lastDescAtRef.current) < 300) { // Más throttle
          needDescriptor = false;
        }

        let detectionTask = window.faceapi.detectSingleFace(videoRef.current, tfdOptions);
        detectionTask = needDescriptor ? detectionTask.withFaceLandmarks().withFaceDescriptor() : detectionTask.withFaceLandmarks();
        const detection = await detectionTask;
        const dms = performance.now() - detectT0;
        // Loguea frames lentos (>100ms) o cada 10 frames aprox
        if (dms > 100 || Math.floor(now / 1000) !== Math.floor((now - (now - lastTick)) / 1000)) {
          // eslint-disable-next-line no-console
        }
        if (needDescriptor) lastDescAtRef.current = now;

        if (detection) {
          if (!hasFace) setHasFace(true);
          const { landmarks, descriptor } = detection;
          const { positions } = landmarks;

          if (!identityVerified) {
            if (!referenceDescriptorRef.current || !descriptor) {
              setStatusMessage("Preparando referencia...");
            } else {
              setStatusMessage("Verificando identidad...");
              try {
                const t0 = performance.now();
                const distance = window.faceapi.euclideanDistance(referenceDescriptorRef.current, descriptor);
                logDuration('euclideanDistance', t0);
                if (distance < FACE_MATCH_THRESHOLD) {
                  setIdentityVerified(true);
                  // Fijar baseline neutral para giros (centro) en el frame de verificación
                  try {
                    const neutral = (positions[30].x - positions[0].x) / ((positions[16].x - positions[30].x) || 1);
                    if (isFinite(neutral)) neutralHorizRef.current = neutral;
                  } catch {}
                } else {
                  setStatusMessage('Rostro no coincide con foto de perfil.');
                }
              } catch (e) {
                console.warn('[Biometría] Comparación falló, reintentando...', e);
              }
            }
          } else {
            switch (nextInstruction) {
              case 'turn_left':
                const ratioL = (positions[30].x - positions[0].x) / ((positions[16].x - positions[30].x) || 1);
                // Usa baseline si existe; de lo contrario, usa 1.0 como centro aproximado
                const baseL = neutralHorizRef.current ?? 1.0;
                const deltaL = ratioL - baseL;
                // Cooldown para no encadenar con derecha inmediatamente
                const nowMsL = performance.now();
                const inCooldownL = lastTurnDirRef.current === 'right' && (nowMsL - lastTurnAtRef.current < 600);
                if (!inCooldownL && (deltaL < -0.18 || ratioL < 0.75)) {
                  leftHoldRef.current += 1;
                  if (leftHoldRef.current >= 4) { // requiere ~4 frames consecutivos
                    setTurnedLeft(true);
                    lastTurnDirRef.current = 'left';
                    lastTurnAtRef.current = nowMsL;
                    leftHoldRef.current = 0;
                    rightHoldRef.current = 0;
                  }
                } else {
                  leftHoldRef.current = 0;
                }
                break;
              case 'turn_right':
                const ratioR = (positions[30].x - positions[0].x) / ((positions[16].x - positions[30].x) || 1);
                const baseR = neutralHorizRef.current ?? 1.0;
                const deltaR = ratioR - baseR;
                const nowMsR = performance.now();
                const inCooldownR = lastTurnDirRef.current === 'left' && (nowMsR - lastTurnAtRef.current < 600);
                if (!inCooldownR && (deltaR > 0.18 || ratioR > 1.15)) {
                  rightHoldRef.current += 1;
                  if (rightHoldRef.current >= 4) {
                    setTurnedRight(true);
                    lastTurnDirRef.current = 'right';
                    lastTurnAtRef.current = nowMsR;
                    rightHoldRef.current = 0;
                    leftHoldRef.current = 0;
                  }
                } else {
                  rightHoldRef.current = 0;
                }
                break;
              case 'look_forward':
                // Suavizado para evitar jitter del ratio horizontal
                const horizNow = (positions[30].x - positions[0].x) / ((positions[16].x - positions[30].x) || 1);
                const prevH = prevHorizRef.current == null ? horizNow : prevHorizRef.current;
                const horizRatio = (0.7 * prevH) + (0.3 * horizNow); // low-pass filter
                prevHorizRef.current = horizRatio;
                const poseOk = (horizRatio > 0.80 && horizRatio < 1.25);
                if (poseOk) {
                  lastPoseOkAtRef.current = now;
                  if (!lookedForward) {
                    if (!capturingForwardRef.current) {
                      capturingForwardRef.current = true;
                      forwardEndAtRef.current = now + 1500; // 1.5s más ágil
                      setForwardCountdown(2);
                      setStatusMessage('Mantén la mirada al frente... 2');
                    } else {
                      const remaining = Math.max(0, Math.ceil((forwardEndAtRef.current - now) / 1000));
                      if (remaining !== forwardCountdown) {
                        setForwardCountdown(remaining);
                        setStatusMessage(`Mantén la mirada al frente... ${remaining}`);
                      }
                      if (now >= forwardEndAtRef.current) {
                        if (descriptor && (Array.isArray(descriptor) || ArrayBuffer.isView(descriptor))) {
                          finalDescriptorRef.current = Array.from(descriptor);
                          setLookedForward(true);
                          setStatusMessage('Foto capturada');
                        }
                        capturingForwardRef.current = false;
                        setForwardCountdown(null);
                      }
                    }
                  }
                } else {
                  // Pequeña gracia: no cancelar a la primera fluctuación; espera 400ms sin pose ok
                  if (capturingForwardRef.current && !lookedForward) {
                    if (now - lastPoseOkAtRef.current > 400) {
                      capturingForwardRef.current = false;
                      setForwardCountdown(null);
                      setStatusMessage('Vuelve a mirar al frente');
                    }
                  }
                }
                break;
            }
          }
        } else {
          if (hasFace) setHasFace(false);
          setStatusMessage('Alinea tu rostro en el óvalo');
        }
      }
      rafRef.current = requestAnimationFrame(detectLoop);
    };

    rafRef.current = requestAnimationFrame(detectLoop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, cameraStarted, hasFace, identityVerified, nextInstruction, maxVideoFps, tinyFaceOptions]);

  const prepareVerificationSession = useCallback(async ({ rut, walletAddress, token } = {}) => {
    const tSession = performance.now();
    // Permitir override puntual, pero por defecto usar appState sincronizado
    if (walletAddress || token) {
      authHeadersRef.current = {
        walletAddress: walletAddress ?? authHeadersRef.current.walletAddress,
        token: token ?? authHeadersRef.current.token,
      };
    }
    const tConsulta = performance.now();
    const res = await registroApi.consultaRegistro({
      rut,
      walletAddress: authHeadersRef.current.walletAddress,
      token: authHeadersRef.current.token,
    });
    logDuration('consultaRegistro', tConsulta);
    const data = res?.data || res;
    if (!data?.exists) throw new Error('El RUT no se encuentra en nuestros registros.');
    if (!data?.has_photo || !data?.foto_url) throw new Error('Tu perfil no tiene foto de referencia. Contacta a RRHH.');
    
    const tBuild = performance.now();
    const refDescriptor = await buildReferenceDescriptor(data.foto_url);
    logDuration('buildReferenceDescriptor(total)', tBuild);
    if (!refDescriptor) throw new Error('No se pudo procesar la foto de perfil. Contacta a RRHH.');
    referenceDescriptorRef.current = refDescriptor;

    const tSolicitar = performance.now();
    const sessionRes = await registroApi.solicitarRegistro({
      rut,
      walletAddress: authHeadersRef.current.walletAddress,
      token: authHeadersRef.current.token,
    });
    logDuration('solicitarRegistro', tSolicitar);
    setSessionId((sessionRes?.data || sessionRes).session_id);
    setRut(rut);
    logDuration('prepareVerificationSession', tSession);
    return data;
  }, [buildReferenceDescriptor]);

  const startLiveVerification = useCallback(async () => {
    try {
      await startCamera();
    } catch (e) {
      setError(e);
      throw e;
    }
  }, [startCamera]);

  const reset = useCallback(() => {
    setTurnedLeft(false);
    setTurnedRight(false);
    setLookedUp(true);
    setLookedForward(false);
    setForwardCountdown(null);
    capturingForwardRef.current = false;
    setHasFace(false);
    setStatusMessage('Alinea tu rostro en el óvalo');
    setIdentityVerified(false);
    referenceDescriptorRef.current = null;
    finalDescriptorRef.current = null;
  }, []);

  const validar = useCallback(async ({ walletAddress, token } = {}) => {
    if (!sessionId || !rut || !finalDescriptorRef.current) {
      throw new Error('Faltan datos o no se completó el paso final para validar.');
    }
    // Permitir override pero priorizar credenciales del ref (appState)
    if (walletAddress || token) {
      authHeadersRef.current = {
        walletAddress: walletAddress ?? authHeadersRef.current.walletAddress,
        token: token ?? authHeadersRef.current.token,
      };
    }
    // Backend espera claves: 'turn_left', 'turn_right', 'look_forward'
    const liveness = { turn_left: turnedLeft, turn_right: turnedRight, look_forward: lookedForward };
    const payload = {
      sessionId,
      rut,
      liveDescriptor: finalDescriptorRef.current,
      referenceDescriptor: Array.from(referenceDescriptorRef.current),
      liveness,
      walletAddress: authHeadersRef.current.walletAddress,
      token: authHeadersRef.current.token,
    };
    return registroApi.validarRegistro(payload);
  }, [rut, sessionId, turnedLeft, turnedRight, lookedUp, lookedForward]);

  return {
    videoRef, ready, loadingModels, error,
    turnedLeft, turnedRight, lookedUp, lookedForward,
    hasFace, statusMessage, nextInstruction, identityVerified,
    prepareVerificationSession, startLiveVerification,
    reset, stopCamera, validar,
    forwardCountdown,
    setAuthFromAppState,
    cameras, selectedDeviceId, setSelectedDeviceId,
    switchCamera, usingFront,
  };
}