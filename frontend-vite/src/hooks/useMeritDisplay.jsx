// src/hooks/useMeritDisplay.jsx
import { useMemo } from 'react';
import useMeritSystem from './useMeritSystem.jsx';

// Suma puntos pendientes (no minteados) del historial
function sumPendingBySegment(merits_history = []) {
  const acc = {};
  for (const m of merits_history) {
    if (m?.is_minted === false && m?.segment?.symbol) {
      const sym = m.segment.symbol;
      acc[sym] = (acc[sym] || 0) + Number(m.merit_points || 0);
    }
  }
  return acc;
}

// Suma puntos del perfil de méritos (lo que está en la wallet)
function sumWalletBySegment(segments = [], toPoints) {
  const acc = {};
  for (const s of segments) {
    if (s?.symbol) {
      const pts = toPoints(s.balance);
      if (pts > 0) acc[s.symbol] = (acc[s.symbol] || 0) + pts;
    }
  }
  return acc;
}

export default function useMeritDisplay(employees = []) {
  const { toPoints, getSegmentIcon, getLevelForScore } = useMeritSystem();

  const enrichedEmployees = useMemo(() => {
    return (employees || []).map(e => {
      const pendingMap = sumPendingBySegment(e.merits_history);
      const walletMap = sumWalletBySegment(e.merit_profile?.segments, toPoints);
      
      const walletTotal = Object.values(walletMap).reduce((sum, pts) => sum + pts, 0);
      const pendingTotal = Object.values(pendingMap).reduce((sum, pts) => sum + pts, 0);

      // Agregamos un objeto `__merit` con todo pre-calculado
      return {
        ...e,
        __merit: {
          walletBySegment: walletMap,
          pendingBySegment: pendingMap,
          walletTotal,
          pendingTotal,
          simulatedTotal: walletTotal + pendingTotal,
        },
      };
    });
  }, [employees, toPoints]);

  // Función para obtener los datos a mostrar según el modo (wallet vs. simulado)
  const getDisplayFor = (emp, mode = 'wallet') => {
    const data = emp?.__merit || {};
    const allSymbols = [...new Set([
      ...Object.keys(data.walletBySegment || {}),
      ...Object.keys(data.pendingBySegment || {})
    ])];

    const rows = allSymbols.map(symbol => {
      const walletPts = data.walletBySegment?.[symbol] || 0;
      const pendingPts = data.pendingBySegment?.[symbol] || 0;
      const points = mode === 'wallet' ? walletPts : walletPts + pendingPts;
      return { symbol, points };
    });

    const total = mode === 'wallet' ? data.walletTotal : data.simulatedTotal;
    return { total, rows };
  };

  return {
    enrichedEmployees,
    getDisplayFor,
    getSegmentIcon,
    getLevelForScore,
  };
}