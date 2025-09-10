// src/pages/chat/chat.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaWallet, FaInfoCircle } from 'react-icons/fa';
import ChatMessage from './components/message/ChatMessage';
import ChatHeader from './components/common/ChatHeader';
import ChatFooter from './components/common/ChatFooter';
import ChatSidebar from './components/common/ChatSidebar';
import useChatClient from '../../hooks/useChatClient';
import useAdminChat from '../../hooks/useAdminChat';
import useRestaurantData from '../../hooks/useRestaurantData';

const ChatPage = ({ appState }) => {
  const { t } = useTranslation();
  const adminLevel = useMemo(() => (appState?.companyRoleLevel ?? appState?.roleLevel ?? 0), [appState?.companyRoleLevel, appState?.roleLevel]);
  const isAdmin = (adminLevel === 3 || adminLevel === 4) || appState?.isAdmin === true;
  const [activeTab, setActiveTab] = useState(() => (isAdmin ? 'admin' : 'client'));
  const msgClient = useChatClient({ appState, accessToken: appState?.token, account: appState?.account });
  const adminState = useAdminChat({ appState, enabled: isAdmin });
  const { data: restaurantData } = useRestaurantData();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showJumpClient, setShowJumpClient] = useState(false);
  const [showJumpAdmin, setShowJumpAdmin] = useState(false);
  const [clientScrollToBottom, setClientScrollToBottom] = useState(null);
  const [adminScrollToBottom, setAdminScrollToBottom] = useState(null);

  const hasIdentity = Boolean(appState?.token || appState?.account);

  const {
    conversations: pageClientConversations = [],
    loadConversations: pageLoadClientConversations,
  } = useChatClient({ appState, accessToken: appState?.token, account: appState?.account, restoreOnMount: false });

  useEffect(() => {
    if (hasIdentity) {
      pageLoadClientConversations?.();
    }
  }, [hasIdentity, pageLoadClientConversations]);

  useEffect(() => {
    if (hasIdentity && !msgClient?.convId) {
      msgClient?.initSession?.().catch(() => { });
    }
  }, [hasIdentity, msgClient?.convId, msgClient?.initSession]);

  // Helper: check if profile is complete (customize required fields as needed)
  function isProfileComplete(profile) {
    if (!profile) return false;
    return Boolean(profile.name && profile.email && profile.birthdate);
  }
  const isProfileCompleteFlag = useMemo(() => isProfileComplete(appState?.profile), [appState?.profile]);

  // ProfileGate component (informational only; relies on appState.profile)
  const ProfileGate = () => (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-semibold mb-2">
          <FaInfoCircle className="text-matrix-green" /> {t('chat.profile_required_title') || '¡Llena tu perfil para hablar con la Nonna!'}
        </div>
        <p className="text-sm opacity-80 mb-2">
          {t('chat.profile_required_desc') || 'Completa tus datos de perfil (nombre, email, sucursal favorita, cumpleaños) para poder chatear y recibir recomendaciones personalizadas.'}
        </p>
      </div>
    </div>
  );

  // GATE: Only registered users (authenticated + wallet) can chat with Nonna
  const isAuthenticated = Boolean(appState?.isAuthenticated || appState?.token);
  const hasWallet = Boolean(appState?.account);

  const Gate = () => (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 p-4 sm:p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-base sm:text-lg font-semibold mb-2">
          <FaInfoCircle className="text-matrix-green" /> {t('chat.auth_required_title') || 'Solo usuarios registrados pueden hablar con la Nonna'}
        </div>
        <p className="text-sm opacity-80 mb-4">
          {t('chat.auth_required_desc') || 'Conéctate o crea tu billetera para empezar a chatear y recibir recomendaciones personalizadas.'}
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
          {!isAuthenticated && (
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-matrix-green text-dark-bg font-semibold flex items-center justify-center gap-2"
              onClick={() => appState?.connectWallet?.(appState)}
            >
              <FaWallet /> {t('wallet.connect') || t('missions.connect_wallet_cta') || 'Connect Wallet'}
            </button>
          )}
          {isAuthenticated && !hasWallet && (
            <button
              type="button"
              className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-light-text border border-white/10 flex items-center justify-center gap-2"
              onClick={async () => { await appState?.createWalletOnDemand?.(); appState?.openWalletModal?.(); }}
            >
              <FaWallet /> {t('missions.create_wallet_cta') || 'Create Wallet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div className="fixed top-16 bottom-16 left-0 right-0 pointer-events-none">
        <motion.div
          className="w-full h-full max-w-6xl mx-auto px-3 sm:px-4 overflow-hidden flex flex-col pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {/* Header sticky inside container */}
          <div className="sticky top-0 bg-transparent">
            <ChatHeader
              variant={isAdmin ? 'admin' : 'client'}
              title={isAdmin ? (activeTab === 'admin' ? (t('chat.admin_title') || 'Admin Chat') : (t('chat.title') || 'Chat')) : (t('chat.title') || 'Chat')}
              connected={isAdmin ? (activeTab === 'admin' ? adminState.connected : msgClient.connected) : msgClient.connected}
              status={!isAdmin || activeTab === 'client' ? msgClient.status : undefined}
              onOpenInbox={isAdmin && activeTab === 'admin' ? (() => setShowSidebar(v => !v)) : undefined}
              onOpenConversations={!isAdmin || activeTab === 'client' ? (() => setShowSidebar(v => !v)) : undefined}
              unreadInboxCount={isAdmin ? (adminState.unreadInboxCount || 0) : (msgClient.unreadCount || 0)}
              rightContent={isAdmin ? (
                <div className="flex rounded-md overflow-hidden border border-white/10">
                  <button className={`px-3 py-1.5 text-sm ${activeTab === 'client' ? 'bg-matrix-green text-dark-bg' : 'bg-white/5 text-light-text'}`} onClick={() => setActiveTab('client')}>
                    {t('chat.client_tab') || 'Client'}
                  </button>
                  <button className={`px-3 py-1.5 text-sm ${activeTab === 'admin' ? 'bg-matrix-green text-dark-bg' : 'bg-white/5 text-light-text'}`} onClick={() => setActiveTab('admin')}>
                    {t('chat.admin_tab') || 'Admin'}
                  </button>
                </div>
              ) : undefined}
            />
          </div>

          {/* Middle content area flexes between header and footer */}
          <div className="flex-1 min-h-0 w-full max-w-full overflow-hidden">
            <div className={`h-full min-h-0 grid grid-cols-1 ${showSidebar ? 'md:grid-cols-[28%_1fr]' : 'md:grid-cols-1'} gap-4`}>
              {showSidebar && (
                <aside className="hidden md:block h-full min-h-0">
                  <div className="h-full w-full">
                    <ChatSidebar
                      variant={isAdmin && activeTab === 'admin' ? 'admin' : 'client'}
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
                            // Refresh both lists
                            await msgClient.loadConversations?.();
                            await pageLoadClientConversations?.();
                            // Optionally focus new conversation (already active via initSession)
                            if (newId) {
                              // No-op: msgClient.convId should be newId already
                            }
                          } catch (_) { }
                        },
                      }}
                    />
                  </div>
                </aside>
              )}
              <main className="h-full min-h-0">
                <div className="h-full w-full">
                  {(!isAdmin && (!isAuthenticated || !hasWallet)) ? (
                    <Gate />
                  ) : (
                    <ChatMessage
                      variant={isAdmin && activeTab === 'admin' ? 'admin' : 'client'}
                      appState={appState} t={t} client={msgClient} admin={adminState} mediaMap={restaurantData?.mediaMap || {}}
                      allProducts={restaurantData?.allLocationMenus || []} locations={restaurantData?.locations || []}
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
                </div>
              </main>
            </div>
          </div>

          {/* Footer sticky inside container */}
          <div className="sticky bottom-0 bg-transparent">
            {(!isAdmin && (!isAuthenticated || !hasWallet)) ? (
              <div className="px-3 py-2 text-center text-xs opacity-80">
                {t('chat.auth_required_footer') || 'Conéctate o crea tu billetera para enviar mensajes.'}
              </div>
            ) : (
              <ChatFooter
                variant={isAdmin && activeTab === 'admin' ? 'admin' : 'client'}
                t={t}
                clientDisabled={msgClient.isClosed}
                onClientSend={(text) => msgClient?.sendMessage && text ? msgClient.sendMessage({ text }) : undefined}
                onClientTyping={(state) => msgClient?.setTyping && msgClient.setTyping(Boolean(state))}
                clientProfileReady={true}
                onClientNew={async () => {
                  try {
                    msgClient.resetSession?.();
                    const newId = await msgClient.initSession?.({ metadata: { force_new: true } });
                    await msgClient.loadConversations?.();
                    await pageLoadClientConversations?.();
                    if (newId) {
                      // already active
                    }
                  } catch (_) { }
                }}
                adminConvId={adminState.activeConvId} adminDisabled={!appState?.isAuthenticated}
                onAdminReply={adminState.reply} onAdminTake={adminState.take} onAdminRelease={adminState.release} onAdminClose={adminState.closeConv} onAdminTyping={adminState.notifyTyping}
                showJump={(isAdmin && activeTab === 'admin') ? showJumpAdmin : showJumpClient}
                onJump={(isAdmin && activeTab === 'admin') ? adminScrollToBottom : clientScrollToBottom}
              />
            )}
          </div>

          {/* Mobile Sidebar Drawer (no cambia) */}
          {showSidebar && (
            <>
              <motion.button aria-label="Close sidebar" className="md:hidden fixed top-16 bottom-16 left-0 right-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSidebar(false)} />
              <motion.aside className="md:hidden fixed top-16 bottom-16 left-0 w-[88vw] max-w-sm p-3 bg-light-surface-secondary border-r border-light-border/60 dark:bg-dark-surface-secondary dark:border-dark-border/60 shadow-2xl z-50" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold">{(t && t('chat.conversations')) || 'Conversations'}</h3>
                  <button className="px-2 py-1 text-xs rounded bg-light-surface-tertiary/60 border border-light-border/60 hover:bg-light-surface-tertiary/80 dark:bg-dark-surface-tertiary/60 dark:border-dark-border/60 dark:hover:bg-dark-surface-tertiary/80" onClick={() => setShowSidebar(false)}>{t('chat.close') || 'Close'}</button>
                </div>
                <div className="h-[calc(100%-40px)] overflow-auto pr-1 md:pr-2">
                  <ChatSidebar
                    variant={isAdmin && activeTab === 'admin' ? 'admin' : 'client'} t={t}
                    admin={{
                      items: adminState.items, loading: adminState.loading, page: adminState.page, pageSize: adminState.pageSize, statusFilter: adminState.statusFilter, onChangePage: adminState.setPage,
                      onChangePageSize: adminState.setPageSize, onChangeStatus: adminState.setStatusFilter, onOpen: (id) => { adminState.openConversation && adminState.openConversation(id); setShowSidebar(false); },
                      activeConvId: adminState.activeConvId,
                    }}
                    client={{
                      conversations: pageClientConversations, convosLoading: false, openConversation: (id) => { msgClient.openConversation && msgClient.openConversation(id); setShowSidebar(false); },
                      activeConvId: msgClient.convId, unreadCount: msgClient.unreadCount,
                      onNew: async () => {
                        try {
                          await msgClient.resetSession?.();
                          const newId = await msgClient.initSession?.({ metadata: { force_new: true } });
                          await msgClient.loadConversations?.();
                          await pageLoadClientConversations?.();
                        } finally {
                          setShowSidebar(false);
                        }
                      },
                    }}
                  />
                </div>
              </motion.aside>
            </>
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
  category: 'club.category',
  minRoleLevel: -1,
  order: 99,
  orderWalletMenu: 2,
  orderFooter: 1,
  locations: ['walletMenu', 'footer'],
  description: 'chat.description',
  icon: 'FaComments',
  isMainPage: false,
  isSearchable: true,
};

export default ChatPage;