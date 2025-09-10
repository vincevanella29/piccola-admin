// src/pages/chat/components/common/ChatMessage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import MessageText from './MessageText';
import ProductCard from '../common/ProductCard';
import ProductList from '../common/ProductList';
import LocationCard from '../common/LocationCard';
import LocationList from '../common/LocationList';
import ClubSectionCard from '../common/ClubSectionCard';
import HistoryTimeline from '../common/HistoryTimeline';
import UserModal from '../common/UserModal';
import DataTable from '../common/DataTable';
import SalaryDetailModal from '../modals/SalaryDetailModal';
import ConsumoDetailModal from '../modals/ConsumoDetailModal';

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
  // new optional callbacks to integrate footer jump button
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const isAdmin = variant === 'admin';
  const listRef = useRef(null);
  const [showJump, setShowJump] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryRow, setSalaryRow] = useState(null);
  const [consumoOpen, setConsumoOpen] = useState(false);
  const [consumoRow, setConsumoRow] = useState(null);
  const prevLenRef = useRef(0);

  const client = !isAdmin ? (clientProps || {}) : {};
  const admin = isAdmin ? (adminProps || {}) : {};

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

  const messages = useMemo(() => (isAdmin ? (admin?.messages || []) : (client?.messages || [])), [isAdmin, admin?.messages, client?.messages]);
  const isLoading = isAdmin ? Boolean(admin?.messagesLoading) : Boolean(client?.isLoading);
  const adminTyping = isAdmin ? Boolean(admin?.typingClient) : Boolean(client?.adminTyping);
  const participants = isAdmin ? (admin?.participants || []) : [];

  // Scroll to bottom on first mount (e.g., after F5)
  useEffect(() => {
    // Defer to ensure DOM has laid out
    const id = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const len = messages?.length || 0;
    const grew = len > prevLenRef.current;

    // Always go to bottom when a new message arrives
    if (grew) {
      scrollToBottom();
    } else if (!isNearBottom()) {
      // No new messages but user scrolled up => keep button state true
      setShowJump(true);
    }
    prevLenRef.current = len;
  }, [messages, isNearBottom, scrollToBottom]);
  console.log('messages', messages);

  const onListScroll = useCallback(() => {
    setShowJump(!isNearBottom());
  }, [isNearBottom]);

  const handleShowProfile = useCallback((participant) => {
    if (!participant) return;
    setProfileData(participant);
    setProfileOpen(true);
  }, []);

  // Notify parent of jump visibility changes
  useEffect(() => {
    onShowJumpChange && onShowJumpChange(Boolean(showJump));
  }, [showJump, onShowJumpChange]);

  // Provide parent with the scrollToBottom function
  useEffect(() => {
    onScrollToBottomReady && onScrollToBottomReady(scrollToBottom);
  }, [scrollToBottom, onScrollToBottomReady]);

  const modalUser = useMemo(() => {
    if (!profileData) return null;
    const maybeEnriched = profileData.profile && typeof profileData.profile === 'object' && 'profile' in profileData.profile ? profileData.profile : null;
    const nestedProfile = maybeEnriched ? (maybeEnriched.profile || {}) : (profileData.profile || {});
    const displayName = nestedProfile.name || profileData.display_name || profileData.name || profileData.role || 'User';
    const avatar = nestedProfile.profile_image_url || profileData.avatar_url || '';
    const balances = (maybeEnriched && maybeEnriched.balances) || profileData.balances || {};
    const burns = (maybeEnriched && maybeEnriched.burns) || profileData.burns || {};
    const completion = (maybeEnriched && maybeEnriched.completion_percentage) || profileData.completion_percentage || 0;
    const wallet = profileData.wallet || (maybeEnriched && maybeEnriched.wallet) || nestedProfile.wallet || '';
    return {
      wallet, balances, burns, completion_percentage: completion,
      profile: { ...nestedProfile, name: displayName, profile_image_url: avatar, public_profile: nestedProfile.public_profile ?? true, public_name: nestedProfile.public_name ?? true, public_birthdate: nestedProfile.public_birthdate ?? false },
    };
  }, [profileData]);

  return (
    // CAMBIO CLAVE: Se elimina el div exterior.
    // Este div ahora es el contenedor principal Y el área de scroll.
    // - h-full y min-h-0 vienen de su padre en chat.jsx, que le da un tamaño fijo.
    // - overflow-auto activa el scrollbar cuando el contenido es más alto que el div.
    // - p-3 y pr-* le dan el espaciado interno a los mensajes.
    <div
      ref={listRef}
      onScroll={onListScroll}
      className={`h-full min-h-0 w-full max-w-full relative overflow-y-auto overflow-x-hidden p-3 pr-1 md:pr-2 space-y-3 rounded-lg break-words ${className || ''}`}
    >
      {/* El contenido de los mensajes va directamente aquí */}
      {isLoading && (messages?.length || 0) === 0 ? (
        <p className="text-center text-light-text/60">{(t && t('chat.loading')) || 'Loading...'}</p>
      ) : (messages?.length || 0) === 0 ? (
        <p className="text-center text-light-text/60">{(t && t('chat.no_messages')) || 'Start the conversation...'}</p>
      ) : (
        messages.map((m, idx) => {
          const type = m?.payload?.type;
          const ts = (() => { try { return new Date(m?.created_at).toLocaleString(); } catch { return ''; } })();
          const participant = (() => {
            let found = null;
            if (participants && participants.length > 0) {
              const byWallet = m?.sender_wallet && participants.find(p => (p.wallet || '').toLowerCase() === (m.sender_wallet || '').toLowerCase());
              if (byWallet) found = byWallet;
              if (!found) {
                const byPrivy = m?.sender_privy_id && participants.find(p => (p.privy_id || '') === (m.sender_privy_id || ''));
                if (byPrivy) found = byPrivy;
              }
              if (!found) {
                const byRole = participants.find(p => (p.role || '').toLowerCase() === (m.role || '').toLowerCase());
                if (byRole) found = byRole;
              }
            }
            const isAssistantLocal = (m?.role || '').toLowerCase() === 'assistant';
            const dn = m?.sender_name || (isAssistantLocal ? 'La Nonna' : (found?.name || found?.display_name || ''));
            const av = m?.sender_avatar_url || found?.profile_image_url || found?.avatar_url || '';
            if (found) return found;
            return {
              wallet: m?.sender_wallet || undefined, privy_id: m?.sender_privy_id || undefined, display_name: dn, name: m?.sender_name || dn, avatar_url: av, role: m?.role,
              profile: { name: dn, profile_image_url: av, wallet: m?.sender_wallet || '', public_profile: true, public_name: true, public_birthdate: false },
            };
          })();
          const isAssistant = (m?.role || '').toLowerCase() === 'assistant';
          const displayName = isAssistant ? 'La Nonna' : (m?.sender_name || participant?.name || participant?.display_name || '');
          const avatarUrl = m?.sender_avatar_url || participant?.profile_image_url || participant?.avatar_url || '';
          return (
            <MessageBubble key={idx} role={m.role || 'bot'}>
              <div className="flex items-start gap-2 mb-1 w-full max-w-full">
                <button className="shrink-0" onClick={() => handleShowProfile(participant)} title={displayName} aria-label={displayName}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isAssistant ? 'bg-pink-500/20 text-pink-200' : 'bg-light-surface dark:bg-dark-surface'}`}>
                      {isAssistant ? (
                        <span className="text-base" role="img" aria-label="La Nonna">👵</span>
                      ) : (
                        <span className="text-[11px] text-light-text dark:text-dark-text">{(displayName || 'U').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                </button>
                <div className="flex-1 min-w-0 max-w-full overflow-x-hidden">
                  <div className="flex items-center justify-between gap-2 text-[11px] opacity-70">
                    <button className="truncate font-medium hover:underline text-left" onClick={() => participant && handleShowProfile(participant)} title={displayName}>{displayName}</button>
                    <span className="shrink-0">{ts}</span>
                  </div>
                  {type === 'product_card' && m?.payload?.product ? (<ProductCard product={m.payload.product} />)
                    : type === 'product_list' && Array.isArray(m?.payload?.items) ? (<ProductList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />)
                    : type === 'location_card' && m?.payload?.location ? (<LocationCard location={m.payload.location} />)
                    : type === 'location_list' && Array.isArray(m?.payload?.items) ? (<LocationList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />)
                    : type === 'club_section' && m?.payload ? (<ClubSectionCard payload={m.payload} />)
                    : type === 'history_timeline' && m?.payload ? (<HistoryTimeline payload={m.payload} />)
                    : type === 'data_table' && m?.payload ? (
                      <DataTable
                        title={m.payload.title}
                        subtitle={m.payload.subtitle}
                        kpis={m.payload.kpis}
                        columns={m.payload.columns}
                        rows={m.payload.rows}
                        totals={m.payload.totals}
                        charts={m.payload.charts}
                        compact={true}
                        onRowClick={(row) => {
                          // Heurísticas por tipo
                          if ((m.payload.title || '').toLowerCase().includes('consumo')) {
                            setConsumoRow({ row, columns: m.payload.columns, kpis: m.payload.kpis });
                            setConsumoOpen(true);
                            return;
                          }
                          if (row && (row.worker || row.profile_image_url)) {
                            setSalaryRow(row);
                            setSalaryOpen(true);
                          }
                        }}
                      />
                    )
                    : (<MessageText role={m.role || 'bot'} text={m.text || m.message || ''} optimistic={m.optimistic} />)}
                </div>
              </div>
            </MessageBubble>
          );
        })
      )}
      {adminTyping && (
        <div className="mt-2 text-sm italic text-matrix-green/90">{(t && t('chat.admin_typing')) || 'Admin is typing...'}</div>
      )}

      {/* El modal no se toca, sigue funcionando igual porque usa un portal y se renderiza fuera de este div */}
      {profileOpen && modalUser && (
        <UserModal user={modalUser} onClose={() => setProfileOpen(false)} t={t} appState={appState} mediaMap={mediaMap} allProducts={allProducts} locations={locations} />
      )}
      {salaryOpen && (
        <SalaryDetailModal open={salaryOpen} row={salaryRow} onClose={() => { setSalaryOpen(false); setSalaryRow(null); }} />
      )}
      {consumoOpen && (
        <ConsumoDetailModal open={consumoOpen} payloadRow={consumoRow} onClose={() => { setConsumoOpen(false); setConsumoRow(null); }} />
      )}
    </div>
  );
};

export default ChatMessage;