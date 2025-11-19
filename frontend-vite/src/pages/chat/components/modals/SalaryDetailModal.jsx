// src/pages/chat/components/modals/SalaryDetailModal.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Briefcase, MapPin, DollarSign, Calendar, Phone, Flag, Activity, Building2, CreditCard } from 'lucide-react';

const numberFormat = (v) => {
  try {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? '');
    return n.toLocaleString('es-CL');
  } catch {
    return String(v ?? '');
  }
};

export default function SalaryDetailModal({ open, row, onClose }) {
  if (!open) return null;

  // `row` puede venir ya como fila "plana" o como wrapper { row, columns, kpis, intent, meta }
  const payload = row || {};
  const r = payload.row || payload;
  // A veces la data viene directa en r, a veces anidada en r.worker
  const worker = r.worker || {}; 
  const fullName = [worker.nombres, worker.apellidopaterno, worker.apellidomaterno].filter(Boolean).join(' ') || 'Colaborador';
  const avatar = r.profile_image_url || worker.profile_image_url || '';
  const role = r.cargo || worker.cargo || 'Sin cargo';
  const section = r.seccion || worker.seccion || '';

  // Highlight Metric (Líquido)
  const liquidSalary = r.sueldo_liquido_a_pago || r.amount;

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
              className="w-full max-w-lg bg-light-surface dark:bg-dark-surface rounded-[24px] shadow-2xl overflow-hidden pointer-events-auto border border-light-border/40 dark:border-dark-border/40 flex flex-col max-h-[65vh]"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* --- HERO HEADER --- */}
              <div className="relative shrink-0 z-10">
                <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/10 dark:bg-white/10 backdrop-blur-md text-white hover:bg-black/20 transition-colors"
                >
                  <X size={18} />
                </button>

                <div className="flex flex-col items-center pt-8 pb-6 px-6 bg-gradient-to-b from-light-surface-secondary to-light-surface dark:from-dark-surface-secondary dark:to-dark-surface text-center">
                  {/* Avatar Grande */}
                  <div className="relative w-24 h-24 mb-3 rounded-full p-1 bg-light-surface dark:bg-dark-surface-secondary shadow-lg border border-light-border dark:border-dark-border">
                    {avatar ? (
                      <img src={avatar} alt={fullName} className="w-full h-full rounded-full object-cover" onError={(e)=>{e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex';}} />
                    ) : null}
                    <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-400" style={{display: avatar ? 'none' : 'flex'}}>
                       <User size={40} strokeWidth={1.5} />
                    </div>
                    {/* Badge Rut */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-light-surface-secondary/90 dark:bg-dark-surface-secondary/90 text-light-text-primary dark:text-dark-text-primary text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap shadow-sm border border-light-border/60 dark:border-dark-border/60">
                       {r.rut || 'RUT N/A'}
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {fullName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400 font-medium">
                     {section && <span className="uppercase tracking-wide text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10">{section}</span>}
                     <span>{role}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                     <MapPin size={10} />
                     <span>{worker.direccion || 'Sin dirección'} {worker.comuna ? `, ${worker.comuna}` : ''}</span>
                  </div>
                </div>
              </div>

              {/* --- CONTENT AREA --- */}
              <div className="flex-1 overflow-y-auto p-6 pt-2 min-h-0 bg-light-surface dark:bg-dark-surface space-y-6">
                
                {/* 1. FINANCIAL HIGHLIGHT (LIQUIDO) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-light-success/10 to-light-surface dark:from-dark-success/20 dark:to-dark-surface border border-light-success/30 dark:border-dark-success/40 shadow-sm flex items-center justify-between">
                   <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-light-success dark:text-dark-success uppercase tracking-wider mb-1">
                         <DollarSign size={14} /> Líquido a Pago
                      </div>
                      <div className="text-[10px] text-light-success/80 dark:text-dark-success/80">Periodo: {r.periodo}</div>
                   </div>
                   <div className="text-2xl font-bold text-light-success dark:text-dark-success tracking-tight">
                      ${numberFormat(liquidSalary)}
                   </div>
                </div>

                {/* 2. DETALLE REMUNERACIONES */}
                <div className="space-y-3">
                   <SectionHeader icon={Activity} title="Detalle Financiero" />
                   <div className="grid grid-cols-1 gap-2">
                      <InfoRow label="Total Haberes" value={`$${numberFormat(r.remuneracion_total)}`} isBold />
                      <div className="grid grid-cols-2 gap-2">
                         <InfoRow label="Imponible" value={`$${numberFormat(r.remuneracion_imponible)}`} />
                         <InfoRow label="No Imponible" value={`$${numberFormat(r.remuneracion_no_imponible)}`} />
                      </div>
                   </div>
                </div>

                {/* 3. DATOS PREVISIONALES */}
                <div className="space-y-3">
                   <SectionHeader icon={Building2} title="Previsión y Salud" />
                   <div className="grid grid-cols-2 gap-2">
                      <InfoRow label="AFP" value={r.afp} icon={CreditCard} />
                      <InfoRow label="Isapre/Fonasa" value={r.isapre} icon={Activity} />
                   </div>
                </div>

                {/* 4. FICHA PERSONAL */}
                <div className="space-y-3">
                   <SectionHeader icon={User} title="Ficha Personal" />
                   <div className="grid grid-cols-2 gap-2">
                      <InfoRow label="Fecha Nacimiento" value={worker.fechanacimiento} icon={Calendar} />
                      <InfoRow label="Nacionalidad" value={worker.nacionalidad} icon={Flag} />
                      <InfoRow label="Teléfono" value={worker.telefonouno} icon={Phone} />
                      <InfoRow label="Sigla Local" value={r.sigla} icon={Building2} />
                   </div>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- SUB-COMPONENTES ---

const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-dark-border/40">
     <Icon size={14} className="text-light-accent dark:text-dark-accent" />
     <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{title}</span>
  </div>
);

const InfoRow = ({ label, value, icon: Icon, isBold = false }) => (
  <div className="flex flex-col p-2.5 rounded-xl bg-gray-50 dark:bg-dark-surface-secondary border border-gray-100 dark:border-dark-border/40">
    <div className="flex items-center gap-1.5 mb-1">
       {Icon && <Icon size={10} className="text-gray-400" />}
       <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
    </div>
    <div className={`text-sm ${isBold ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'} truncate`}>
       {value || '—'}
    </div>
  </div>
);