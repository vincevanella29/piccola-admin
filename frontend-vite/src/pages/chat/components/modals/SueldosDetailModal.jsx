// src/pages/chat/components/modals/SueldosDetailModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, FileText, AlertCircle } from 'lucide-react';
import DataTable from '../common/DataTable';

export default function SueldosDetailModal({ open, onClose, payload }) {
  if (!open) return null;

  const title = payload?.title || 'Detalle de Sueldos';
  const columns = payload?.columns || [];
  const rows = payload?.rows || [];
  const kpis = payload?.kpis || [];
  const totals = payload?.totals || null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              // Clases semánticas puras:
              className="w-full max-w-6xl bg-light-surface dark:bg-dark-surface rounded-[24px] shadow-modal overflow-hidden pointer-events-auto border border-light-border dark:border-dark-border flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* --- HEADER --- */}
              <div className="flex items-center justify-between p-5 border-b border-light-border dark:border-dark-border bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20">
                      <DollarSign size={20} />
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">{title}</h3>
                      <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium uppercase tracking-wide">
                        Reporte Financiero
                      </span>
                   </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* --- CONTENT AREA --- */}
              <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-light-surface/50 dark:bg-dark-surface/50 scrollbar-thin scrollbar-thumb-light-border dark:scrollbar-thumb-dark-border">
                
                {Array.isArray(rows) && rows.length > 0 ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Renderizamos la DataTable existente */}
                    {/* Nota: Le pasamos null a title/subtitle porque ya los manejamos en el header del modal para que se vea integrado */}
                    <DataTable
                      title={null}
                      subtitle={null}
                      kpis={kpis}
                      columns={columns}
                      rows={rows}
                      totals={totals}
                      charts={null}
                      compact={false} // Expandido por defecto en modal grande
                      pageSize={50}   // Más filas por página al ser modal dedicado
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-light-text-tertiary dark:text-dark-text-secondary opacity-70">
                    <div className="p-4 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary mb-3">
                        <FileText size={40} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-medium">No hay datos de sueldos disponibles para este criterio.</p>
                  </div>
                )}
                
                {/* Footer Informativo Opcional */}
                <div className="mt-6 flex items-start gap-2 p-3 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50">
                    <AlertCircle size={16} className="text-light-text-secondary dark:text-dark-text-secondary mt-0.5 shrink-0" />
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                        La información mostrada corresponde a los registros procesados del periodo. Los montos son referenciales y deben ser validados con las liquidaciones oficiales.
                    </p>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}