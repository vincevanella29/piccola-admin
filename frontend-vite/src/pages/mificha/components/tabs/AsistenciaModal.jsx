// src/pages/employees_register/components/AsistenciaModal.jsx
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoaderCircle, Calendar, X } from 'lucide-react';


const MonthAttendanceCard = ({ monthData, index }) => {
  const { dias_trabajados, dias_habiles, asistencia_perfecta, mes } = monthData;
  const percentage = dias_habiles > 0 ? Math.round((dias_trabajados / dias_habiles) * 100) : 0;
  const isPerfect = asistencia_perfecta;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="flex-shrink-0 w-64 bg-dark-surface rounded-lg border border-dark-border/20 overflow-hidden shadow-lg"
    >
      <div className="p-4">
        <h4 className="font-semibold text-white text-center mb-2">{mes}</h4>
        <div className="w-full bg-dark-surface-secondary rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all duration-300 ${isPerfect ? 'bg-matrix-green' : 'bg-rose-500'}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <div className="text-center space-y-1">
          <div className="flex justify-between text-xs text-dark-text-secondary">
            <span>Días Trabajados</span><span>{dias_trabajados}</span>
          </div>
          <div className="flex justify-between text-xs text-dark-text-secondary">
            <span>Días Hábiles</span><span>{dias_habiles}</span>
          </div>
          <div className={`text-sm font-semibold ${isPerfect ? 'text-matrix-green' : 'text-rose-400'}`}>
            {isPerfect ? '¡Perfecta! 🎉' : `${percentage}%`}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function AsistenciaModal({ onClose, appState, fetchAsistenciaKpis }) {
  const [startPeriodo, setStartPeriodo] = useState('202501');
  const [endPeriodo, setEndPeriodo] = useState('202509');
  const [asistencia, setAsistencia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAsistencia(null);

    try {
      const data = await fetchAsistenciaKpis({ startPeriodo, endPeriodo });
      setAsistencia(data?.kpis || []);
    } catch (err) {
      setError(err.message || 'Error al buscar asistencia');
    } finally {
      setLoading(false);
    }
  }, [startPeriodo, endPeriodo]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="w-full max-w-4xl rounded-2xl bg-dark-surface border border-dark-border/20 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-dark-border/20">
          <h3 className="text-lg font-semibold">Historial de Asistencia</h3>
          <button className="p-1 rounded-full hover:bg-dark-surface-secondary" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-6 space-y-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-end gap-4 p-4 bg-dark-surface-secondary/40 rounded-lg">
            <div className="w-full"><label className="text-xs text-dark-text-secondary">Desde (YYYYMM)</label><input type="number" placeholder="202501" value={startPeriodo} onChange={e => setStartPeriodo(e.target.value)} className="w-full bg-dark-surface border border-dark-border/20 rounded-lg p-2 mt-1" /></div>
            <div className="w-full"><label className="text-xs text-dark-text-secondary">Hasta (YYYYMM)</label><input type="number" placeholder="202508" value={endPeriodo} onChange={e => setEndPeriodo(e.target.value)} className="w-full bg-dark-surface border border-dark-border/20 rounded-lg p-2 mt-1" /></div>
            <button type="submit" disabled={loading} className="w-full sm:w-auto flex-shrink-0 h-11 px-5 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 transition-opacity disabled:opacity-50">Buscar</button>
          </form>
          <div className="h-[200px] flex items-center">
            {loading && <div className="w-full flex justify-center"><LoaderCircle className="animate-spin text-matrix-green"/></div>}
            {error && <p className="w-full text-rose-400 text-center">{error}</p>}
            <AnimatePresence>
              {asistencia && (
                <div className="flex gap-4 overflow-x-auto pb-4 w-full">
                  {asistencia.map((month, index) => <MonthAttendanceCard key={month.mes} monthData={month} index={index} />)}
                </div>
              )}
            </AnimatePresence>
            {!asistencia && !loading && !error && (<div className="text-center w-full text-dark-text-secondary space-y-2"><Calendar size={32} className="mx-auto"/><p>Selecciona un rango de períodos para ver tu progreso.</p></div>)}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}