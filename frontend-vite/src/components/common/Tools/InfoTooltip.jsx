import React, { useRef, useState, useEffect } from 'react';

export default function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [style, setStyle] = useState({});
  const tooltipRef = useRef(null);
  const btnRef = useRef(null);

  // Cierra el tooltip si se hace scroll o se toca fuera
  useEffect(() => {
    if (!show) return;
    const handleScroll = () => setShow(false);
    const handleClick = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target) && tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setShow(false);
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('touchstart', handleClick, true);
    window.addEventListener('mousedown', handleClick, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('touchstart', handleClick, true);
      window.removeEventListener('mousedown', handleClick, true);
    };
  }, [show]);

  // Ajusta la posición del tooltip para que nunca se salga de la pantalla
  useEffect(() => {
    if (!show || !tooltipRef.current || !btnRef.current) return;
    const tooltip = tooltipRef.current;
    const btn = btnRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = btnRect.left + btnRect.width / 2 - tooltipRect.width / 2;
    let top = btnRect.bottom + 8; // 8px gap
    let transform = '';
    // Si se sale por la derecha
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    // Si se sale por la izquierda
    if (left < 8) {
      left = 8;
    }
    // Si no cabe abajo, lo ponemos arriba
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = btnRect.top - tooltipRect.height - 8;
      if (top < 8) top = 8;
    }
    setStyle({
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 99999,
      maxWidth: '90vw',
      width: 'min(256px, 90vw)',
      pointerEvents: 'none',
      transition: 'opacity 0.2s',
    });
  }, [show]);

  // Soporte para touch/click
  const handleShow = (e) => {
    e.stopPropagation();
    setShow((s) => !s);
  };

  return (
    <span className="inline-block">
      <button
        ref={btnRef}
        type="button"
        className="w-5 h-5 flex items-center justify-center rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent text-xs font-bold focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-all"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={handleShow}
        onClick={handleShow}
        tabIndex={0}
        aria-label="Info"
      >
        i
      </button>
      {show && (
        <div
          ref={tooltipRef}
          style={style}
          className="rounded-lg bg-light-surface dark:bg-dark-surface text-xs text-light-text-primary dark:text-dark-text-primary shadow-xl border border-light-border dark:border-dark-border px-3 py-2 animate-fade-in"
        >
          {text}
        </div>
      )}
    </span>
  );
}
