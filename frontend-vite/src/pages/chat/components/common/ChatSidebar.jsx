// src/pages/chat/components/common/ChatSidebar.jsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminInbox from '../admin/AdminInbox';

const ClientInbox = ({
  t,
  items = [],
  loading = false,
  onOpen,
  activeConvId,
  onNew,
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="sticky top-0 px-0 pt-0 pb-2.5 backdrop-blur bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/60 dark:border-dark-border/60">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('chat.conversations')}</h3>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-matrix-green text-dark-bg hover:bg-matrix-green/90"
            onClick={onNew}
          >
            {t('chat.new')}
          </button>
        </div>
      </div>
      <div className="min-h-0 w-full max-w-full overflow-auto overflow-x-hidden pr-1 md:pr-2 gap-2 pt-2">
        {loading && <div className="text-sm opacity-70">{t('chat.loading')}</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm opacity-70">{t('chat.no_conversation')}</div>
        )}
        {items?.map((it) => (
          <ClientRow key={it.conv_id} t={t} item={it} isActive={activeConvId === it.conv_id} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
};

const ClientRow = ({ t, item, isActive, onOpen }) => {
  return (
    <button
      onClick={() => onOpen(item.conv_id)}
      className={`w-full max-w-full overflow-hidden break-words text-left px-3 py-2 rounded border transition min-h-[80px] max-h-[85px] ${isActive ? 'border-matrix-green/60 bg-matrix-green/10' : 'border-light-border/60 dark:border-dark-border/60 hover:bg-light-surface-tertiary/60 dark:hover:bg-dark-surface-tertiary/60'}`}
    >
      <div className="flex items-center justify-between gap-2 text-sm w-full max-w-full overflow-hidden">
        <div className="font-medium truncate min-w-0 max-w-full overflow-hidden">{t('chat.conversation')} #{item.conv_id}</div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="px-1.5 py-0.5 text-[10px] rounded border bg-light-surface-tertiary/60 border-light-border/40 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/40">{item.status}</span>
          {item.mode && <span className="px-1.5 py-0.5 text-[10px] rounded border bg-light-surface-tertiary/60 border-light-border/40 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/40">{item.mode}</span>}
        </div>
      </div>
      <div className="mt-2 text-sm opacity-75 leading-snug whitespace-pre-line line-clamp-2 overflow-hidden text-ellipsis max-w-full">{item.last_text || t('chat.no_messages')}</div>
      <div className="text-[11px] opacity-60 mt-1.5 truncate max-w-full overflow-hidden">
        {item.updated_at ? new Date(item.updated_at).toLocaleString() : ''}
      </div>
    </button>
  );
};

/**
 * ChatSidebar: unified sidebar for admin/client.
 * - Admin: renders AdminInbox with pagination/filter and open conversation.
 * - Client: renders ClientInbox with conversation list and new button.
 */
const ChatSidebar = ({
  variant = 'client',
  t,
  // admin props
  admin: {
    items = [],
    loading = false,
    page = 1,
    pageSize = 20,
    statusFilter = 'open',
    onChangePage,
    onChangePageSize,
    onChangeStatus,
    onOpen,
    activeConvId,
  } = {},
  // client props
  client: {
    unreadCount = 0,
    onNew,
    conversations = [],
    convosLoading = false,
    openConversation,
    activeConvId: clientActiveConvId,
  } = {},
}) => {
  const isAdmin = variant === 'admin';

  return (
    <div className="h-full min-h-0 rounded-lg border bg-light-surface-secondary/60 border-light-border/60 dark:bg-dark-surface-secondary/60 dark:border-dark-border/60 p-3 overflow-hidden">
      <div className={`h-full min-h-0 ${isAdmin ? 'overflow-auto' : 'overflow-hidden'} pr-1 md:pr-2`}>
        {isAdmin ? (
          <AdminInbox
            items={items}
            loading={loading}
            page={page}
            pageSize={pageSize}
            statusFilter={statusFilter}
            onChangePage={onChangePage}
            onChangePageSize={onChangePageSize}
            onChangeStatus={onChangeStatus}
            onOpen={onOpen}
            activeConvId={activeConvId}
          />
        ) : (
          <ClientInbox
            t={t}
            items={conversations}
            loading={convosLoading}
            onOpen={openConversation}
            activeConvId={clientActiveConvId}
            onNew={onNew}
          />
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;