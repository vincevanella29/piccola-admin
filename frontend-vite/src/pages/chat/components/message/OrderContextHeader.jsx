import React from 'react';
import { Package, UserCircle2, ExternalLink } from 'lucide-react';

const OrderContextHeader = ({ chatState, onClick }) => {
  if (!chatState) return null;
  const orderNumber = chatState.order_number || chatState.orderNumber || '';
  const shortOrderNum = orderNumber.length > 8 ? orderNumber.slice(-8) : orderNumber;
  const customerName = chatState.customer_name || 'Cliente';
  const order = chatState.order;
  
  return (
    <div 
      onClick={onClick}
      className="shrink-0 flex items-center justify-between px-4 py-3 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border-b border-light-border/30 dark:border-dark-border/30 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-10"
    >
      <div className="flex items-center gap-3.5 overflow-hidden">
        <div className="w-10 h-10 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent flex items-center justify-center shrink-0 border border-light-accent/20 dark:border-dark-accent/20 shadow-sm">
          <Package size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-2.5">
            <h4 className="text-[15px] font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight truncate">
              Pedido #{shortOrderNum}
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/40 dark:border-dark-border/40 text-light-text-secondary dark:text-dark-text-secondary text-[10px] font-bold uppercase tracking-wide shrink-0 shadow-sm">
              {chatState.status === 'closed' ? 'CERRADO' : (order?.status_label || 'ACTIVO').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-light-text-secondary dark:text-dark-text-secondary truncate">
            <UserCircle2 size={14} className="shrink-0 opacity-70" />
            <span className="truncate">{customerName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 pl-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-light-surface dark:bg-[#2C2C2E] rounded-full shadow-sm border border-light-border/50 dark:border-white/10 text-[12px] text-light-text-primary dark:text-white font-bold hover:scale-105 active:scale-95 transition-transform">
          <span className="hidden sm:inline">Ver Detalles</span>
          <ExternalLink size={14} className="sm:hidden" />
        </div>
      </div>
    </div>
  );
};

export default OrderContextHeader;
