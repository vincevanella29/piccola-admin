import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import $ from 'jquery';
if (typeof window !== 'undefined') window.$ = $;
import 'jquery.ripples';

const FullScreenRipple = forwardRef(({ theme }, ref) => {
  const canvasRef = useRef(null);
  const lastMatrixDrop = useRef({});

  useImperativeHandle(ref, () => ({
    dropRipple: (x, y, radius = 6, perturbance = 0.008, _id = undefined, mode = 'move') => {
      const now = Date.now();
      const key = _id || 'random';
      const MIN_DIST = 2;
      const DROP_THROTTLE_MS = 6;
      const last = lastMatrixDrop.current[key] || { x: null, y: null, t: 0 };
      const dist = Math.abs(x - last.x) + Math.abs(y - last.y);
      if (last.x === null || now - last.t > DROP_THROTTLE_MS || dist > MIN_DIST) {
        lastMatrixDrop.current[key] = { x, y, t: now };
        const $ripple = canvasRef.current && window.$ && window.$(canvasRef.current);
        if ($ripple && $ripple.data('ripples')) {
          if (mode === 'move') {
            try {
              $ripple.ripples('move', x, y, radius, perturbance);
              return;
            } catch (e) {}
          }
          $ripple.ripples('drop', x, y, radius, perturbance);
        }
      }
    },
  }), []);

  useEffect(() => {
    if (canvasRef.current && $(canvasRef.current).data('ripples')) {
      try {
        $(canvasRef.current).ripples('destroy');
      } catch (e) {}
    }
    let cleanup = null;
    try {
      $(canvasRef.current).ripples({
        resolution: 768, // Aumentado para ondas más suaves
        dropRadius: 22,
        perturbance: 0.04,
        interactive: false,
        color: theme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(37,99,235,0.25)', // Colores más sutiles
      });

      let lastTouch = 0;
      let lastDropTime = 0;
      let lastPos = { x: null, y: null };
      const DROP_THROTTLE_MS = 12;
      const MIN_DIST = 3;
      const DROP_RADIUS = 22;
      const DROP_PERTURB = 0.04;

      const dropRipple = (e, force = false) => {
        if (!canvasRef.current || !$(canvasRef.current).data('ripples')) return;
        const rect = canvasRef.current.getBoundingClientRect();
        let x = 0, y = 0;
        if (e.touches && e.touches.length > 0) {
          x = e.touches[0].clientX;
          y = e.touches[0].clientY;
        } else {
          x = e.clientX;
          y = e.clientY;
        }
        x = x - rect.left;
        y = y - rect.top;
        if (
          force ||
          lastPos.x === null ||
          Math.abs(x - lastPos.x) > MIN_DIST ||
          Math.abs(y - lastPos.y) > MIN_DIST
        ) {
          $(canvasRef.current).ripples('drop', x, y, DROP_RADIUS, DROP_PERTURB);
          lastPos = { x, y };
        }
      };

      const pointerDown = (e) => {
        if (e.pointerType !== 'touch') {
          lastPos = { x: null, y: null };
          dropRipple(e, true);
        }
      };
      const pointerMove = (e) => {
        if (e.pointerType === 'mouse') {
          dropRipple(e);
        }
      };

      window.addEventListener('pointerdown', pointerDown);
      window.addEventListener('pointermove', pointerMove);

      const touchStart = (e) => {
        lastTouch = Date.now();
        lastPos = { x: null, y: null };
        dropRipple(e, true);
      };
      const touchMove = (e) => {
        const now = Date.now();
        if (now - lastDropTime > DROP_THROTTLE_MS) {
          dropRipple(e);
          lastDropTime = now;
        }
      };
      window.addEventListener('touchstart', touchStart, { passive: true });
      window.addEventListener('touchmove', touchMove, { passive: true });

      cleanup = () => {
        window.removeEventListener('pointerdown', pointerDown);
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('touchstart', touchStart);
        window.removeEventListener('touchmove', touchMove);
        try {
          $(canvasRef.current).ripples('destroy');
        } catch (e) {
          console.warn('Error al destruir ripples:', e);
        }
      };
    } catch (e) {
      console.error('Error al inicializar ripples:', e);
    }
    return cleanup;
  }, [theme]);

  return (
    <div
      ref={canvasRef}
      id="ripple-water-bg"
      className="fixed inset-0 w-[100vw] h-[100vh] pointer-events-auto select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
});

export default FullScreenRipple;