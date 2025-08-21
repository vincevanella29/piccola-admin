import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LoadingSpinner = ({
  size = 'md',
  showText = true,
  isFullScreen = false,
  rippleDrop,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const animationIdRef = useRef(null);
  const isMobileRef = useRef(window.innerWidth <= 768);

  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const MIN_RIPPLE_INTERVAL = 1;
  const SPEED = isMobileRef.current ? 0.07 : 0.03;

  useEffect(() => {
    const checkMobile = () => {
      isMobileRef.current = window.innerWidth <= 768;
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!rippleDrop || !containerRef.current) return;

    let t = 0;
    let lastRippleTime = 0;
    let lastPos = null;

    const animate = (timestamp) => {
      const rippleElem = document.getElementById('ripple-water-bg');
      if (!rippleElem) {
        animationIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const rippleRect = rippleElem.getBoundingClientRect();
      const width = rippleRect.width;
      const height = rippleRect.height;

      const a = Math.min(width, height) * 0.3;
      const cx = width / 2;
      const cy = height / 2;

      const tMod = t % (2 * Math.PI);
      const sinT = Math.sin(tMod);
      const cosT = Math.cos(tMod);
      const denominator = 1 + sinT * sinT;
      let x = cx + (a * cosT) / denominator;
      let y = cy + (a * sinT * cosT) / denominator;

      x = Math.max(0, Math.min(x, width - 1));
      y = Math.max(0, Math.min(y, height - 1));

      const now = Date.now();
      if (now - lastRippleTime >= MIN_RIPPLE_INTERVAL) {
        const radius = isMobileRef.current ? 6 : 8;
        const perturbance = isMobileRef.current ? 0.04 : 0.06;
        const id = `infinity-${Math.random().toString(36).slice(2)}`;

        if (lastPos) {
          const dx = x - lastPos.x;
          const dy = y - lastPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 20) {
            const midX = lastPos.x + dx * 0.5;
            const midY = lastPos.y + dy * 0.5;
            rippleDrop(midX, midY, radius, perturbance, `mid-${id}`, 'move');
          }
        }

        rippleDrop(x, y, radius, perturbance, id, 'move');
        lastRippleTime = now;
        lastPos = { x, y };
      }

      t += SPEED;
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      lastRippleTime = 0;
      lastPos = null;
    };
    window.addEventListener('resize', handleResize);

    const handleVisibility = () => {
      if (!document.hidden && !animationIdRef.current) {
        lastRippleTime = performance.now();
        lastPos = null;
        animationIdRef.current = requestAnimationFrame(animate);
      } else if (document.hidden && animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [rippleDrop]); // Dependencias limitadas a rippleDrop

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center gap-20 relative w-full h-full min-h-[220px] min-w-[100px] ${
        isFullScreen ? 'fixed inset-0 z-[100]' : ''
      }`}
      style={{ overflow: 'hidden' }}
    >
      {showText && <LoadingBarText text={t('spinner.loading')} />}
    </div>
  );
};

function LoadingBarText({ text }) {
  const letters = (text || '').split('');
  const animationIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    let t = 0;

    const animate = () => {
      if (!mounted) return;
      t += 1;
      const prog = 0.5 + 0.5 * Math.sin(t * 0.02);
      setTimeout(() => {
        if (mounted) {
          document.querySelectorAll('.loading-bar-text').forEach((el, i) => {
            const filled = Math.round(prog * letters.length);
            el.classList.toggle('text-light-accent', i < filled);
            el.classList.toggle('dark:text-dark-accent', i < filled);
            el.classList.toggle('drop-shadow-[0_0_7px_rgba(0,146,70,0.7)]', i < filled);
            el.classList.toggle('text-light-text-secondary', i >= filled);
            el.classList.toggle('dark:text-dark-text-secondary', i >= filled);
            el.classList.toggle('opacity-40', i >= filled);
          });
        }
        animationIdRef.current = requestAnimationFrame(animate);
      }, 16);
    };
    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [letters.length]);

  return (
    <div className="flex flex-row items-center justify-center px-4 py-2 rounded-lg bg-light-surface/80 dark:bg-dark-surface/80 border border-light-accent/30 dark:border-dark-accent/30 shadow-md backdrop-blur-md select-none min-w-[120px]">
      {letters.map((char, i) => (
        <span
          key={i}
          className={`loading-bar-text mx-[1.5px] font-mono text-base md:text-lg font-bold transition-all duration-300 ${
            i < 0
              ? 'text-light-accent dark:text-dark-accent drop-shadow-[0_0_7px_rgba(0,146,70,0.7)]'
              : 'text-light-text-secondary dark:text-dark-text-secondary opacity-40'
          }`}
          style={{
            filter: i < 0 ? 'drop-shadow(0 0 8px #009246cc)' : 'none',
            letterSpacing: '0.03em',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </div>
  );
}

export default LoadingSpinner;