// src/pages/employees_register/components/tabs/AsistenciaPanel.jsx
import React, { useState } from 'react';
import { Calendar, ListChecks } from 'lucide-react';
import AsistenciaModal from './AsistenciaModal';
import { AnimatePresence } from 'framer-motion';

// Recibe los KPIs iniciales para no tener que cargarlos de nuevo si ya existen
export default function AsistenciaPanel({ initialKpis, isLoading, fetchAsistenciaKpis }) {
  const [asistenciaModalOpen, setAsistenciaModalOpen] = useState(false);

  return (
    <>
      <section className="bg-dark-surface-secondary/40 border border-dark-border/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4"><ListChecks size={24} className="text-matrix-green"/><h2 className="text-xl font-bold">Control de Asistencia</h2></div>
        <p className="text-dark-text-secondary text-sm mb-6">Revisa tu historial de asistencia completo y filtra por el rango de períodos que necesites.</p>
        <button
          onClick={() => setAsistenciaModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-matrix-green hover:opacity-90 transition-opacity"
        >
          <Calendar size={18} />
          Ver Historial de Asistencia
        </button>
      </section>
      <AnimatePresence>
        {asistenciaModalOpen && (
          <AsistenciaModal
            onClose={() => setAsistenciaModalOpen(false)}
            initialKpis={initialKpis}
            fetchAsistenciaKpis={fetchAsistenciaKpis}
          />
        )}
      </AnimatePresence>
    </>
  );
}