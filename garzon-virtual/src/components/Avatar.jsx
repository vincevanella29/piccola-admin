import React from 'react';

/**
 * Avatar Component
 * Dibuja un rostro digital estilizado e interactivo usando SVG y animaciones CSS.
 * Corre a 60fps fluidos en hardware de bajo costo (ej: Rockchip RK356x).
 * 
 * @param {Object} props
 * @param {boolean} props.isListening - Indica si el micrófono está escuchando al usuario
 * @param {boolean} props.isSpeaking - Indica si el garzón virtual está reproduciendo voz
 */
export default function Avatar({ isListening, isSpeaking }) {
  // Determina las clases de animación
  const ringClassName = `avatar-glow-ring ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`;
  const mouthStyle = isSpeaking 
    ? { animation: 'speak-motion 0.2s ease-in-out infinite alternate' } 
    : {};

  return (
    <div className="avatar-container-el" style={{ position: 'relative', width: '160px', height: '160px' }}>
      {/* Estilos Inline específicos para las micro-animaciones del Avatar */}
      <style>{`
        .avatar-glow-ring {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 2px dashed rgba(255, 255, 255, 0.05);
          transition: all 0.5s ease;
          transform: scale(0.95);
        }
        
        .avatar-glow-ring.listening {
          border: 2px solid var(--color-accent);
          box-shadow: 0 0 30px rgba(224, 58, 58, 0.2);
          transform: scale(1.05);
          border-style: dotted;
          animation: spin 8s linear infinite;
        }

        .avatar-glow-ring.speaking {
          border: 2px solid var(--color-primary);
          box-shadow: 0 0 30px rgba(214, 175, 55, 0.3);
          transform: scale(1.08);
          animation: pulseRing 1.5s ease-in-out infinite;
        }

        .avatar-eye-left, .avatar-eye-right {
          transform-origin: center;
          animation: blink 4s ease-in-out infinite;
          fill: var(--text-primary);
          transition: fill 0.3s ease;
        }

        .avatar-eye-left.listening, .avatar-eye-right.listening {
          fill: var(--color-accent);
        }

        .avatar-eye-left.speaking, .avatar-eye-right.speaking {
          fill: var(--color-primary);
        }

        .face-plate {
          fill: var(--bg-secondary);
          stroke: var(--glass-border);
          stroke-width: 2;
          transition: all 0.3s ease;
        }

        .face-plate.listening {
          stroke: rgba(224, 58, 58, 0.4);
        }

        .face-plate.speaking {
          stroke: rgba(212, 175, 55, 0.4);
        }

        @keyframes spin {
          from { transform: scale(1.05) rotate(0deg); }
          to { transform: scale(1.05) rotate(360deg); }
        }

        @keyframes pulseRing {
          0%, 100% { transform: scale(1.05); opacity: 0.8; }
          50% { transform: scale(1.12); opacity: 0.5; }
        }

        @keyframes speak-motion {
          0% { height: 4px; rx: 2px; }
          100% { height: 28px; rx: 14px; }
        }
      `}</style>

      {/* Anillo de Partículas/Glow */}
      <div className={ringClassName}></div>

      {/* SVG del Rostro del Garzón */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 2 }}
      >
        {/* Sombra / Glow Base */}
        <circle cx="100" cy="100" r="85" fill="rgba(18, 24, 36, 0.4)" />
        
        {/* Placa Facial Base */}
        <circle
          cx="100"
          cy="100"
          r="80"
          className={`face-plate ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
        />

        {/* Detalles Tecnológicos del Casco / Platillo */}
        <path d="M 30 100 A 70 70 0 0 1 170 100" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="4" strokeLinecap="round" />
        <path d="M 50 160 Q 100 175 150 160" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="2" strokeLinecap="round" />

        {/* Sombrero de Chef Minimalista */}
        <g opacity="0.85">
          <path d="M 75 40 Q 65 25 80 20 Q 100 10 120 20 Q 135 25 125 40 Z" fill="var(--bg-tertiary)" stroke="var(--glass-border)" strokeWidth="1" />
          <rect x="78" y="36" width="44" height="8" rx="2" fill="var(--bg-tertiary)" stroke="var(--glass-border)" strokeWidth="1" />
        </g>

        {/* Mejillas Sonrientes (glowing) */}
        <circle cx="55" cy="115" r="8" fill={isListening ? 'rgba(224, 58, 58, 0.1)' : isSpeaking ? 'rgba(214, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.02)'} transition="fill 0.3s" />
        <circle cx="145" cy="115" r="8" fill={isListening ? 'rgba(224, 58, 58, 0.1)' : isSpeaking ? 'rgba(214, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.02)'} transition="fill 0.3s" />

        {/* Ojo Izquierdo */}
        <ellipse
          cx="68"
          cy="95"
          rx="6"
          ry="10"
          className={`avatar-eye-left ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
        />
        {/* Ojo Derecho */}
        <ellipse
          cx="132"
          cy="95"
          rx="6"
          ry="10"
          className={`avatar-eye-right ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
        />

        {/* Cejas Expresivas */}
        <path
          d={isListening ? "M 58 82 Q 68 85 78 82" : isSpeaking ? "M 58 80 Q 68 76 78 80" : "M 58 81 Q 68 81 78 81"}
          stroke="var(--text-muted)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          transition="d 0.3s"
        />
        <path
          d={isListening ? "M 122 82 Q 132 85 142 82" : isSpeaking ? "M 122 80 Q 132 76 142 80" : "M 122 81 Q 132 81 142 81"}
          stroke="var(--text-muted)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          transition="d 0.3s"
        />

        {/* Nariz */}
        <path d="M 97 105 Q 100 108 103 105" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Boca Digital (Se estira cuando habla) */}
        <rect
          x={isSpeaking ? "88" : "85"}
          y={isSpeaking ? "110" : "120"}
          width={isSpeaking ? "24" : "30"}
          height={isSpeaking ? "20" : "4"}
          rx={isSpeaking ? "12" : "2"}
          fill={isListening ? 'var(--color-accent)' : isSpeaking ? 'var(--color-primary)' : 'var(--color-primary)'}
          style={mouthStyle}
          transition="all 0.15s ease"
        />
      </svg>
    </div>
  );
}
