import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserCircle2 } from 'lucide-react';
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
import ProductDetailModal from '../modals/ProductDetailModal';
import SalaryDetailModal from '../modals/SalaryDetailModal';
import ConsumoDetailModal from '../modals/ConsumoDetailModal';
import SueldosDetailModal from '../modals/SueldosDetailModal';

// --- COMPONENTE AVATAR REUTILIZABLE ---
const ChatAvatar = ({ url, name, isAssistant, onClick }) => {
  if (isAssistant) {
    return (
      <button onClick={onClick} className="shrink-0 mt-1 group" title="La Nonna">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-pink-500/10 text-pink-500 border border-pink-200 dark:border-pink-900 group-hover:scale-105 transition-transform">
          <span className="text-lg" role="img" aria-label="La Nonna">👵</span>
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
          className="w-8 h-8 rounded-full object-cover border border-light-border/50 dark:border-dark-border/50 shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors" 
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} 
        />
      ) : null}
      <div 
        className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm group-hover:border-light-accent dark:group-hover:border-dark-accent transition-colors"
        style={{ display: url ? 'none' : 'flex' }}
      >
        <UserCircle2 className="text-light-text-tertiary dark:text-dark-text-tertiary w-5 h-5" />
      </div>
    </button>
  );
};

const ChatMessage = ({
  variant = 'client',
  appState,
  className,
  t,
  client: clientProps,
  admin: adminProps,
  delivery: deliveryProps,
  mediaMap = {},
  allProducts = [],
  locations = [],
  onShowJumpChange,
  onScrollToBottomReady,
}) => {
  const isAdmin = variant === 'admin';
  const isDelivery = variant === 'delivery';
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

  const client = (!isAdmin && !isDelivery) ? (clientProps || {}) : {};
  const admin = isAdmin ? (adminProps || {}) : {};
  const delivery = isDelivery ? (deliveryProps || {}) : {};
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
    if (isDelivery) return delivery?.messages || [];
    if (isAdmin) return admin?.messages || [];
    return client?.messages || [];
  }, [isAdmin, isDelivery, admin?.messages, client?.messages, delivery?.messages]);
  const isLoading = isDelivery ? Boolean(delivery?.loading) : (isAdmin ? Boolean(admin?.messagesLoading) : Boolean(client?.isLoading));
  const adminTyping = isDelivery ? Boolean(delivery?.typingClient) : (isAdmin ? Boolean(admin?.typingClient) : Boolean(client?.adminTyping));
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

  useEffect(() => { onShowJumpChange && onShowJumpChange(Boolean(showJump)); }, [showJump, onShowJumpChange]);
  useEffect(() => { onScrollToBottomReady && onScrollToBottomReady(scrollToBottom); }, [scrollToBottom, onScrollToBottomReady]);

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
    <div
      ref={listRef}
      onScroll={onListScroll}
      className={`h-full min-h-0 w-full max-w-full relative overflow-y-auto overflow-x-visible p-3 pr-1 md:pr-2 space-y-5 rounded-lg break-words ${className || ''}`}
    >
      {isLoading && (messages?.length || 0) === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm animate-pulse">{(t && t('chat.loading')) || 'Conectando con la Matrix...'}</p>
      ) : (messages?.length || 0) === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm">{(t && t('chat.no_messages')) || 'Todo tranquilo por aquí...'}</p>
      ) : (
        messages.map((m, idx) => {
          const type = m?.payload?.type;
          const ts = (() => { try { return new Date(m?.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })();
          const isAssistant = (m?.role || '').toLowerCase() === 'assistant';
          const isMe = (m?.role || '').toLowerCase() === 'user'; 

          const participant = (() => {
            if (isAssistant) return { name: isDelivery ? 'La Nonna 🍕' : 'La Nonna', role: 'assistant' };
            if (isMe && !isAdmin && myProfile) {
               return {
                 name: myProfile.profile?.name || myProfile.name || 'Tú',
                 avatar_url: myProfile.profile?.profile_image_url || myProfile.profile_image_url,
                 wallet: myProfile.wallet || myProfile.address,
                 profile: myProfile.profile
               };
            }
            let found = null;
            if (participants && participants.length > 0) {
              const byWallet = m?.sender_wallet && participants.find(p => (p.wallet || '').toLowerCase() === (m.sender_wallet || '').toLowerCase());
              if (byWallet) found = byWallet;
              if (!found) {
                const byPrivy = m?.sender_privy_id && participants.find(p => (p.privy_id || '') === (m.sender_privy_id || ''));
                if (byPrivy) found = byPrivy;
              }
            }
            const dn = m?.sender_name || (found?.name || found?.display_name || 'Usuario');
            const av = m?.sender_avatar_url || found?.profile_image_url || found?.avatar_url || '';
            return found || { wallet: m?.sender_wallet, display_name: dn, name: dn, avatar_url: av, role: m?.role };
          })();

          const displayName = participant.name || participant.display_name || 'Usuario';
          const avatarUrl = participant.avatar_url || participant.profile_image_url;

          return (
            <MessageBubble key={idx} role={m.role || 'bot'}>
              <div className="flex items-start gap-3 mb-1 w-full max-w-full">
                <ChatAvatar 
                  url={avatarUrl} 
                  name={displayName} 
                  isAssistant={isAssistant} 
                  onClick={() => !isAssistant && handleShowProfile(participant)} 
                />
                
                <div className="flex-1 min-w-0 max-w-full overflow-x-hidden">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <button className="truncate text-xs font-bold text-light-text-primary dark:text-dark-text-primary hover:underline" onClick={() => !isAssistant && handleShowProfile(participant)} title={displayName} disabled={isAssistant}>{displayName}</button>
                    <span className="shrink-0 text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary opacity-70">{ts}</span>
                  </div>
                  
                  {/* --- CONTENT SWITCHER --- */}
                  {/* 1. PRODUCT CARD (Con texto abajo si existe) */}
                  {type === 'product_card' && m?.payload?.product ? (
                    <div className="flex flex-col gap-3 w-full">
                       <ProductCard product={m.payload.product} recipe={m?.payload?.recipe} />
                       {m.payload.assistant_text && (
                         <div className="px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
                            <MessageText role={m.role || 'bot'} text={m.payload.assistant_text} />
                         </div>
                       )}
                    </div>
                  )

                  : type === 'product_list' && Array.isArray(m?.payload?.items) ? (<ProductList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />)
                  : type === 'location_card' && m?.payload?.location ? (<LocationCard location={m.payload.location} />)
                  : type === 'location_list' && Array.isArray(m?.payload?.items) ? (<LocationList query={m?.payload?.query} total={m?.payload?.total} shown={m?.payload?.shown} items={m?.payload?.items} />)
                  : type === 'club_section' && m?.payload ? (<ClubSectionCard payload={m.payload} />)
                  : type === 'history_timeline' && m?.payload ? (<HistoryTimeline payload={m.payload} />)
                  
                  // 2. DATA TABLE (Con texto abajo si existe)
                  : type === 'data_table' && m?.payload ? (() => {
                      const payload = m.payload || {};
                      const rows = payload.rows || [];
                      const intent = (payload.intent || '').toLowerCase();
                      const meta = payload.meta || {};
                      
                      const hasImageInRows = Array.isArray(rows) && rows.some(r => typeof r?.image_url === 'string' && r.image_url);
                      const hasImageColumn = (payload.columns || []).some(c => c.key === 'image_url' || c.format === 'image');
                      const columns = hasImageInRows && !hasImageColumn
                        ? ([{ key: 'image_url', label: '', type: 'text', align: 'left', format: 'image', round: true }, ...(payload.columns || [])])
                        : (payload.columns || []);

                      return (
                        <div className="flex flex-col gap-3 w-full">
                          <DataTable
                            title={payload.title}
                            subtitle={payload.subtitle}
                            kpis={payload.kpis}
                            columns={columns}
                            rows={rows}
                            totals={payload.totals}
                            charts={payload.charts}
                            compact={true}
                            onRowClick={(row) => {
                              if (intent === 'ventas_hora') { setSalaryRow({ row, columns, kpis: payload.kpis, intent }); setSalaryOpen(true); return; }
                              if (intent === 'sueldos') {
                                const groupBy = String(meta.group_by || '').toLowerCase();
                                if (groupBy === 'sigla' && row && Array.isArray(row.detail_rows)) { setSueldosPayload({ title: row.detail_title || `Detalle · ${row.group}`, columns: row.detail_columns, rows: row.detail_rows, kpis: payload.kpis }); setSueldosOpen(true); return; }
                                if (groupBy.includes('rut') || row?.rut) { setSalaryRow({ row, columns, kpis: payload.kpis, intent, meta }); setSalaryOpen(true); return; }
                              }
                              if ((payload.title||'').toLowerCase().includes('consumo')) { setConsumoRow({ row, columns, kpis: payload.kpis }); setConsumoOpen(true); return; }
                              if (row && (row.code || row.image_url || (payload.title||'').toLowerCase().includes('producto'))) { setProductRow(row); setProductPayload(payload); setProductOpen(true); return; }
                              if (row && (row.worker || row.profile_image_url)) { setSalaryRow(row); setSalaryOpen(true); }
                            }}
                          />
                          {payload.assistant_text && (
                            <div className="px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
                               <MessageText role={m.role || 'bot'} text={payload.assistant_text} />
                            </div>
                          )}
                        </div>
                      );
                    })()
                    
                    : (<MessageText role={m.role || 'bot'} text={m.text || m.message || ''} optimistic={m.optimistic} />)}
                </div>
              </div>
            </MessageBubble>
          );
        })
      )}
      
      {adminTyping && (
        <div className="mt-2 ml-14 text-xs italic text-matrix-green/80 animate-pulse flex items-center gap-2">
           <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{animationDelay:'0ms'}}></span>
           <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{animationDelay:'150ms'}}></span>
           <span className="w-1.5 h-1.5 bg-matrix-green rounded-full animate-bounce" style={{animationDelay:'300ms'}}></span>
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