import React from 'react';
import { Menu, Inbox, Wifi, WifiOff, ChevronLeft, ChevronDown } from 'lucide-react';

const ChatHeader = ({
  variant = 'client',
  t,
  connected,
  status,
  onOpenConversations,
  onOpenInbox,
  unreadInboxCount = 0,
  title,
  rightContent,
}) => {
  const isAdmin = variant === 'admin' || variant === 'delivery';
  const label = (t && t('chat.conversations')) || 'Chats';
  const online = (t && t('chat.online')) || 'Online';
  const offline = (t && t('chat.offline')) || 'Offline';

  return (
    <div className="w-full z-20 backdrop-blur-2xl bg-light-surface/70 dark:bg-dark-surface/70 border-b border-light-border/20 dark:border-dark-border/20 sticky top-0">
      <div className="flex items-center justify-between h-[60px] px-2 sm:px-4 max-w-full relative">
        
        {/* Left: Controls */}
        <div className="flex items-center gap-0 sm:gap-2 relative z-10 shrink-0">
          {onOpenConversations && (
            <button
              type="button"
              className="flex items-center gap-1 p-1.5 sm:p-1 -ml-1 rounded-lg text-light-accent dark:text-dark-accent hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors active:scale-95"
              onClick={onOpenConversations}
            >
              <ChevronLeft size={28} strokeWidth={2.5} className="-mr-1" />
              <span className="text-[17px] font-medium hidden md:inline">{label}</span>
            </button>
          )}

          {isAdmin && onOpenInbox && (
             <button
              type="button"
              onClick={onOpenInbox}
              className="relative p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors ml-1 sm:ml-0"
            >
              <Inbox size={22} className="text-light-text-primary dark:text-dark-text-primary" />
              {unreadInboxCount > 0 && (
                <span className="absolute top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-light-error dark:bg-dark-error text-[10px] text-white font-bold shadow-sm ring-2 ring-light-surface dark:ring-dark-surface">
                  {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Center: Title & Status Text (Apple style centered) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 px-24 sm:px-32">
             <button 
               onClick={onOpenConversations}
               className={`flex items-center justify-center gap-1 text-[16px] sm:text-[17px] font-semibold text-light-text-primary dark:text-dark-text-primary leading-tight px-1 w-full pointer-events-auto ${onOpenConversations ? 'cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity' : 'pointer-events-none'}`}
             >
               <span className="truncate">{title || (isAdmin ? 'Centro de Comando' : 'Soporte')}</span>
               {onOpenConversations && <ChevronDown size={16} className="md:hidden shrink-0 opacity-50" />}
             </button>
             {status && (
               <span className="text-[11px] sm:text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary pointer-events-none truncate max-w-full">
                 {status}
               </span>
             )}
        </div>

        {/* Right: Connection & Actions */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 relative z-10 shrink-0">
          {typeof connected === 'boolean' && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
               <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-light-success dark:bg-dark-success shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-light-error dark:bg-dark-error shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
               <span className="text-[11px] sm:text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary hidden sm:inline">
                 {connected ? online : offline}
               </span>
            </div>
          )}
          {rightContent}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;