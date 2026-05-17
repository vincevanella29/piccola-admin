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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-light-surface/50 dark:bg-dark-surface/50 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm relative">
      <div className="sticky top-0 px-4 py-3 backdrop-blur-xl bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/20 dark:border-dark-border/20 z-10 flex items-center justify-between">
        <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">{t('chat.conversations')}</h3>
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 transition-colors"
          onClick={onNew}
          title={t('chat.new')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-auto overflow-x-hidden scrollbar-none pb-2">
        {loading && <div className="text-[13px] font-medium opacity-60 px-4 pt-6 text-center">{t('chat.loading')}</div>}
        {!loading && items.length === 0 && (
          <div className="text-[13px] font-medium opacity-60 px-4 pt-6 text-center">{t('chat.no_conversation')}</div>
        )}
        <div className="flex flex-col">
          {items?.map((it) => (
            <ClientRow key={it.conv_id} t={t} item={it} isActive={activeConvId === it.conv_id} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ClientRow = ({ t, item, isActive, onOpen }) => {
  return (
    <button
      onClick={() => onOpen(item.conv_id)}
      className={`relative w-full max-w-full overflow-hidden text-left px-4 py-3 transition-colors ${isActive ? 'bg-light-accent/10 dark:bg-dark-accent/10' : 'hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40'}`}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Avatar Placeholder */}
        <div className="w-[42px] h-[42px] rounded-full flex-shrink-0 bg-gradient-to-br from-light-surface-secondary to-light-surface-tertiary dark:from-dark-surface-secondary dark:to-dark-surface-tertiary flex items-center justify-center border border-light-border/40 dark:border-dark-border/40 shadow-sm">
           <span className="text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary">{item.conv_id?.toString().slice(-2)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[15px] font-bold text-light-text-primary dark:text-dark-text-primary truncate">{t('chat.conversation')} #{item.conv_id}</span>
            <span className="text-[12px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary flex-shrink-0">
              {item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-secondary dark:text-dark-text-secondary border border-light-border/20 dark:border-dark-border/20">{item.status}</span>
            {item.mode && <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-secondary dark:text-dark-text-secondary border border-light-border/20 dark:border-dark-border/20">{item.mode}</span>}
          </div>

          <div className={`text-[14px] leading-snug truncate ${isActive ? 'text-light-text-primary dark:text-dark-text-primary opacity-90' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
            {item.last_text || t('chat.no_messages')}
          </div>
        </div>
      </div>
      {/* iOS Style Separator */}
      <div className="absolute bottom-0 right-0 left-[68px] h-[1px] bg-light-border/30 dark:bg-dark-border/30" />
    </button>
  );
};

const ChatSidebar = ({
  variant = 'client',
  t,
  admin: {
    items = [], loading = false, page = 1, pageSize = 20, statusFilter = 'open',
    onChangePage, onChangePageSize, onChangeStatus, onOpen, activeConvId,
  } = {},
  client: {
    unreadCount = 0, onNew, conversations = [], convosLoading = false,
    openConversation, activeConvId: clientActiveConvId,
  } = {},
  delivery: {
    items: deliveryItems = [], loading: deliveryLoading = false, statusFilter: deliveryStatusFilter = 'open',
    onChangeStatus: deliveryOnChangeStatus, onOpen: deliveryOnOpen, activeOrderNumber,
  } = {},
}) => {
  const isAdmin = variant === 'admin';
  const isDelivery = variant === 'delivery';

  return (
    <div className="h-full min-h-0 overflow-hidden px-2 sm:px-4 py-2">
        {isDelivery ? (
          <DeliveryInbox
            items={deliveryItems} loading={deliveryLoading} statusFilter={deliveryStatusFilter}
            onChangeStatus={deliveryOnChangeStatus} onOpen={deliveryOnOpen} activeOrderNumber={activeOrderNumber}
          />
        ) : isAdmin ? (
          <AdminInbox
            items={items} loading={loading} page={page} pageSize={pageSize} statusFilter={statusFilter}
            onChangePage={onChangePage} onChangePageSize={onChangePageSize} onChangeStatus={onChangeStatus}
            onOpen={onOpen} activeConvId={activeConvId}
          />
        ) : (
          <ClientInbox
            t={t} items={conversations} loading={convosLoading} onOpen={openConversation}
            activeConvId={clientActiveConvId} onNew={onNew}
          />
        )}
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
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-light-surface/50 dark:bg-dark-surface/50 rounded-2xl border border-light-border/20 dark:border-dark-border/20 shadow-sm relative">
      <div className="sticky top-0 px-4 py-3 backdrop-blur-xl bg-light-surface/80 dark:bg-dark-surface/80 border-b border-light-border/20 dark:border-dark-border/20 z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">🍕 Delivery</h3>
        </div>
        <div className="flex gap-2">
          {['open', 'closed', 'all'].map((s) => (
            <button
              key={s}
              className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${statusFilter === s ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30' : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-secondary dark:text-dark-text-secondary border border-transparent hover:bg-light-border/20 dark:hover:bg-dark-border/20'}`}
              onClick={() => onChangeStatus?.(s)}
            >
              {s === 'all' ? 'Todos' : s === 'open' ? 'Abiertos' : 'Cerrados'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-auto overflow-x-hidden scrollbar-none pb-2">
        {loading && <div className="text-[13px] font-medium opacity-60 px-4 pt-6 text-center">Cargando...</div>}
        {!loading && items.length === 0 && (
          <div className="text-[13px] font-medium opacity-60 px-4 pt-6 text-center">Sin chats de delivery</div>
        )}
        <div className="flex flex-col">
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
    </div>
  );
};

const DeliveryRow = ({ item, isActive, onOpen }) => {
  const modeBadge = item.mode === 'human'
    ? { text: '👤 Human', cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
    : { text: '🤖 Bot', cls: 'bg-green-500/10 text-green-500 border-green-500/20' };

  return (
    <button
      onClick={() => onOpen?.(item.order_number)}
      className={`relative w-full text-left px-4 py-3 transition-colors ${isActive ? 'bg-orange-500/10 dark:bg-orange-500/10' : 'hover:bg-light-surface-tertiary/40 dark:hover:bg-dark-surface-tertiary/40'}`}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Avatar Placeholder para Delivery */}
        <div className="w-[42px] h-[42px] rounded-full flex-shrink-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/30 shadow-sm relative">
           <span className="text-sm font-bold text-orange-600 dark:text-orange-400">#{item.order_number?.toString().slice(-2)}</span>
           {item.unread > 0 && (
             <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold px-1 border-2 border-light-surface dark:border-dark-surface shadow-sm">
               {item.unread}
             </span>
           )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[15px] font-bold text-light-text-primary dark:text-dark-text-primary truncate">Pedido #{item.order_number}</span>
            <span className="text-[12px] font-medium text-light-text-tertiary dark:text-dark-text-tertiary flex-shrink-0">
              {item.last_at ? new Date(item.last_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${modeBadge.cls}`}>{modeBadge.text}</span>
            <span className="text-[12px] font-medium text-light-text-secondary dark:text-dark-text-secondary truncate max-w-[120px] ml-1">{item.customer_name || 'Cliente'}</span>
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

export default ChatSidebar;