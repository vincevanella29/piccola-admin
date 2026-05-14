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
        <div className="font-medium truncate min-w-0 max-w-full flex-1">{t('chat.conversation')} #{item.conv_id}</div>
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
 * ChatSidebar: unified sidebar for admin/client/delivery.
 * - Admin: renders AdminInbox with pagination/filter and open conversation.
 * - Client: renders ClientInbox with conversation list and new button.
 * - Delivery: renders DeliveryInbox with order-based chat list.
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
  // delivery props
  delivery: {
    items: deliveryItems = [],
    loading: deliveryLoading = false,
    statusFilter: deliveryStatusFilter = 'open',
    onChangeStatus: deliveryOnChangeStatus,
    onOpen: deliveryOnOpen,
    activeOrderNumber,
  } = {},
}) => {
  const isAdmin = variant === 'admin';
  const isDelivery = variant === 'delivery';

  return (
    <div className="h-full min-h-0 rounded-lg border bg-light-surface-secondary/60 border-light-border/60 dark:bg-dark-surface-secondary/60 dark:border-dark-border/60 p-3 overflow-hidden">
      <div className={`h-full min-h-0 ${isAdmin || isDelivery ? 'overflow-auto' : 'overflow-hidden'} pr-1 md:pr-2`}>
        {isDelivery ? (
          <DeliveryInbox
            items={deliveryItems}
            loading={deliveryLoading}
            statusFilter={deliveryStatusFilter}
            onChangeStatus={deliveryOnChangeStatus}
            onOpen={deliveryOnOpen}
            activeOrderNumber={activeOrderNumber}
          />
        ) : isAdmin ? (
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

// ─── Delivery Inbox ───────────────────────────────────────────────

const DeliveryInbox = ({
  items = [],
  loading = false,
  statusFilter = 'open',
  onChangeStatus,
  onOpen,
  activeOrderNumber,
}) => {
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {/* Filter */}
      <div className="sticky top-0 px-0 pt-0 pb-2.5 backdrop-blur bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/60 dark:border-dark-border/60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">🍕 Delivery Chats</h3>
        </div>
        <div className="flex gap-1">
          {['open', 'closed', 'all'].map((s) => (
            <button
              key={s}
              className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-all ${statusFilter === s ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' : 'opacity-60 hover:opacity-100 border border-transparent'}`}
              onClick={() => onChangeStatus?.(s)}
            >
              {s === 'all' ? 'Todos' : s === 'open' ? 'Abiertos' : 'Cerrados'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 w-full max-w-full overflow-auto overflow-x-hidden pr-1 md:pr-2 gap-2 pt-2 space-y-2">
        {loading && <div className="text-sm opacity-70">Cargando...</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm opacity-70">Sin chats de delivery</div>
        )}
        {items.map((it) => (
          <DeliveryRow
            key={it.order_number}
            item={it}
            isActive={activeOrderNumber === it.order_number}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
};

const DeliveryRow = ({ item, isActive, onOpen }) => {
  const modeBadge = item.mode === 'human'
    ? { text: '👤 Human', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' }
    : { text: '🤖 Bot', cls: 'bg-green-500/20 text-green-400 border-green-500/40' };

  return (
    <button
      onClick={() => onOpen?.(item.order_number)}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${isActive ? 'border-orange-500/60 bg-orange-500/10' : 'border-light-border/60 dark:border-dark-border/60 hover:bg-light-surface-tertiary/60 dark:hover:bg-dark-surface-tertiary/60'}`}
    >
      <div className="flex items-center justify-between gap-2 text-sm w-full min-w-0">
        <div className="font-medium truncate min-w-0 flex-1">#{item.order_number}</div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`px-1.5 py-0.5 text-[10px] rounded border ${modeBadge.cls}`}>{modeBadge.text}</span>
          {item.unread > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-500 text-white font-bold min-w-[18px] text-center">{item.unread}</span>
          )}
        </div>
      </div>
      <div className="text-xs opacity-70 mt-0.5">{item.customer_name || 'Cliente'}</div>
      <div className="mt-1.5 text-sm opacity-75 leading-snug whitespace-pre-line line-clamp-2 overflow-hidden text-ellipsis">
        {item.last_text || 'Sin mensajes'}
      </div>
      <div className="text-[11px] opacity-60 mt-1 truncate">
        {item.last_at ? new Date(item.last_at).toLocaleString() : ''}
      </div>
    </button>
  );
};

export default ChatSidebar;