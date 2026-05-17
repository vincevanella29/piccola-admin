import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UserModal from '../common/UserModal';
import ProductDetailModal from '../modals/ProductDetailModal';
import SalaryDetailModal from '../modals/SalaryDetailModal';
import ConsumoDetailModal from '../modals/ConsumoDetailModal';
import SueldosDetailModal from '../modals/SueldosDetailModal';
import MessageList from './core/MessageList';

const ChatMessage = ({
  variant = 'client',
  appState,
  className,
  t,
  client: clientProps,
  admin: adminProps,
  mediaMap = {},
  allProducts = [],
  locations = [],
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const isAdmin = variant === 'admin';
  const listRef = useRef(null);
  const [showJump, setShowJump] = useState(false);

  // Modals State
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryRow, setSalaryRow] = useState(null);
  const [consumoOpen, setConsumoOpen] = useState(false);
  const [consumoRow, setConsumoRow] = useState(null);
  const [productOpen, setProductOpen] = useState(false);
  const [productRow, setProductRow] = useState(null);
  const [productPayload, setProductPayload] = useState(null);
  const [sueldosOpen, setSueldosOpen] = useState(false);
  const [sueldosPayload, setSueldosPayload] = useState(null);

  const prevLenRef = useRef(0);

  const client = !isAdmin ? (clientProps || {}) : {};
  const admin = isAdmin ? (adminProps || {}) : {};
  const myProfile = appState?.profile;

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

  const messages = useMemo(() => {
    if (isAdmin) return admin?.messages || [];
    return client?.messages || [];
  }, [isAdmin, admin?.messages, client?.messages]);
  const isLoading = isAdmin ? Boolean(admin?.messagesLoading) : Boolean(client?.isLoading);
  const adminTyping = isAdmin ? Boolean(admin?.typingClient) : Boolean(client?.adminTyping);
  const participants = isAdmin ? (admin?.participants || []) : [];

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

  const handleShowProfile = useCallback((participant) => {
    if (!participant) return;
    setProfileData(participant);
    setProfileOpen(true);
  }, []);

  useEffect(() => { onShowJumpChange?.(Boolean(showJump)); }, [showJump, onShowJumpChange]);
  useEffect(() => { onScrollToBottomReady?.(scrollToBottom); }, [scrollToBottom, onScrollToBottomReady]);

  const handleRowClick = useCallback((row, payload) => {
    if (!payload && row) {
      if (row.worker || row.profile_image_url) { setSalaryRow(row); setSalaryOpen(true); return; }
      if (row.code || row.image_url) { setProductRow(row); setProductPayload(null); setProductOpen(true); return; }
    }
    
    if (!payload) return;
    const intent = (payload.intent || '').toLowerCase();
    const meta = payload.meta || {};
    const columns = payload.columns || [];
    
    if (intent === 'ventas_hora') { setSalaryRow({ row, columns, kpis: payload.kpis, intent }); setSalaryOpen(true); return; }
    if (intent === 'sueldos') {
      const groupBy = String(meta.group_by || '').toLowerCase();
      if (groupBy === 'sigla' && row && Array.isArray(row.detail_rows)) { setSueldosPayload({ title: row.detail_title || `Detalle · ${row.group}`, columns: row.detail_columns, rows: row.detail_rows, kpis: payload.kpis }); setSueldosOpen(true); return; }
      if (groupBy.includes('rut') || row?.rut) { setSalaryRow({ row, columns, kpis: payload.kpis, intent, meta }); setSalaryOpen(true); return; }
    }
    if ((payload.title || '').toLowerCase().includes('consumo')) { setConsumoRow({ row, columns, kpis: payload.kpis }); setConsumoOpen(true); return; }
    if (row && (row.code || row.image_url || (payload.title || '').toLowerCase().includes('producto'))) { setProductRow(row); setProductPayload(payload); setProductOpen(true); return; }
    if (row && (row.worker || row.profile_image_url)) { setSalaryRow(row); setSalaryOpen(true); }
  }, []);

  const modalUser = useMemo(() => {
    if (!profileData) return null;
    const p = profileData.profile || profileData;
    return {
      wallet: profileData.wallet || p.wallet,
      balances: profileData.balances || p.balances,
      burns: profileData.burns || p.burns,
      completion_percentage: profileData.completion_percentage || p.completion_percentage,
      profile: {
        ...p,
        name: p.name || profileData.name || profileData.display_name || 'Usuario',
        profile_image_url: p.profile_image_url || profileData.avatar_url,
      }
    };
  }, [profileData]);

  return (
    <div className={`flex flex-col h-full w-full min-w-0 relative ${className || ''}`}>
      <MessageList
        messages={messages}
        variant="bubble"
        myWallet={appState?.account}
        isAdmin={isAdmin}
        appState={appState}
        isLoading={isLoading}
        emptyText={(t && t('chat.no_messages')) || 'Todo tranquilo por aquí...'}
        listRef={listRef}
        onScroll={onListScroll}
        onAvatarClick={handleShowProfile}
        onRowClick={handleRowClick}
      />

      {adminTyping && (
        <div className="mt-2 ml-14 text-xs italic text-matrix-green/80 animate-pulse flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      )}

      {profileOpen && modalUser && <UserModal user={modalUser} onClose={() => setProfileOpen(false)} t={t} appState={appState} mediaMap={mediaMap} allProducts={allProducts} locations={locations} />}
      {salaryOpen && <SalaryDetailModal open={salaryOpen} row={salaryRow} onClose={() => { setSalaryOpen(false); setSalaryRow(null); }} />}
      {consumoOpen && <ConsumoDetailModal open={consumoOpen} payloadRow={consumoRow} onClose={() => { setConsumoOpen(false); setConsumoRow(null); }} />}
      {sueldosOpen && <SueldosDetailModal open={sueldosOpen} payload={sueldosPayload} onClose={() => { setSueldosOpen(false); setSueldosPayload(null); }} />}
      {productOpen && <ProductDetailModal open={productOpen} row={productRow} payload={productPayload} onClose={() => { setProductOpen(false); setProductRow(null); setProductPayload(null); }} />}
    </div>
  );
};

export default ChatMessage;