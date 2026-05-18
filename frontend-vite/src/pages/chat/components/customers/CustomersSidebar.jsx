// src/pages/chat/components/customers/CustomersSidebar.jsx
import React from 'react';

const CustomersSidebar = ({
  items = [],
  scopeFilter = 'all',
  onChangeScope,
  onOpen,
  activeConversation,
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-light-surface/50 dark:bg-dark-surface/50 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm relative">
      <div className="sticky top-0 px-4 py-3 backdrop-blur-xl bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/20 dark:border-dark-border/20 z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">👥 Customers</h3>
        </div>
        <div className="flex gap-2">
          {['all', 'delivery', 'whatsapp'].map((s) => (
            <button
              key={s}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                scopeFilter === s 
                ? 'bg-light-accent/10 text-light-accent dark:text-dark-accent border border-light-accent/30 dark:border-dark-accent/30' 
                : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-secondary dark:text-dark-text-secondary border border-transparent hover:bg-light-border/20 dark:hover:bg-dark-border/20'
              }`}
              onClick={() => onChangeScope?.(s)}
            >
              {s === 'all' ? 'Todos' : s === 'delivery' ? 'Delivery 🍕' : 'WhatsApp 📱'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-auto overflow-x-hidden scrollbar-none pb-2">
        {items.length === 0 && (
          <div className="text-[13px] font-medium opacity-60 px-4 pt-6 text-center">Sin conversaciones</div>
        )}
        <div className="flex flex-col">
          {items.map((it) => (
            <CustomerRow
              key={`${it.provider}_${it.id}`}
              item={it}
              isActive={activeConversation?.id === it.id && activeConversation?.provider === it.provider}
              onOpen={onOpen}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const CustomerRow = ({ item, isActive, onOpen }) => {
  const isDelivery = item.provider === 'delivery';
  
  // Badges and Styling
  const badgeCls = isDelivery
    ? (item.mode === 'human' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20')
    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'; // WhatsApp badge
    
  const badgeText = isDelivery
    ? (item.mode === 'human' ? '👤 Human' : '🤖 Bot')
    : '📱 WhatsApp';

  const avatarColors = isDelivery
    ? 'from-orange-500/20 to-red-500/20 text-orange-600 border-orange-500/30'
    : 'from-emerald-500/20 to-green-500/20 text-emerald-600 border-emerald-500/30';

  return (
    <button
      onClick={() => onOpen?.(item.provider, item.id)}
      className={`relative w-full text-left px-4 py-3 transition-colors ${
        isActive 
        ? (isDelivery ? 'bg-orange-500/10 dark:bg-orange-500/10' : 'bg-emerald-500/10 dark:bg-emerald-500/10') 
        : 'hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40'
      }`}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Avatar */}
        <div className={`w-[42px] h-[42px] rounded-full flex-shrink-0 bg-gradient-to-br flex items-center justify-center border shadow-sm relative ${avatarColors}`}>
           <span className="text-sm font-bold">
             {isDelivery ? `#${item.id?.toString().slice(-2)}` : 'WA'}
           </span>
           {item.unread > 0 && (
             <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold px-1 border-2 border-light-surface dark:border-dark-surface shadow-sm">
               {item.unread}
             </span>
           )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[15px] font-bold text-light-text-primary dark:text-dark-text-primary truncate">
              {item.displayTitle}
            </span>
            <span className="text-[12px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary flex-shrink-0">
              {item.sortDate ? new Date(item.sortDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${badgeCls}`}>
              {badgeText}
            </span>
            <span className="text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[120px] ml-1">
              {item.displaySubtitle}
            </span>
          </div>

          <div className={`text-[14px] leading-snug truncate ${isActive ? 'text-light-text-primary dark:text-dark-text-primary opacity-90' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
            {item.last_text || 'Sin mensajes'}
          </div>
        </div>
      </div>
      {/* iOS Style Separator */}
      <div className="absolute bottom-0 right-0 left-[68px] h-[1px] bg-light-border/30 dark:bg-dark-border/30" />
    </button>
  );
};

export default CustomersSidebar;
