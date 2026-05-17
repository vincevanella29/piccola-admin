import React from 'react';
import { Package, UserCircle2 } from 'lucide-react';

const OrderContextHeader = ({ chatState, onClick }) => {
  if (!chatState) return null;
  const orderNumber = chatState.order_number || chatState.orderNumber || '';
  const shortOrderNum = orderNumber.length > 8 ? orderNumber.slice(-8) : orderNumber;
  const customerName = chatState.customer_name || 'Cliente';
  const order = chatState.order;
  
  return (
    <div 
      onClick={onClick}
      className="shrink-0 flex items-center justify-between px-4 py-3 bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-md border-b border-light-border/50 dark:border-dark-border/50 shadow-sm cursor-pointer hover:bg-light-surface-secondary/80 dark:hover:bg-dark-surface-secondary/80 transition-all z-10"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 rounded-xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/20 shrink-0">
          <Package size={20} />
        </div>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-light-text-primary dark:text-dark-text-primary uppercase truncate">
              #{shortOrderNum}
            </h4>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
              {chatState.status === 'closed' ? 'CERRADO' : (order?.status_label || 'ACTIVO').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5 truncate">
            <UserCircle2 size={12} className="shrink-0" />
            <span className="truncate">{customerName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg border border-light-border dark:border-dark-border text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
          <span className="hidden md:inline">Ver Detalles</span>
          <span className="text-[10px] opacity-60 ml-1">⌘+I</span>
        </div>
      </div>
    </div>
  );
};

export default OrderContextHeader;
