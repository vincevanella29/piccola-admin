import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, User, Eye, Smile } from 'lucide-react';

/**
 * FaceScanner Component
 * Accede a la cámara web usando getUserMedia y proyecta una interfaz de escaneo
 * biométrico futurista (HUD) con efectos visuales optimizados para el Rockchip YF-088D.
 * 
 * @param {Object} props
 * @param {boolean} props.onFaceDetected - Callback que se dispara cuando se detecta un rostro (simulado)
 */
export default function FaceScanner({ onFaceDetected, isActive, profile }) {
  const [hasCamera, setHasCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeFace, setActiveFace] = useState('face_user_a');
  const [metrics, setMetrics] = useState({
    status: 'Inactivo',
    distance: '0.0m',
    emotion: 'N/A',
    attention: '0%',
    vip: 'No identificado'
  });
  
  const videoRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Intentar iniciar la cámara
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false // El audio ya lo maneja el Speech Recognition en App.jsx
      });
      
      setStream(mediaStream);
      setHasCamera(true);
      setIsScanning(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("No se pudo acceder a la cámara:", err.message);
      setHasCamera(false);
      setIsScanning(false);
    }
  };

  // Detener la cámara
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsScanning(false);
    setMetrics({
      status: 'Desconectado',
      distance: '0.0m',
      emotion: 'N/A',
      attention: '0%',
      vip: 'No identificado'
    });
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
  };

  // Disparar detección de rostro cuando cambia el rostro activo y la cámara está escaneando
  useEffect(() => {
    if (isScanning) {
      // Un pequeño retraso para simular la detección
      const timer = setTimeout(() => {
        if (onFaceDetected) {
          onFaceDetected('Neutral', activeFace);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeFace, isScanning]);

  // Efecto de escaneo simulado con variaciones realistas
  useEffect(() => {
    if (isScanning) {
      setMetrics({
        status: 'Buscando rostro...',
        distance: 'Calculando...',
        emotion: 'Analizando...',
        attention: '50%',
        vip: 'Buscando...'
      });

      let tick = 0;
      scanIntervalRef.current = setInterval(() => {
        tick++;
        
        // Simular ciclo de escaneo
        if (tick === 3) {
          setMetrics({
            status: 'ROSTRO DETECTADO',
            distance: '0.9m',
            emotion: 'Neutral',
            attention: '92%',
            vip: 'Buscando en base de datos...'
          });
          if (onFaceDetected) onFaceDetected('Neutral', activeFace);
        } else if (tick > 3) {
          // Fluctuaciones menores
          const emotions = ['Feliz 😃', 'Sonriente 😊', 'Atento 🤔', 'Neutral 😐'];
          const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];
          const randomDist = (0.7 + Math.random() * 0.4).toFixed(1) + 'm';
          const randomAttention = Math.floor(85 + Math.random() * 14) + '%';
          
          setMetrics({
            status: 'SEGUIMIENTO ACTIVO',
            distance: randomDist,
            emotion: randomEmotion,
            attention: randomAttention,
            vip: profile ? profile.name : 'Cliente Registrado'
          });

          // Ocasionalmente avisar al App de cambios
          if (tick % 5 === 0 && onFaceDetected) {
            onFaceDetected(randomEmotion, activeFace);
          }
        }
      }, 2000);
    }

    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isScanning, activeFace, profile]);

  // Sincronizar estado con la activación externa (unificada)
  useEffect(() => {
    if (isActive !== undefined) {
      if (isActive && !isScanning) {
        startCamera();
      } else if (!isActive && isScanning) {
        stopCamera();
      }
    }
  }, [isActive, isScanning]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="face-scanner-widget">
      <style>{`
        .face-scanner-widget {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--border-radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 320px;
          box-shadow: var(--shadow-md);
          align-self: center;
        }

        .scanner-viewport-container {
          position: relative;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          overflow: hidden;
          margin: 0 auto;
          border: 3px solid var(--glass-border);
          background: #000;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scanner-viewport-container.active {
          border-color: var(--color-primary);
          box-shadow: 0 0 20px var(--color-primary-glow);
        }

        .scanner-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1); /* Efecto espejo */
        }

        .scanner-placeholder {
          color: var(--text-muted);
          text-align: center;
          padding: 10px;
          font-size: 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        /* Mira holográfica de escaneo */
        .scanner-hud-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          box-sizing: border-box;
          z-index: 3;
        }

        .scanner-laser {
          position: absolute;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, rgba(212,175,55,0) 0%, var(--color-primary) 50%, rgba(212,175,55,0) 100%);
          animation: scanLine 2s linear infinite;
        }

        .scanner-laser.listening {
          background: linear-gradient(90deg, rgba(224,58,58,0) 0%, var(--color-accent) 50%, rgba(224,58,58,0) 100%);
          animation: scanLine 1.5s linear infinite;
        }

        .scanner-brackets {
          position: absolute;
          top: 25%;
          left: 25%;
          width: 50%;
          height: 50%;
          border: 2px solid transparent;
          box-sizing: border-box;
          transition: all 0.5s ease;
        }

        .scanner-viewport-container.active .scanner-brackets {
          border-color: rgba(212, 175, 55, 0.4);
          border-radius: 8px;
          animation: bracketPulse 1.5s ease-in-out infinite alternate;
        }

        .scanner-metrics-panel {
          background: rgba(0, 0, 0, 0.2);
          border-radius: var(--border-radius-sm);
          padding: 10px;
          font-size: 11px;
          font-family: monospace;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          border: 1px solid var(--glass-border);
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-label {
          color: var(--text-muted);
          font-size: 9px;
          text-transform: uppercase;
        }

        .metric-value {
          color: var(--text-primary);
          font-weight: bold;
        }

        .metric-value.highlight {
          color: var(--color-primary);
        }

        .metric-value.danger {
          color: var(--color-accent);
        }

        .scanner-toggle-btn {
          width: 100%;
          padding: 8px;
          border-radius: var(--border-radius-sm);
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-scanner-on {
          background: var(--color-primary);
          color: var(--bg-primary);
        }

        .btn-scanner-on:hover {
          background: var(--color-primary-hover);
        }

        .btn-scanner-off {
          background: rgba(224, 58, 58, 0.1);
          border: 1px solid rgba(224, 58, 58, 0.3);
          color: var(--color-accent);
        }

        .btn-scanner-off:hover {
          background: var(--color-accent);
          color: var(--text-primary);
        }

        @keyframes scanLine {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes bracketPulse {
          from { transform: scale(0.95); border-color: rgba(212, 175, 55, 0.2); }
          to { transform: scale(1.05); border-color: var(--color-primary); }
        }
      `}</style>

      {/* Visor de Cámara */}
      <div className={`scanner-viewport-container ${isScanning ? 'active' : ''}`}>
        {isScanning ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="scanner-video" 
            />
            {/* Capa HUD */}
            <div className="scanner-hud-overlay">
              <div className="scanner-laser" />
              <div className="scanner-brackets" />
            </div>
          </>
        ) : (
          <div className="scanner-placeholder">
            <CameraOff size={32} />
            <span>Cámara Inactiva</span>
          </div>
        )}
      </div>

      {/* Panel de Métricas */}
      <div className="scanner-metrics-panel">
        <div className="metric-item" style={{ gridColumn: 'span 2' }}>
          <span className="metric-label">ESTADO SENSOR</span>
          <span className={`metric-value ${isScanning ? 'highlight' : ''}`}>{metrics.status}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">DISTANCIA</span>
          <span className="metric-value">{metrics.distance}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">GESTO/ANIMO</span>
          <span className="metric-value highlight">{metrics.emotion}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">ATENCION</span>
          <span className="metric-value">{metrics.attention}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">ID CLIENTE</span>
          <span className="metric-value" style={{ color: '#22c55e' }}>
            {profile ? profile.name : (onFaceDetected && metrics.vip === 'Buscando...' ? 'Buscando...' : 'Desconocido')}
          </span>
        </div>
      </div>

      {/* Selector de Simulación de Rostros */}
      {isScanning && (
        <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '4px' }}>
          <button 
            className={`scanner-toggle-btn ${activeFace === 'face_user_a' ? 'btn-scanner-on' : 'btn-scanner-off'}`}
            style={{ flex: 1, padding: '6px', fontSize: '9px', borderRadius: '4px', cursor: 'pointer', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActiveFace('face_user_a')}
          >
            Rostro A
          </button>
          <button 
            className={`scanner-toggle-btn ${activeFace === 'face_user_b' ? 'btn-scanner-on' : 'btn-scanner-off'}`}
            style={{ flex: 1, padding: '6px', fontSize: '9px', borderRadius: '4px', cursor: 'pointer', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActiveFace('face_user_b')}
          >
            Rostro B
          </button>
        </div>
      )}

      {/* Botón de Encendido / Apagado (Solo si no viene de control unificado externo) */}
      {isActive === undefined && (
        isScanning ? (
          <button className="scanner-toggle-btn btn-scanner-off" onClick={stopCamera}>
            <CameraOff size={14} /> Apagar Cámara
          </button>
        ) : (
          <button className="scanner-toggle-btn btn-scanner-on" onClick={startCamera}>
            <Camera size={14} /> Encender Cámara
          </button>
        )
      )}
    </div>
  );
}
