// src/pages/chat/components/modals/SalaryDetailModal.jsx
import React from 'react';

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
  const r = row || {};
  const worker = r.worker || {};
  const fullName = [worker.nombres, worker.apellidopaterno, worker.apellidomaterno].filter(Boolean).join(' ') || '';
  const avatar = r.profile_image_url || worker.profile_image_url || '';

  const infoRows = [
    { label: 'Periodo', value: r.periodo },
    { label: 'Sigla', value: r.sigla },
    { label: 'RUT', value: r.rut },
    { label: 'Sección', value: r.seccion },
    { label: 'Cargo', value: r.cargo },
    { label: 'Sexo', value: r.sexo },
    { label: 'AFP', value: r.afp },
    { label: 'Isapre', value: r.isapre },
  ];

  const moneyRows = [
    { label: 'Imponible', value: r.remuneracion_imponible, money: true },
    { label: 'No imponible', value: r.remuneracion_no_imponible, money: true },
    { label: 'Total Rem.', value: r.remuneracion_total, money: true },
    { label: 'Líquido', value: r.sueldo_liquido_a_pago, money: true },
    { label: 'Monto', value: r.amount, money: true },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-dark-surface rounded-md shadow-xl max-w-lg w-[92%] p-4">
        <div className="flex items-start gap-3 mb-3">
          {avatar ? (
            <img src={avatar} alt={fullName || 'Trabajador'} className="w-16 h-16 rounded-full object-cover" onError={(e)=>{e.currentTarget.style.display='none';}} />
          ) : (
            <div className="w-16 h-16 rounded-full bg-light-surface/60 dark:bg-dark-surface/60" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold truncate">{fullName || `RUT ${r.rut || ''}`}</h3>
            <p className="text-xs opacity-75 truncate">{worker.direccion || ''}{worker.comuna ? `, ${worker.comuna}` : ''}{worker.ciudad ? `, ${worker.ciudad}` : ''}</p>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded border border-light-surface/60 dark:border-dark-surface/60 hover:bg-light-surface/40 dark:hover:bg-dark-surface/40">Cerrar</button>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {infoRows.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-light-surface/30 dark:border-dark-surface/30 py-1">
              <span className="opacity-70">{it.label}</span>
              <span className="font-medium">{String(it.value ?? '')}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {moneyRows.map((it, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-light-surface/30 dark:border-dark-surface/30 py-1">
              <span className="opacity-70">{it.label}</span>
              <span className="font-semibold">{it.money ? `$${numberFormat(it.value)}` : String(it.value ?? '')}</span>
            </div>
          ))}
        </div>

        {/* Extra worker info */}
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Ficha trabajador</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center justify-between py-1"><span className="opacity-70">Fecha nac.</span><span className="font-medium">{worker.fechanacimiento || ''}</span></div>
            <div className="flex items-center justify-between py-1"><span className="opacity-70">Nacionalidad</span><span className="font-medium">{worker.nacionalidad || ''}</span></div>
            <div className="flex items-center justify-between py-1"><span className="opacity-70">Teléfono 1</span><span className="font-medium">{worker.telefonouno || ''}</span></div>
            <div className="flex items-center justify-between py-1"><span className="opacity-70">Teléfono 2</span><span className="font-medium">{worker.telefonodos || ''}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
