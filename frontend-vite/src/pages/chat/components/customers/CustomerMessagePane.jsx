import React, { useCallback, useEffect, useRef, useState } from 'react';
import MessageList from '../message/core/MessageList';
import { Phone } from 'lucide-react';
import OrderContextHeader from '../message/OrderContextHeader';
import DeliveryOrderModal from '../modals/DeliveryOrderModal';

const CustomerMessagePane = ({
  provider = 'delivery', // 'delivery' | 'whatsapp'
  messages = [],
  appState,
  chatState, // for delivery
  phone, // for whatsapp
  className,
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLenRef = useRef(messages.length);
  const [showJump, setShowJump] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Normalizar mensajes de WhatsApp al formato de MessageList
  const normalizedMessages = provider === 'whatsapp' 
    ? messages.map(m => ({
        ...m,
        id: m._id || m.wa_msg_id || Math.random().toString(),
        role: m.direction === 'inbound' ? 'user' : 'admin',
        text: m.content || '',
        created_at: m.created_at,
      }))
    : messages;

  useEffect(() => {
    if (normalizedMessages.length === 0) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [normalizedMessages.length]);

  const isNearBottom = useCallback(() => {
    if (!listRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    }
  }, []);

  useEffect(() => {
    const len = normalizedMessages.length;
    if (len === 0) return;
    if (len > prevLenRef.current) scrollToBottom(true);
    else if (!isNearBottom()) setShowJump(true);
    prevLenRef.current = len;
  }, [normalizedMessages, isNearBottom, scrollToBottom]);

  const onListScroll = useCallback(() => {
    setShowJump(!isNearBottom());
  }, [isNearBottom]);

  useEffect(() => { onShowJumpChange && onShowJumpChange(Boolean(showJump)); }, [showJump, onShowJumpChange]);
  useEffect(() => { onScrollToBottomReady && onScrollToBottomReady(scrollToBottom); }, [scrollToBottom, onScrollToBottomReady]);

  return (
    <div className={`flex flex-col h-full w-full min-w-0 ${className || ''}`}>
      
      {provider === 'delivery' ? (
        <>
          <OrderContextHeader
            chatState={chatState}
            onClick={() => setModalOpen(true)}
          />
          <DeliveryOrderModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            delivery={chatState?.order}
            appState={appState}
          />
        </>
      ) : (
        <div className="shrink-0 bg-white/70 dark:bg-[#1c1c1e]/70 border-b border-light-border/20 dark:border-dark-border/20 px-5 py-3 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-sm">
              <Phone size={18} fill="currentColor" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">+{phone}</h3>
              <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">Canal WhatsApp Oficial</p>
            </div>
          </div>
        </div>
      )}

      <MessageList
        messages={normalizedMessages}
        variant="bubble"
        myWallet={appState?.account}
        isAdmin={true}
        appState={appState}
        customerName={provider === 'delivery' ? (chatState?.customer_name || 'Cliente') : `+${phone}`}
        isLoading={isLoading}
        emptyText={'Aún no hay mensajes en esta conversación...'}
        listRef={listRef}
        onScroll={onListScroll}
        bottomRef={bottomRef}
      />

    </div>
  );
};

export default CustomerMessagePane;
