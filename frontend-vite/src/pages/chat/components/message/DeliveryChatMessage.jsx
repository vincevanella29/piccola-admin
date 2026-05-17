import React, { useCallback, useEffect, useRef, useState } from 'react';
import OrderContextHeader from './OrderContextHeader';
import { useTranslation } from 'react-i18next';
import MessageList from './core/MessageList';
import DeliveryOrderModal from '../modals/DeliveryOrderModal';

const DeliveryChatMessage = ({
  messages = [],
  appState,
  chatState,
  isAdmin = true, // Si estamos en el Admin Web3, siempre somos admin
  className,
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevLenRef = useRef(messages.length);
  const [showJump, setShowJump] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Si la lista está vacía al montar, simulamos "loading" brevemente
    if (messages.length === 0) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [messages.length]);

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
    const len = messages.length;
    if (len === 0) return;
    if (len > prevLenRef.current) scrollToBottom(true);
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

      <MessageList
        messages={messages}
        variant="bubble"
        myWallet={appState?.account}
        isAdmin={isAdmin}
        appState={appState}
        customerName={chatState?.customer_name || 'Cliente'}
        isLoading={isLoading}
        emptyText={(t && t('chat.no_messages')) || 'Aún no hay mensajes en este pedido...'}
        listRef={listRef}
        onScroll={onListScroll}
        bottomRef={bottomRef}
      />

      <DeliveryOrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        delivery={chatState?.order}
        appState={appState}
      />
    </div>
  );
};

export default DeliveryChatMessage;
