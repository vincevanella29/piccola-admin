// src/pages/chat/components/common/ChatHeader.jsx
import React from 'react';

/**
 * Common sticky ChatHeader used by both client and admin chat views.
 * Ultra-compact, single-line bar with icon buttons.
 *
 * Props:
 * - variant: 'client' | 'admin'
 * - t: i18n function (optional)
 * - connected: boolean (optional)
 * - status: string (optional)
 * - title: string/node (optional)
 * - rightContent: node (optional)
 * - sticky: boolean (default true)
 * - topClass: string (default 'top-0')
 * - onOpenConversations: function (client) optional
 * - onOpenInbox: function (admin) optional
 * - unreadInboxCount: number (admin) optional
 */
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
  sticky = true,
  topClass = 'top-0',
}) => {
  const isAdmin = variant === 'admin';
  const label = (t && t('chat.conversations')) || 'Conversations';
  const online = (t && t('chat.online')) || 'Online';
  const offline = (t && t('chat.offline')) || 'Offline';

  return (
    <div className={`${sticky ? `sticky ${topClass} z-20` : ''}`}>
      <div className="flex items-center justify-between h-10 px-3 sm:px-4 rounded-md bg-light-surface dark:bg-dark-surface border border-light-border/60 dark:border-dark-border/60 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          {isAdmin && onOpenInbox && (
            <button
              type="button"
              onClick={onOpenInbox}
              className="inline-flex items-center gap-1 px-2 h-7 rounded bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-accent-hover/40 dark:hover:bg-dark-accent-hover/30 border border-light-border/60 dark:border-dark-border/60 text-xs text-light-text-primary dark:text-dark-text-primary"
              title={(t && t('chat.inbox')) || 'Inbox'}
            >
              {/* Inbox Icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13h4l2 3h6l2-3h4v7H3v-7z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 13V6h10v7" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="hidden sm:inline">{(t && t('chat.inbox')) || 'Inbox'}</span>
              {unreadInboxCount > 0 && (
                <span className="ml-1 px-1.5 rounded-full bg-red-500/80 text-white text-[10px] leading-4">
                  {unreadInboxCount}
                </span>
              )}
            </button>
          )}
          {onOpenConversations && (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 h-7 rounded bg-light-surface-secondary dark:bg-dark-surface-secondary hover:bg-light-accent-hover/40 dark:hover:bg-dark-accent-hover/30 border border-light-border/60 dark:border-dark-border/60 text-xs text-light-text-primary dark:text-dark-text-primary"
              onClick={onOpenConversations}
              title={label}
            >
              {/* Conversations Icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a 4 4 0 0 1 4 4v8z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              <span className="hidden sm:inline">{label}</span>
            </button>
          )}
          <div className="truncate text-[13px] font-medium text-light-text-primary dark:text-dark-text-primary opacity-90">
            {title || (isAdmin ? 'Admin' : 'Chat')}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-light-text-secondary dark:text-dark-text-secondary">
          {typeof connected === 'boolean' && (
            <span className="inline-flex items-center gap-1">
              <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-matrix-green' : 'bg-zinc-500'}`} />
              <span className="hidden sm:inline">{connected ? online : offline}</span>
            </span>
          )}
          {status && <span className="opacity-80 text-light-text-primary/80 dark:text-dark-text-primary/80">{status}</span>}
          {rightContent}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
