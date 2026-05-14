import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserCircle2, Bot, MapPin, Phone, Package, Car } from 'lucide-react';
import { getSectionColor } from '../community/sectionColors';
import MessageBubble from './MessageBubble';
import MessageText from './MessageText';
import ProductCard from '../common/ProductCard';
import ProductList from '../common/ProductList';
import LocationCard from '../common/LocationCard';
import LocationList from '../common/LocationList';
import DataTable from '../common/DataTable';
import DeliveryOrderModal from '../modals/DeliveryOrderModal';

// --- COMPONENTE AVATAR REUTILIZABLE ---
const ChatAvatar = ({ url, name, isAssistant, isAdmin, onClick }) => {
  if (isAssistant) {
    return (
      <button onClick={onClick} className="shrink-0 mt-1 group" title="La Nonna">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-pink-500/10 text-pink-500 border border-pink-200 dark:border-pink-900 group-hover:scale-105 transition-transform">
          <span className="text-lg" role="img" aria-label="La Nonna">👵</span>
        </div>
      </button>
    );
  }

  if (isAdmin) {
    return (
      <button onClick={onClick} className="shrink-0 mt-1 group" title={name}>
        {url ? (
          <img
            src={url}
            alt={name}
            className="w-8 h-8 rounded-full object-cover border border-light-border/50 dark:border-dark-border/50 shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors"
          style={{ display: url ? 'none' : 'flex' }}
        >
          <span className="text-white text-xs font-bold">L</span>
        </div>
      </button>
    );
  }

  return (
    <button onClick={onClick} className="shrink-0 mt-1 group" title={name}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-8 h-8 rounded-full object-cover border border-light-border/50 dark:border-dark-border/50 shadow-sm transition-colors"
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div
        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm transition-colors"
        style={{ display: url ? 'none' : 'flex' }}
      >
        <UserCircle2 className="text-light-text-tertiary dark:text-dark-text-tertiary w-5 h-5" />
      </div>
    </button>
  );
};

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

const DeliveryChatMessage = ({
  appState,
  className,
  t,
  delivery = {},
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const listRef = useRef(null);
  const [showJump, setShowJump] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const prevLenRef = useRef(0);

  const isNearBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return true;
    const threshold = 80;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowJump(false);
  }, []);

  const messages = delivery?.messages || [];
  const isLoading = Boolean(delivery?.loading);
  const chatState = delivery?.chatState;
  const adminTyping = Boolean(delivery?.typingClient);

  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const len = messages?.length || 0;
    const grew = len > prevLenRef.current;
    if (grew) scrollToBottom();
    else if (!isNearBottom()) setShowJump(true);
    prevLenRef.current = len;
  }, [messages, isNearBottom, scrollToBottom]);

  const onListScroll = useCallback(() => {
    setShowJump(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => { onShowJumpChange && onShowJumpChange(Boolean(showJump)); }, [showJump, onShowJumpChange]);
  useEffect(() => { onScrollToBottomReady && onScrollToBottomReady(scrollToBottom); }, [scrollToBottom, onScrollToBottomReady]);

  return (
    <div className={`flex flex-col h-full w-full min-w-0 ${className || ''}`}>
      <OrderContextHeader 
        chatState={chatState} 
        onClick={() => setModalOpen(true)} 
      />

      <div
        ref={listRef}
        onScroll={onListScroll}
        className="flex-1 min-h-0 w-full max-w-full relative overflow-y-auto overflow-x-hidden p-3 pr-1 md:pr-2 space-y-5 break-words"
      >
        {isLoading && messages.length === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm animate-pulse">{(t && t('chat.loading')) || 'Cargando historial...'}</p>
      ) : messages.length === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm">{(t && t('chat.no_messages')) || 'Aún no hay mensajes en este pedido...'}</p>
      ) : (
        messages.map((m, idx) => {
          const type = m?.payload?.type;
          const ts = (() => { try { return new Date(m?.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();
          const roleStr = (m?.role || '').toLowerCase();
          
          const isMe = roleStr === 'admin';
          const isAssistant = roleStr === 'assistant' || roleStr === 'bot';
          const isCustomer = roleStr === 'user'; // Cliente de delivery
          
          let displayName = '';
          let avatarUrl = m?.sender_avatar_url || '';
          
          if (isAssistant) {
            displayName = 'La Nonna 🍕';
          } else if (isMe) {
            displayName = m?.sender_name;
            const adminWallet = m?.admin_wallet;
            const isCurrentAdmin = !adminWallet || (appState?.account || '').toLowerCase() === adminWallet.toLowerCase();
            
            if (!displayName || displayName === 'Local') {
               if (isCurrentAdmin) {
                 displayName = appState?.profile?.name || 'Local';
                 if (!avatarUrl) avatarUrl = appState?.profile?.profile_image_url || '';
               } else {
                 displayName = adminWallet ? `Admin (${adminWallet.slice(0, 6)}...)` : 'Local';
               }
            }
          } else {
            displayName = chatState?.customer_name || 'Cliente';
          }

          // Pasamos "user" si somos nosotros (el local/admin) para que aparezca a la derecha
          // Pasamos "other" si es el cliente (izquierda)
          // Si es assistant, lo mostramos a la derecha pero distinguible, o a la izquierda si consideramos que es un "tercero" automatizado.
          // Como asiste al admin, a la derecha queda mejor, lo marcaremos como "user" para MessageBubble.
          const bubbleRole = (isMe || isAssistant) ? 'user' : 'other';

          return (
            <MessageBubble key={idx} role={bubbleRole}>
              <div className={`flex items-start gap-3 mb-1 w-full max-w-full ${bubbleRole === 'user' ? 'flex-row-reverse' : ''}`}>
                <ChatAvatar
                  url={avatarUrl}
                  name={displayName}
                  isAssistant={isAssistant}
                  isAdmin={isMe}
                />

                <div className={`flex-1 min-w-0 max-w-full overflow-x-hidden ${bubbleRole === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${bubbleRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {bubbleRole === 'user' && <span className="shrink-0 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary opacity-70">{ts}</span>}
                    <span
                      className="truncate text-xs font-bold"
                      style={{ color: isAssistant ? '#ec4899' : (isMe ? '#3b82f6' : '#10b981') }}
                      title={displayName}
                    >
                      {displayName}
                    </span>
                    {bubbleRole === 'other' && <span className="shrink-0 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary opacity-70">{ts}</span>}
                  </div>

                  {/* --- CONTENT SWITCHER --- */}
                  <div className={`flex flex-col gap-3 w-full ${bubbleRole === 'user' ? 'items-end' : 'items-start'}`}>
                    {type === 'product_card' && m?.payload?.product ? (
                      <ProductCard product={m.payload.product} recipe={m?.payload?.recipe} />
                    ) : type === 'product_list' && Array.isArray(m?.payload?.items) ? (
                      <ProductList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />
                    ) : type === 'location_card' && m?.payload?.location ? (
                      <LocationCard location={m.payload.location} />
                    ) : type === 'location_list' && Array.isArray(m?.payload?.items) ? (
                      <LocationList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />
                    ) : type === 'data_table' && m?.payload ? (
                      <DataTable
                        title={m.payload.title}
                        subtitle={m.payload.subtitle}
                        columns={m.payload.columns || []}
                        rows={m.payload.rows || []}
                        compact={true}
                      />
                    ) : (
                      <MessageText role={bubbleRole} text={m.text || m.message || ''} optimistic={m.optimistic} />
                    )}
                    {m?.payload?.assistant_text && (
                      <div className="px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
                        <MessageText role={bubbleRole} text={m.payload.assistant_text} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </MessageBubble>
          );
        })
      )}
      </div>

      <DeliveryOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        order={chatState?.order}
        customerName={chatState?.customer_name}
      />
    </div>
  );
};

export default DeliveryChatMessage;
