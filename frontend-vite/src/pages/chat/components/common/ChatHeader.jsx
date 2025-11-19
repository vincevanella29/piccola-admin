import React from 'react';
import { Menu, Inbox, Wifi, WifiOff } from 'lucide-react';

// Estilo Glass interno
const HEADER_GLASS = "backdrop-blur-md bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 border-b border-light-border/50 dark:border-dark-border/50";

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
  const isAdmin = variant === 'admin';
  const label = (t && t('chat.conversations')) || 'Conversations';
  const online = (t && t('chat.online')) || 'Online';
  const offline = (t && t('chat.offline')) || 'Offline';

  return (
    <div className={`w-full z-20 ${HEADER_GLASS}`}>
      <div className="flex items-center justify-between h-14 px-4">
        
        {/* Left: Controls & Title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Admin Inbox Button */}
          {isAdmin && onOpenInbox && (
            <button
              type="button"
              onClick={onOpenInbox}
              className="relative p-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors group"
              title={(t && t('chat.inbox')) || 'Inbox'}
            >
              <Inbox size={16} className="text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-accent dark:group-hover:text-dark-accent" />
              {unreadInboxCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold shadow-sm">
                  {unreadInboxCount}
                </span>
              )}
            </button>
          )}

          {/* Client Conversations Button */}
          {onOpenConversations && (
            <button
              type="button"
              className="p-2 rounded-xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors group"
              onClick={onOpenConversations}
              title={label}
            >
              <Menu size={16} className="text-light-text-secondary dark:text-dark-text-secondary group-hover:text-light-accent dark:group-hover:text-dark-accent" />
            </button>
          )}

          {/* Title & Status Text */}
          <div className="flex flex-col justify-center">
             <div className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">
               {title || (isAdmin ? 'Centro de Comando' : 'Chat de Soporte')}
             </div>
             {status && (
               <span className="text-[10px] font-mono text-light-text-tertiary dark:text-dark-text-tertiary uppercase tracking-wider">
                 {status}
               </span>
             )}
          </div>
        </div>

        {/* Right: Connection & Actions */}
        <div className="flex items-center gap-3">
          {/* Connection Indicator */}
          {typeof connected === 'boolean' && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${connected 
               ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400' 
               : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
            }`}>
               {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
               <span className="text-[10px] font-bold uppercase hidden sm:inline">
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