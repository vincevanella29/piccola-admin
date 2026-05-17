import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PiccolaFavicon from './PiccolaFavicon';

/**
 * LoadingSpinner — Premium Brand-Centric Spinner.
 *
 * Replaces the CSS Pizza with a high-end Apple-style orbital loading
 * animation focused around the La Piccola Italia brand logo.
 */

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
  const [phase, setPhase] = useState('enter'); // enter → idle

  const MIN_RIPPLE_INTERVAL = 1;
  const SPEED = isMobileRef.current ? 0.07 : 0.03;

  // Entrance
  useEffect(() => {
    const timer = setTimeout(() => setPhase('idle'), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => { isMobileRef.current = window.innerWidth <= 768; };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Ripple animation (existing behavior preserved)
  useEffect(() => {
    if (!rippleDrop || !containerRef.current) return;
    let t = 0, lastRippleTime = 0, lastPos = null;
    const animate = () => {
      const rippleElem = document.getElementById('ripple-water-bg');
      if (!rippleElem) { animationIdRef.current = requestAnimationFrame(animate); return; }
      const r = rippleElem.getBoundingClientRect();
      const w = r.width, h = r.height, a = Math.min(w, h) * 0.3, cx = w / 2, cy = h / 2;
      const tMod = t % (2 * Math.PI), sT = Math.sin(tMod), cT = Math.cos(tMod), d = 1 + sT * sT;
      let x = Math.max(0, Math.min(cx + (a * cT) / d, w - 1));
      let y = Math.max(0, Math.min(cy + (a * sT * cT) / d, h - 1));
      const now = Date.now();
      if (now - lastRippleTime >= MIN_RIPPLE_INTERVAL) {
        const rad = isMobileRef.current ? 6 : 8, pert = isMobileRef.current ? 0.04 : 0.06;
        const id = `inf-${Math.random().toString(36).slice(2)}`;
        if (lastPos) {
          const dx = x - lastPos.x, dy = y - lastPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > 20) rippleDrop(lastPos.x + dx * .5, lastPos.y + dy * .5, rad, pert, `m-${id}`, 'move');
        }
        rippleDrop(x, y, rad, pert, id, 'move');
        lastRippleTime = now; lastPos = { x, y };
      }
      t += SPEED;
      animationIdRef.current = requestAnimationFrame(animate);
    };
    animationIdRef.current = requestAnimationFrame(animate);
    const handleResize = () => { lastRippleTime = 0; lastPos = null; };
    window.addEventListener('resize', handleResize);
    const handleVis = () => {
      if (!document.hidden && !animationIdRef.current) { lastRippleTime = performance.now(); lastPos = null; animationIdRef.current = requestAnimationFrame(animate); }
      else if (document.hidden && animationIdRef.current) { cancelAnimationFrame(animationIdRef.current); animationIdRef.current = null; }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVis);
      if (animationIdRef.current) { cancelAnimationFrame(animationIdRef.current); animationIdRef.current = null; }
    };
  }, [rippleDrop]);

  const sizes = {
    sm: { container: 80, logo: 40 },
    md: { container: 120, logo: 60 },
    lg: { container: 160, logo: 80 },
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center justify-center gap-8 relative w-full h-full min-h-[220px] ${isFullScreen ? 'fixed inset-0 z-[100]' : ''}`}
    >
      <div
        className="relative flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          width: currentSize.container,
          height: currentSize.container,
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.8) translateY(10px)' : 'scale(1) translateY(0)',
        }}
      >
        {/* Glow aura */}
        <div
          className="absolute rounded-full"
          style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(222,20,29,0.15) 0%, transparent 70%)',
            animation: 'auraPulse 2s ease-in-out infinite',
            filter: 'blur(8px)',
          }}
        />

        {/* Outer Orbital Ring */}
        <div
          className="absolute inset-0 rounded-full border border-light-border/30 dark:border-dark-border/30"
          style={{
            borderTopColor: '#DE141D',
            animation: 'spin 2s linear infinite',
          }}
        />

        {/* Inner Orbital Ring */}
        <div
          className="absolute rounded-full border border-light-border/20 dark:border-dark-border/20"
          style={{
            inset: '8px',
            borderBottomColor: '#FFD700',
            animation: 'spinReverse 3s linear infinite',
          }}
        />

        {/* Center Logo with Pulse */}
        <div
          className="relative z-10 rounded-full bg-light-surface/50 dark:bg-dark-surface/50 backdrop-blur-sm border border-light-border/50 dark:border-dark-border/50 shadow-lg flex items-center justify-center overflow-hidden"
          style={{
            width: currentSize.container - 32,
            height: currentSize.container - 32,
            animation: 'logoPulse 2.5s ease-in-out infinite',
          }}
        >
          <PiccolaFavicon
            className="object-contain"
            style={{
              width: currentSize.logo,
              height: currentSize.logo
            }}
          />
        </div>

        {/* Floor shadow */}
        <div className="absolute" style={{
          width: '60%', height: 12, bottom: -20,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%)',
          animation: 'shadowPulse 2.5s ease-in-out infinite',
        }} />
      </div>

      {/* Premium text */}
      {showText && (
        <div
          style={{
            opacity: phase === 'enter' ? 0 : 1,
            transform: phase === 'enter' ? 'translateY(5px)' : 'translateY(0)',
            transition: 'all 0.5s ease-out 0.2s',
          }}
        >
          <ShimmerText text={t('spinner.loading', 'Preparando tu pedido...')} />
        </div>
      )}

      <style>{KEYFRAMES}</style>
    </div>
  );
};

const ShimmerText = ({ text }) => (
  <div className="flex flex-col items-center gap-2.5">
    <span
      className="text-[11px] sm:text-xs font-black tracking-[0.2em] uppercase select-none"
      style={{
        background: 'linear-gradient(90deg, #999 0%, #DE141D 20%, #FFD700 50%, #DE141D 80%, #999 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmer 2.5s linear infinite',
      }}
    >
      {text}
    </span>
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 3 + (i === 2 ? 1 : 0), height: 3 + (i === 2 ? 1 : 0),
            background: i === 2 ? '#DE141D' : 'rgba(222,20,29,0.4)',
            animation: 'dotBounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  </div>
);

const KEYFRAMES = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes spinReverse {
    0% { transform: rotate(360deg); }
    100% { transform: rotate(0deg); }
  }
  @keyframes logoPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes shadowPulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(0.8); opacity: 0.3; }
  }
  @keyframes auraPulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.15); opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes dotBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1.4); opacity: 1; }
  }
`;

export default LoadingSpinner;