import React from 'react';
import { Wallet as WalletIcon } from 'lucide-react';
import { Td } from './TableParts.jsx';
import { SEG_ORDER, fmtNum } from './kpiConfig.jsx';

export default function MeritsRow({ emp, mode, getDisplayFor, onClickRow }) {
  const disp = getDisplayFor(emp, mode);
  const bySym = Object.fromEntries((disp.rows || []).map(r => [r.symbol, Math.floor(r.points || 0)]));
  const total = Math.floor(disp.total || 0);

  // Para tooltips compactos: desglose wallet vs pending cuando está en Simulado
  const walletBy = emp.__merit?.walletBySegment || {};
  const pendingBy = emp.__merit?.pendingBySegment || {};

  return (
    <tr
      className="border-t border-dark-border/10 hover:bg-dark-surface-secondary cursor-pointer group"
      onClick={onClickRow}
    >
      {/* # Emp */}
      <Td align="center" className="font-bold w-16" title={`Puesto empresa: ${emp.puesto_empresa ?? '—'}`}>
        {emp.puesto_empresa ?? '-'}
      </Td>

      {/* Colaborador */}
      <Td>
        <div className="flex items-start gap-4">
          <img
            src={emp.profile_image_url || 'https://via.placeholder.com/40'}
            alt={`${emp.nombre} ${emp.apellido}`}
            className="w-10 h-10 rounded-full object-cover mt-1"
          />
          <div className="flex-grow">
            <p className="font-semibold text-dark-text-primary group-hover:text-matrix-green transition-colors">
              {emp.nombre || 'N/A'} {emp.apellido}
            </p>
            <p className="text-xs text-dark-text-secondary">
              {emp.cargo} en <span className="font-semibold">{emp.local}</span>
            </p>
          </div>
        </div>
      </Td>

      {/* Columnas por segmento */}
      {SEG_ORDER.map((sym) => {
        const w = Number(walletBy[sym] || 0);
        const p = Number(pendingBy[sym] || 0);
        const val = bySym[sym] || 0;
        const title = mode === 'simulated'
          ? `${sym}: ${fmtNum.format(val)} pts (wallet ${fmtNum.format(w)} + pending ${fmtNum.format(p)})`
          : `${sym}: ${fmtNum.format(val)} pts (wallet)`;
        return (
          <Td key={`seg-${emp.rut}-${sym}`} align="right" className="font-mono" title={title}>
            {fmtNum.format(val)}
          </Td>
        );
      })}

      {/* Total */}
      <Td align="right" className="font-mono" title={`Total de puntos (${mode === 'simulated' ? 'Simulado' : 'Wallet'})`}>
        {fmtNum.format(total)}
      </Td>

      {/* Wallet */}
      <Td align="center" className="w-20" title={emp.wallet || emp.merit_profile?.wallet ? 'Tiene wallet' : 'Sin wallet'}>
        {emp.wallet || emp.merit_profile?.wallet
          ? <WalletIcon size={18} className="text-matrix-green mx-auto" />
          : <span className="text-xs text-dark-text-secondary">—</span>
        }
      </Td>
    </tr>
  );
}
