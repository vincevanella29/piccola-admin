// src/components/common/LoadingSpinner.jsx
import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import VanellixIcon from './IAIcon';

const LoadingSpinner = ({
  size = 'md',
  showText = true,
  backgroundType = 'default',
  isFullScreen = false,
  rippleDrop,
}) => {
  const { t } = useTranslation();
  const matrixCanvasRef = useRef(null);
  const matrixContainerRef = useRef(null);

  // Size mappings for the VanellixIcon
  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';

  // Matrix rain effect
  useEffect(() => {
    if (backgroundType !== 'matrix') return;
    const canvas = matrixCanvasRef.current;
    const container = matrixContainerRef.current;
    if (!canvas || !container) return;
    let animationId;

    const ctx = canvas.getContext('2d');
    const FONT_SIZE = 32;
    const MATRIX_COLOR = '#00eaff';
    const MATRIX_SPEED = 1;
    const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}".split("");
    let drops = [];

    // --- Zona de corte (área del spinner/logo) ---
    // Estima el radio según sizeClass
    let cutRadius = 48; // md por defecto
    if (size === 'lg') cutRadius = 64;
    if (size === 'sm') cutRadius = 32;

    const setCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    setCanvasSize();

    const numCols = Math.floor(canvas.width / FONT_SIZE);
    drops = [];
    for (let col = 0; col < numCols; col++) {
      drops.push({
        id: `col-${col}`,
        col,
        x: col * FONT_SIZE + FONT_SIZE / 2,
        y: Math.random() * canvas.height,
        speed: Math.random() * MATRIX_SPEED + 1,
        char: matrixChars[Math.floor(Math.random() * matrixChars.length)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      // Mapa para recordar la última posición enviada de cada drop
      if (!window._matrixLastRipplePos) window._matrixLastRipplePos = {};
      const lastRipplePos = window._matrixLastRipplePos;
      drops.forEach((drop) => {
        ctx.font = `bold ${FONT_SIZE}px monospace`;
        ctx.fillStyle = MATRIX_COLOR;
        // Nueva letra random si llega al fondo o randomiza
        if (drop.y > canvas.height) {
          drop.char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
          drop.y = -FONT_SIZE * Math.random();
          drop.speed = Math.random() * MATRIX_SPEED + 1;
        }
        // --- Corte: no pintar si está dentro del círculo central ---
        const dx = drop.x - cx;
        const dy = drop.y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        // Si la letra está justo en el borde (±cutRadius±FONT_SIZE), dispara ripple
        if (dist > cutRadius) {
          ctx.fillText(drop.char, drop.x, drop.y);
          // Cada letra visible dispara un ripple en su posición, cada frame (simula hover de mouse)
          if (typeof rippleDrop === 'function') {
            // Transformar coordenadas matrix → ripple
            const matrixRect = canvas.getBoundingClientRect();
            const rippleElem = document.getElementById('ripple-water-bg');
            if (rippleElem) {
              const rippleRect = rippleElem.getBoundingClientRect();
              // Coordenadas absolutas en viewport
              const absX = matrixRect.left + drop.x;
              const absY = matrixRect.top + drop.y;
              // Coordenadas relativas al canvas ripple
              let rippleX = absX - rippleRect.left;
              let rippleY = absY - rippleRect.top;
              // Clamp para que nunca sean negativas ni se salgan del canvas
              rippleX = Math.max(0, Math.min(rippleX, rippleRect.width - 1));
              rippleY = Math.max(0, Math.min(rippleY, rippleRect.height - 1));
              // Log para debug visual: posición real de la letra y posición ripple
              console.log('[MatrixLetter]', {
                letra: drop.char,
                col: drop.col,
                drop_x: drop.x,
                drop_y: drop.y,
                absX,
                absY,
                rippleX,
                rippleY,
                matrixRect,
                rippleRect
              });
              rippleDrop(rippleX, rippleY, 14, 0.04, drop.id, 'move');
            }
          }
        }
        drop.y += drop.speed * 1.1;
      });
      animationId = requestAnimationFrame(animate);
    };
    animate();
    const handleResize = () => {
      setCanvasSize();
      drops = [];
      for (let x = 0; x < canvas.width; x += FONT_SIZE) {
        drops.push({
          x,
          y: Math.random() * canvas.height,
          speed: Math.random() * MATRIX_SPEED + 1,
          chars: [],
        });
      }
      dropsRef.current = drops;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [backgroundType, rippleDrop]);

  // Ref para saber si el componente está montado
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (backgroundType !== 'matrix') return;
    let interval = setInterval(() => {
      if (!isMountedRef.current) return;
      if (typeof rippleDrop === 'function') {
        const canvas = matrixCanvasRef.current;
        const rippleElem = document.getElementById('ripple-water-bg');
        if (!canvas || !rippleElem) return;
        const matrixRect = canvas.getBoundingClientRect();
        const rippleRect = rippleElem.getBoundingClientRect();
        const drops = dropsRef.current;
        const cutRadius = cutRadiusRef.current;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        drops.forEach((drop) => {
          const dx = drop.x - cx;
          const dy = drop.y - cy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > cutRadius) {
            const absX = matrixRect.left + drop.x;
            const absY = matrixRect.top + drop.y;
            let rippleX = absX - rippleRect.left;
            let rippleY = absY - rippleRect.top;
            rippleX = Math.max(0, Math.min(rippleX, rippleRect.width - 1));
            rippleY = Math.max(0, Math.min(rippleY, rippleRect.height - 1));
            rippleDrop(rippleX, rippleY, 14, 0.04, drop.id);
          }
        });
      }
    }, 1);
    return () => {
      clearInterval(interval);
    };
  }, [backgroundType, rippleDrop]);

  return (
    <div
      ref={matrixContainerRef}
      className={`flex flex-col items-center justify-center gap-4 relative w-full h-full min-h-[220px] min-w-[220px]`}
      style={{ overflow: 'hidden' }}
    >
      {backgroundType === 'matrix' && (
        <canvas
          ref={matrixCanvasRef}
          className="absolute inset-0 w-full h-full z-[-1]"
        />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center gap-4">
        <VanellixIcon className={`${sizeClass} animate-spin-slow`} />
        {showText && (
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
            {t('spinner.loading')}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;