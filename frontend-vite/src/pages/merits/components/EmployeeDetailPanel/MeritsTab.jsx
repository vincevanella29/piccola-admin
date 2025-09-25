// src/pages/merits/components/EmployeeDetailPanel/MeritsTab.jsx
import React from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { MeritSegmentRow } from './ui/MeritSegmentRow';
import useMeritSystem from '../../../../hooks/useMeritSystem';

export const MeritsTab = ({ employee }) => {
  const { SEGMENT_ICONS, getSegmentIcon } = useMeritSystem();
  const walletData = employee.__merit.walletBySegment;
  const pendingData = employee.__merit.pendingBySegment;
  const allSymbols = [...new Set([...Object.keys(walletData), ...Object.keys(pendingData)])].sort();

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-6">
      {employee.wallet ? (
        <div>
          <h4 className="font-semibold mb-2">Billetera Conectada</h4>
          <div className="flex items-center justify-between p-3 rounded-lg bg-dark-surface-secondary font-mono text-sm text-dark-text-secondary">
            <span className="truncate">{employee.wallet}</span>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <button onClick={() => copyToClipboard(employee.wallet)} className="p-1.5 hover:text-matrix-green transition-colors"><Copy size={16}/></button>
              <a href={`https://amoy.polygonscan.com/address/${employee.wallet}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:text-matrix-green transition-colors"><ExternalLink size={16}/></a>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 text-center rounded-lg bg-dark-surface-secondary text-dark-text-secondary text-sm">
          Este colaborador aún no ha conectado su billetera.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Columna: En Wallet */}
        <div className="space-y-3">
          <h4 className="font-semibold text-lg">En Wallet ({employee.__merit.walletTotal.toFixed(0)} Puntos)</h4>
          <div className="space-y-2">
            {allSymbols.map(symbol => (
              <MeritSegmentRow 
                key={symbol}
                icon={getSegmentIcon(symbol)}
                symbol={symbol}
                points={walletData[symbol] || 0}
              />
            ))}
          </div>
        </div>

        {/* Columna: Pendientes */}
        <div className="space-y-3">
          <h4 className="font-semibold text-lg">Pendiente de Mintear ({employee.__merit.pendingTotal} Puntos)</h4>
          <div className="space-y-2">
            {allSymbols.map(symbol => (
               <MeritSegmentRow 
                key={symbol}
                icon={getSegmentIcon(symbol)}
                symbol={symbol}
                points={pendingData[symbol] || 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};