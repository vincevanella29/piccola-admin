import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaWallet, FaTimes } from 'react-icons/fa';
import CommunityTab from './components/community/CommunityTab';

// Componentes Locales
import ChatMessage from './components/message/ChatMessage';
import DeliveryChatMessage from './components/message/DeliveryChatMessage';
import ChatHeader from './components/common/ChatHeader';
import ChatFooter from './components/common/ChatFooter';
import ChatSidebar from './components/common/ChatSidebar';

// Hooks
import useChatClient from '../../hooks/useChatClient';
import useAdminChat from '../../hooks/useAdminChat';
import useDeliveryChatAdmin from '../../hooks/delivery/useDeliveryChatAdmin';
import useRestaurantData from '../../hooks/useRestaurantData';

// Estilo de la ventana flotante (Glassmorphism)
const WINDOW_GLASS = "backdrop-blur-2xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/40 dark:border-dark-border/40 shadow-2xl";

// IMPORTANTE: Recibimos 'sidebarWidth' para calcular la posición
const ChatPage = ({ appState, sidebarWidth = 80 }) => {
  const { t } = useTranslation();
  
  const adminLevel = useMemo(() => (appState?.companyRoleLevel ?? appState?.roleLevel ?? 0), [appState?.companyRoleLevel, appState?.roleLevel]);
  const isAdmin = (adminLevel === 3 || adminLevel === 4) || appState?.isAdmin === true;
  const canDelivery = adminLevel >= 3 && adminLevel <= 6;
  const canCommunity = adminLevel >= 3 && adminLevel <= 7;
  const [activeTab, setActiveTab] = useState(() => {
    if (isAdmin) return 'admin';
    if (canCommunity && !isAdmin) return 'community';
    return 'client';
  });

  const msgClient = useChatClient({ appState, accessToken: appState?.token, account: appState?.account });
  const adminState = useAdminChat({ appState, enabled: isAdmin });
  const deliveryChat = useDeliveryChatAdmin({ appState, enabled: canDelivery && activeTab === 'delivery' });
  const { data: restaurantData } = useRestaurantData();

  const [showSidebar, setShowSidebar] = useState(false);
  const [showJumpClient, setShowJumpClient] = useState(false);
  const [showJumpAdmin, setShowJumpAdmin] = useState(false);
  const [clientScrollToBottom, setClientScrollToBottom] = useState(null);
  const [adminScrollToBottom, setAdminScrollToBottom] = useState(null);
  const [deliveryScrollToBottom, setDeliveryScrollToBottom] = useState(null);
  const [showJumpDelivery, setShowJumpDelivery] = useState(false);

  // Detectar si es Desktop para aplicar el margen dinámico
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasIdentity = Boolean(appState?.token || appState?.account);
  const {
    conversations: pageClientConversations = [],
    loadConversations: pageLoadClientConversations,
  } = useChatClient({ appState, accessToken: appState?.token, account: appState?.account, restoreOnMount: false });

  useEffect(() => { if (hasIdentity) pageLoadClientConversations?.(); }, [hasIdentity, pageLoadClientConversations]);
  useEffect(() => { if (hasIdentity && !msgClient?.convId) msgClient?.initSession?.().catch(() => { }); }, [hasIdentity, msgClient?.convId, msgClient?.initSession]);

  const isAuthenticated = Boolean(appState?.isAuthenticated || appState?.token);
  const hasWallet = Boolean(appState?.account);

  // Componente Gate (Bloqueo si no hay login)
  const Gate = () => (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="max-w-sm w-full p-8 rounded-[32px] bg-light-surface/80 dark:bg-dark-surface/80 border border-light-border dark:border-dark-border text-center shadow-xl backdrop-blur-md">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/10 flex items-center justify-center text-light-accent dark:text-dark-accent shadow-neon">
           <FaWallet size={28} />
        </div>
        <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
           {t('chat.auth_required_title') || 'Acceso Restringido'}
        </h3>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6 leading-relaxed">
          {t('chat.auth_required_desc') || 'Para chatear con la Nonna y recibir asistencia, necesitas conectar tu wallet.'}
        </p>
        <div className="space-y-3">
          {!isAuthenticated ? (
            <button onClick={() => appState?.connectWallet?.(appState)} className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-bold shadow-lg hover:scale-105 transition-transform">
               {t('wallet.connect') || 'Conectar Wallet'}
            </button>
          ) : !hasWallet ? (
             <button onClick={async () => { await appState?.createWalletOnDemand?.(); appState?.openWalletModal?.(); }} className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-bold shadow-lg hover:scale-105 transition-transform">
               {t('missions.create_wallet_cta') || 'Crear Wallet'}
             </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {/* CONTENEDOR PRINCIPAL FLOTANTE
        - top-[100px]: Espacio para el Header
        - bottom-[100px]: Espacio para el Footer
        - left: Dinámico (sidebarWidth + 32px de margen)
        - transition-[left]: Animación suave cuando el sidebar crece/achica
      */}
      <div 
         className="fixed top-[100px] bottom-[100px] z-40 flex justify-center pointer-events-none transition-[left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
         style={{
            left: isDesktop ? `${sidebarWidth + 32}px` : '16px',
            right: isDesktop ? '32px' : '16px',
         }}
      >
        <motion.div
          className={`w-full h-full flex flex-col overflow-hidden rounded-[32px] pointer-events-auto ${WINDOW_GLASS}`}
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.15 }}
        >
          
          {/* --- HEADER (Dentro de la ventana) --- */}
          <div className="shrink-0 z-20">
            <ChatHeader
              variant={activeTab === 'delivery' ? 'admin' : (isAdmin ? 'admin' : 'client')}
              title={activeTab === 'delivery' ? 'Delivery 🍕' : (isAdmin ? (activeTab === 'admin' ? 'Panel de Comando' : 'Vista Cliente') : (t('chat.title') || 'Chat Soporte'))}
              connected={activeTab === 'delivery' ? deliveryChat.connected : (isAdmin ? (activeTab === 'admin' ? adminState.connected : msgClient.connected) : msgClient.connected)}
              status={activeTab === 'delivery' ? (deliveryChat.connected ? 'Online' : 'Offline') : (!isAdmin || activeTab === 'client' ? msgClient.status : 'Online')}
              onOpenInbox={(activeTab === 'admin' || activeTab === 'delivery') ? (() => setShowSidebar(v => !v)) : undefined}
              onOpenConversations={!isAdmin || activeTab === 'client' ? (() => setShowSidebar(v => !v)) : undefined}
              unreadInboxCount={activeTab === 'delivery' ? (deliveryChat.items?.reduce((s, i) => s + (i.unread || 0), 0) || 0) : (isAdmin ? (adminState.unreadInboxCount || 0) : (msgClient.unreadCount || 0))}
              rightContent={(isAdmin || canCommunity) && (
                <div className="flex p-1 rounded-xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 border border-light-border/50 dark:border-dark-border/50">
                  <button 
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'client' ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm' : 'text-light-text-tertiary hover:text-light-text-primary'}`} 
                    onClick={() => setActiveTab('client')}
                  >Client</button>
                  {isAdmin && (
                    <button 
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'admin' ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm' : 'text-light-text-tertiary hover:text-light-text-primary'}`} 
                      onClick={() => setActiveTab('admin')}
                    >Admin</button>
                  )}
                  {canDelivery && (
                    <button 
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'delivery' ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm' : 'text-light-text-tertiary hover:text-light-text-primary'}`} 
                      onClick={() => setActiveTab('delivery')}
                    >Delivery 🍕</button>
                  )}
                  {canCommunity && (
                    <button 
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${activeTab === 'community' ? 'bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-sm' : 'text-light-text-tertiary hover:text-light-text-primary'}`} 
                      onClick={() => setActiveTab('community')}
                    >Community 🍝</button>
                  )}
                </div>
              )}
            />
          </div>

          {/* --- MAIN CONTENT (Sidebar Interno + Chat) --- */}
          <div className="flex-1 min-h-0 flex relative">
            <AnimatePresence>
              {showSidebar && activeTab !== 'community' && (
                <motion.aside 
                  initial={{ width: 0, opacity: 0 }} 
                  animate={{ width: 300, opacity: 1 }} 
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="hidden md:block h-full border-r border-light-border/50 dark:border-dark-border/50 bg-light-surface-secondary/30 dark:bg-black/10 backdrop-blur-md"
                >
                   <div className="w-[300px] h-full overflow-hidden">
                    <ChatSidebar
                      variant={activeTab === 'delivery' ? 'delivery' : (isAdmin && activeTab === 'admin' ? 'admin' : 'client')}
                      t={t}
                      admin={{
                        items: adminState.items, loading: adminState.loading, page: adminState.page, pageSize: adminState.pageSize, statusFilter: adminState.statusFilter,
                        onChangePage: adminState.setPage, onChangePageSize: adminState.setPageSize, onChangeStatus: adminState.setStatusFilter,
                        onOpen: adminState.openConversation, activeConvId: adminState.activeConvId,
                      }}
                      client={{
                        conversations: pageClientConversations, convosLoading: false, openConversation: msgClient.openConversation,
                        activeConvId: msgClient.convId, unreadCount: msgClient.unreadCount,
                        onNew: async () => {
                           try {
                            await msgClient.resetSession?.();
                            const newId = await msgClient.initSession?.({ metadata: { force_new: true } });
                            await msgClient.loadConversations?.();
                            await pageLoadClientConversations?.();
                           } catch (_) {}
                        }
                      }}
                      delivery={{
                        items: deliveryChat.items, loading: deliveryChat.loading, statusFilter: deliveryChat.statusFilter,
                        onChangeStatus: deliveryChat.setStatusFilter,
                        onOpen: (orderNumber) => { deliveryChat.openConversation(orderNumber); setShowSidebar(false); },
                        activeOrderNumber: deliveryChat.activeOrderNumber,
                      }}
                    />
                   </div>
                </motion.aside>
              )}
            </AnimatePresence>

            <main className="flex-1 h-full relative min-w-0 bg-light-surface/30 dark:bg-dark-surface/30">
               {activeTab === 'community' ? (
                  <CommunityTab appState={appState} />
               ) : (!isAdmin && (!isAuthenticated || !hasWallet)) ? (
                  <Gate />
               ) : activeTab === 'delivery' ? (
                  <DeliveryChatMessage
                    appState={appState} t={t}
                    delivery={deliveryChat}
                    onShowJumpChange={(v) => setShowJumpDelivery(Boolean(v))}
                    onScrollToBottomReady={(fn) => { if (typeof fn === 'function') setDeliveryScrollToBottom(() => fn); }}
                  />
               ) : (
                  <ChatMessage
                    variant={isAdmin && activeTab === 'admin' ? 'admin' : 'client'}
                    appState={appState} t={t} 
                    client={msgClient} admin={adminState}
                    mediaMap={restaurantData?.mediaMap || {}}
                    allProducts={restaurantData?.allLocationMenus || []} 
                    locations={restaurantData?.locations || []}
                    onShowJumpChange={(v) => {
                      if (isAdmin && activeTab === 'admin') setShowJumpAdmin(Boolean(v));
                      else setShowJumpClient(Boolean(v));
                    }}
                    onScrollToBottomReady={(fn) => {
                      if (typeof fn !== 'function') return;
                      if (isAdmin && activeTab === 'admin') setAdminScrollToBottom(() => fn);
                      else setClientScrollToBottom(() => fn);
                    }}
                  />
               )}
            </main>

            {/* Sidebar Mobile Overlay */}
            <AnimatePresence>
              {showSidebar && activeTab !== 'community' && (
                <motion.aside 
                  initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute inset-y-0 left-0 w-full max-w-[320px] md:hidden z-30 bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border shadow-2xl"
                >
                   <div className="h-full flex flex-col">
                      <div className="p-4 border-b border-light-border/50 dark:border-dark-border/50 flex justify-between items-center">
                         <span className="font-bold text-sm uppercase tracking-wider">{t('chat.conversations')}</span>
                         <button onClick={() => setShowSidebar(false)} className="p-2 rounded-full hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary"><FaTimes /></button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <ChatSidebar
                          variant={activeTab === 'delivery' ? 'delivery' : (isAdmin && activeTab === 'admin' ? 'admin' : 'client')} t={t}
                          admin={{
                            ...adminState, 
                            onOpen: (id) => { adminState.openConversation(id); setShowSidebar(false); }
                          }}
                          client={{
                            conversations: pageClientConversations, convosLoading: false, 
                            activeConvId: msgClient.convId, unreadCount: msgClient.unreadCount,
                            openConversation: (id) => { msgClient.openConversation(id); setShowSidebar(false); },
                            onNew: async () => {
                               try {
                                await msgClient.resetSession?.();
                                await msgClient.initSession?.({ metadata: { force_new: true } });
                                await pageLoadClientConversations?.();
                                setShowSidebar(false);
                               } catch (_) {}
                            }
                          }}
                          delivery={{
                            items: deliveryChat.items, loading: deliveryChat.loading, statusFilter: deliveryChat.statusFilter,
                            onChangeStatus: deliveryChat.setStatusFilter,
                            onOpen: (orderNumber) => { deliveryChat.openConversation(orderNumber); setShowSidebar(false); },
                            activeOrderNumber: deliveryChat.activeOrderNumber,
                          }}
                        />
                      </div>
                   </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>

          {/* --- FOOTER (Dentro de la ventana) — hidden for Community tab (has its own input) --- */}
          {activeTab !== 'community' && (
            (!isAdmin && (!isAuthenticated || !hasWallet)) ? (
              <div className="px-4 py-3 text-center text-[10px] font-medium opacity-50 border-t border-light-border/30 dark:border-dark-border/30 uppercase tracking-widest">
                Acceso de lectura restringido
              </div>
            ) : (
              <div className="shrink-0 z-20">
                <ChatFooter
                  variant={activeTab === 'delivery' ? 'delivery' : (isAdmin && activeTab === 'admin' ? 'admin' : 'client')}
                  t={t}
                  clientDisabled={msgClient.isClosed}
                  clientProfileReady={true}
                  onClientSend={(text) => msgClient?.sendMessage && text ? msgClient.sendMessage({ text }) : undefined}
                  onClientTyping={(state) => msgClient?.setTyping && msgClient.setTyping(Boolean(state))}
                  onClientNew={async () => {
                    try {
                      msgClient.resetSession?.();
                      await msgClient.initSession?.({ metadata: { force_new: true } });
                      await msgClient.loadConversations?.();
                      await pageLoadClientConversations?.();
                    } catch (_) { }
                  }}
                  adminConvId={activeTab === 'delivery' ? deliveryChat.activeOrderNumber : adminState.activeConvId} 
                  adminDisabled={!appState?.isAuthenticated}
                  onAdminReply={activeTab === 'delivery' ? deliveryChat.reply : adminState.reply} 
                  onAdminTake={activeTab === 'delivery' ? deliveryChat.take : adminState.take} 
                  onAdminRelease={activeTab === 'delivery' ? deliveryChat.release : adminState.release} 
                  onAdminClose={activeTab === 'delivery' ? deliveryChat.closeConv : adminState.closeConv} 
                  onAdminReopen={activeTab === 'delivery' ? deliveryChat.reopenConv : undefined}
                  onAdminTyping={activeTab === 'delivery' ? deliveryChat.notifyTyping : adminState.notifyTyping}
                  isClosed={activeTab === 'delivery' ? deliveryChat.chatState?.status === 'closed' : false}
                  showJump={activeTab === 'delivery' ? showJumpDelivery : ((isAdmin && activeTab === 'admin') ? showJumpAdmin : showJumpClient)}
                  onJump={activeTab === 'delivery' ? deliveryScrollToBottom : ((isAdmin && activeTab === 'admin') ? adminScrollToBottom : clientScrollToBottom)}
                  onUpload={async (file) => {
                    if (activeTab === 'delivery' && deliveryChat.uploadMedia) {
                      return await deliveryChat.uploadMedia(file);
                    }
                    return null;
                  }}
                />
              </div>
            )
          )}

        </motion.div>
      </div>
    </>,
    document.body
  );
};

export const pageMetadata = {
  path: '/app/chat',
  label: 'chat.title',
  category: 'marketing.category',
  minRoleLevel: 3,
  maxRoleLevel: 7,
  order: 3,
  orderWalletMenu: 3,
  orderFooter: 3,
  locations: ['walletMenu', 'sidebar', 'footer'],
  description: 'chat.description',
  icon: 'FaComments',
  isSearchable: true,
};

export default ChatPage;