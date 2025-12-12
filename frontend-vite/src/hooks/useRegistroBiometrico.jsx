// src/hooks/useRegistroBiometrico.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import registroApi, { fetchFotoProxyBlob, escanearCarnet } from '../utils/registro';

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_MATCH_THRESHOLD = 0.5;

// Configuración Sensibilidad
const THRESHOLDS = {
  TURN_THRESHOLD: 0.15, 
  CENTER_TOLERANCE: 0.10, 
  HOLD_FRAMES: 8,         
};

export default function useRegistroBiometrico({
  modelsBaseUrl = '/models',
  tinyFaceOptions = { inputSize: 224, scoreThreshold: 0.5 },
  maxVideoFps = 20,
  appState = null,
} = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const modelsLoadedRef = useRef(false);

  // Auth
  const authHeadersRef = useRef({});
  
  // Refs para loop
  const stageRef = useRef('idle');    
  
  // Estado
  const [cameras, setCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [usingFront, setUsingFront] = useState(true);
  const [cameraStarted, setCameraStarted] = useState(false);
  
  const [stage, setStage] = useState('idle'); 
  const [feedback, setFeedback] = useState('');
  const [progress, setProgress] = useState(0);
  const [forwardCountdown, setForwardCountdown] = useState(null);
  
  const [ready, setReady] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [error, setError] = useState(null);
  
  const [sessionId, setSessionId] = useState(null);
  const [rut, setRut] = useState('');

  // Flujo opcional de escaneo de carnet
  const [scanningCard, setScanningCard] = useState(false);

  // Lógica Biométrica
  const referenceDescriptorRef = useRef(null);
  const neutralHorizRef = useRef(0); 
  const holdCounterRef = useRef(0);
  const lastProcessingTimeRef = useRef(0);
  
  // NUEVO: Guardar la foto final (Blob) para enviar al backend
  const finalImageBlobRef = useRef(null); 

  // --- 1. SETUP & MODELS ---
  useEffect(() => {
    if (appState) {
      authHeadersRef.current = {
        walletAddress: appState.account || appState.walletAddress,
        token: appState.token || appState.accessToken,
      };
    }
  }, [appState]);

  const loadModels = useCallback(async () => {
    if (modelsLoadedRef.current) return;
    try {
      if (!window.faceapi) {
        await new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = FACE_API_CDN;
            s.async = true;
            s.onload = resolve;
            document.head.appendChild(s);
        });
      }
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(modelsBaseUrl),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(modelsBaseUrl),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(modelsBaseUrl),
      ]);
      modelsLoadedRef.current = true;
      setReady(true);
    } catch (e) { console.error(e); setError(new Error('Error cargando IA.')); }
  }, [modelsBaseUrl]);

  // --- 2. CÁMARA ---
  const startCamera = useCallback(async (opts = {}) => {
    const { deviceId = selectedDeviceId, preferFront = true } = opts;
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: preferFront ? 'user' : 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const isFront = (track.getSettings?.().facingMode === 'user') || preferFront;
      
      setUsingFront(isFront);
      setCameraStarted(true);
      updateStage('detecting'); 

      const devs = await navigator.mediaDevices.enumerateDevices();
      setCameras(devs.filter(d => d.kind === 'videoinput'));
    } catch (e) { console.error(e); setError(new Error('Acceso a cámara denegado.')); }
  }, [selectedDeviceId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraStarted(false);
    updateStage('idle');
  }, []);

  const switchCamera = useCallback(() => {
    const nextFront = !usingFront;
    setUsingFront(nextFront);
    startCamera({ preferFront: nextFront });
  }, [usingFront, startCamera]);

  const updateStage = (newStage) => {
    stageRef.current = newStage;
    setStage(newStage);
  };

  // --- 3. UTILS: CAPTURAR SNAPSHOT ---
  const captureSnapshot = async () => {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      // Si usamos cámara frontal y está espejada en CSS, ¿Debemos espejar el canvas?
      // Generalmente para biometría backend NO se quiere espejado (queremos la cara real),
      // así que dibujamos directo del video.
      ctx.drawImage(videoRef.current, 0, 0);
      
      return new Promise(resolve => {
          canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
      });
  };

  // --- 4. PROCESAR CARNET DE IDENTIDAD ---
  // Captura una foto del carnet desde la cámara actual y la envía al backend
  const processIdCard = useCallback(async ({ rut: rutParam, walletAddress, token }) => {
    const targetRut = rutParam || rut;
    if (!videoRef.current || !targetRut) throw new Error('Cámara no iniciada o falta RUT');

    setScanningCard(true);
    try {
      const blob = await captureSnapshot();
      if (!blob) throw new Error('No se pudo capturar imagen del carnet');

      const headers = {
        walletAddress: walletAddress || authHeadersRef.current.walletAddress,
        token: token || authHeadersRef.current.token,
      };

      const result = await escanearCarnet({
        rut: targetRut,
        frontImageBlob: blob,
        ...headers,
      });

      if (!result?.ok || !result.reference_descriptor) {
        throw new Error(result?.message || 'No se pudo procesar el carnet.');
      }

      // Guardar referencia biométrica del carnet (512D ArcFace)
      referenceDescriptorRef.current = new Float32Array(result.reference_descriptor);
      setRut(result.rut_detected || targetRut);

      return { success: true, message: result.message };
    } finally {
      setScanningCard(false);
    }
  }, [rut]);

  // --- 5. PREPARAR SESIÓN ---
  const prepareVerificationSession = useCallback(async ({ rut: rutParam, walletAddress, token, skipReferenceFetch = false }) => {
    const targetRut = rutParam || rut;
    if (walletAddress || token) authHeadersRef.current = { walletAddress, token };

    if (!skipReferenceFetch) {
      const data = await registroApi.consultaRegistro({ rut: targetRut, ...authHeadersRef.current });
      if (!data?.exists) throw new Error('RUT no encontrado.');

      if (data.foto_url) {
        const blob = await fetchFotoProxyBlob({ imageUrl: data.foto_url, ...authHeadersRef.current });
        const img = await window.faceapi.bufferToImage(blob);
        const detection = await window.faceapi
          .detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions(tinyFaceOptions))
          .withFaceLandmarks().withFaceDescriptor();
        if (detection) referenceDescriptorRef.current = detection.descriptor;
      } else {
        // Sin foto y sin referencia previa (carnet) -> la UI debe ofrecer escanear carnet
        if (!referenceDescriptorRef.current) {
          throw new Error('Falta foto de referencia. Usa la opción de Escanear Carnet.');
        }
      }
    }

    const sessionRes = await registroApi.solicitarRegistro({ rut: targetRut, ...authHeadersRef.current });
    setSessionId(sessionRes.session_id || sessionRes.data.session_id);
    setRut(targetRut);
    return { success: true };
  }, [tinyFaceOptions, rut]);

  // --- 6. LOOP DE DETECCIÓN ---
  const runDetectionLoop = useCallback(() => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        rafRef.current = requestAnimationFrame(runDetectionLoop);
        return;
    }
    const now = performance.now();
    if (now - lastProcessingTimeRef.current < (1000 / maxVideoFps)) {
        rafRef.current = requestAnimationFrame(runDetectionLoop);
        return;
    }
    lastProcessingTimeRef.current = now;

    const processFrame = async () => {
        const currentStage = stageRef.current;
        if (['idle', 'success'].includes(currentStage)) return;

        const options = new window.faceapi.TinyFaceDetectorOptions(tinyFaceOptions);
        const needDescriptor = currentStage === 'verifying'; // Solo necesitamos descriptor al inicio para validar identidad
        
        let task = window.faceapi.detectSingleFace(videoRef.current, options).withFaceLandmarks();
        if (needDescriptor) task = task.withFaceDescriptor();

        const detection = await task;

        if (!detection) {
            setHasFace(false);
            setFeedback('Rostro no detectado');
            holdCounterRef.current = 0;
            return;
        }
        
        setHasFace(true);
        const { landmarks, descriptor } = detection;
        
        // CÁLCULO DE YAW (Giro Horizontal)
        const nose = landmarks.getNose()[0]; 
        const jaw = landmarks.getJawOutline();
        const jawLeft = jaw[0];
        const jawRight = jaw[16];
        const faceWidth = jawRight.x - jawLeft.x;
        const centerX = (jawLeft.x + jawRight.x) / 2;
        
        // Lógica Simplificada y Robusta:
        // En webcam frontal: Moverse a la derecha física -> Nariz va a la izquierda de la imagen -> x menor.
        // Queremos: Derecha = Positivo.
        // Fórmula: (Centro - Nariz) / Ancho
        // Si nariz < centro (está a la izquierda), resultado Positivo.
        const yawDelta = (centerX - nose.x) / faceWidth;

        switch (currentStage) {
            case 'detecting':
                if (Math.abs(yawDelta) < THRESHOLDS.CENTER_TOLERANCE) updateStage('verifying');
                else setFeedback('Mira al frente');
                break;

            case 'verifying':
                setFeedback('Analizando identidad...');
                // Si tenemos referencia, comparamos. Si no (caso registro nuevo sin foto), saltamos directo (o validamos carnet antes)
                let match = true;
                if (referenceDescriptorRef.current && descriptor) {
                    const dist = window.faceapi.euclideanDistance(referenceDescriptorRef.current, descriptor);
                    match = dist < FACE_MATCH_THRESHOLD;
                }
                
                if (match) {
                    neutralHorizRef.current = yawDelta; 
                    updateStage('challenge_right');
                    setFeedback('');
                    setProgress(25);
                } else {
                    setFeedback('Rostro no coincide');
                }
                break;

            case 'challenge_right': // Objetivo: > Threshold Positivo
                const targetRight = neutralHorizRef.current + THRESHOLDS.TURN_THRESHOLD;
                if (yawDelta > targetRight) {
                    holdCounterRef.current++;
                    if (holdCounterRef.current > THRESHOLDS.HOLD_FRAMES) {
                        updateStage('challenge_left');
                        setProgress(50);
                        holdCounterRef.current = 0;
                    }
                } else {
                    holdCounterRef.current = 0;
                    if (yawDelta < -0.05) setFeedback('¡Hacia el otro lado!');
                    else setFeedback('');
                }
                break;

            case 'challenge_left': // Objetivo: < Threshold Negativo
                const targetLeft = neutralHorizRef.current - THRESHOLDS.TURN_THRESHOLD;
                if (yawDelta < targetLeft) {
                    holdCounterRef.current++;
                    if (holdCounterRef.current > THRESHOLDS.HOLD_FRAMES) {
                        updateStage('challenge_front');
                        setProgress(75);
                        holdCounterRef.current = 0;
                        setForwardCountdown(3); 
                    }
                } else {
                    holdCounterRef.current = 0;
                    if (yawDelta > 0.05) setFeedback('¡Hacia el otro lado!');
                    else setFeedback('');
                }
                break;

            case 'challenge_front':
                const diff = Math.abs(yawDelta - neutralHorizRef.current);
                if (diff < THRESHOLDS.CENTER_TOLERANCE) {
                    holdCounterRef.current++;
                    if (holdCounterRef.current % maxVideoFps === 0) setForwardCountdown(prev => Math.max(0, (prev||0)-1));

                    if (holdCounterRef.current >= (maxVideoFps * 2)) {
                        // EXITO: CAPTURAR FOTO REAL
                        const blob = await captureSnapshot();
                        finalImageBlobRef.current = blob; // Guardar blob para enviar
                        
                        updateStage('success');
                        setProgress(100);
                        setForwardCountdown(0);
                    }
                } else {
                    holdCounterRef.current = 0; 
                    setForwardCountdown(3);
                    setFeedback('Mantén la mirada al frente');
                }
                break;
        }
    };

    processFrame().catch(() => {}); 
    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [tinyFaceOptions, maxVideoFps]);

  useEffect(() => {
    if (cameraStarted && ready) rafRef.current = requestAnimationFrame(runDetectionLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraStarted, ready, runDetectionLoop]);

  useEffect(() => { loadModels(); }, [loadModels]);

  // --- 7. VALIDAR (ENVÍA FOTO) ---
  const validar = useCallback(async () => {
    if (!finalImageBlobRef.current || !sessionId) throw new Error('Proceso incompleto: falta captura.');
    
    // Convertir referencia a array normal si existe (para JSON)
    const refArr = referenceDescriptorRef.current ? Array.from(referenceDescriptorRef.current) : [];

    const payload = {
        sessionId,
        rut,
        liveImageBlob: finalImageBlobRef.current, // ENVIAMOS LA FOTO
        referenceDescriptor: refArr,
        liveness: { turn_left: true, turn_right: true, look_forward: true },
        ...authHeadersRef.current
    };
    
    return registroApi.validarRegistro(payload);
  }, [sessionId, rut]);

  const reset = useCallback(() => {
    updateStage('idle');
    setHasFace(false);
    setProgress(0);
    setForwardCountdown(null);
    holdCounterRef.current = 0;
    referenceDescriptorRef.current = null;
    finalImageBlobRef.current = null;
  }, []);

  return {
    videoRef, ready, cameraStarted, hasFace, error,
    stage, feedback, progress, forwardCountdown,
    prepareVerificationSession, startLiveVerification: startCamera,
    stopCamera, switchCamera, reset, validar, usingFront,
    processIdCard, scanningCard,
    rut,
  };
}