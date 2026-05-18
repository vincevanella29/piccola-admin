// src/pages/chat/chat.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaWallet, FaTimes, FaChevronDown } from 'react-icons/fa';
import { ArrowDown, UserCheck, UserX, XCircle } from 'lucide-react';
import CommunityTab from './components/community/CommunityTab';

// Componentes Locales
import CustomerMessagePane from './components/customers/CustomerMessagePane';
import ChatHeader from './components/common/ChatHeader';
import ChatInput from './components/common/ChatInput';
import CustomersSidebar from './components/customers/CustomersSidebar';

// Hooks
import useCustomersChat from '../../hooks/useCustomersChat';

// Estilo de la ventana flotante (Glassmorphism Apple Style)
const WINDOW_GLASS = "backdrop-blur-3xl bg-light-surface/40 dark:bg-dark-surface/30 border-light-border/20 dark:border-dark-border/10 shadow-2xl transition-all duration-300";

const ChatPage = ({ appState, sidebarWidth = 80 }) => {
  const { t } = useTranslation();
  
  const adminLevel = useMemo(() => (appState?.companyRoleLevel ?? appState?.roleLevel ?? 0), [appState?.companyRoleLevel, appState?.roleLevel]);
  const canCustomers = adminLevel >= 3 && adminLevel <= 7;
  
  const [activeTab, setActiveTab] = useState(canCustomers ? 'customers' : 'community');
  
  const customersChat = useCustomersChat({ appState });

  const [showSidebar, setShowSidebar] = useState(false);
  const [showContextSelector, setShowContextSelector] = useState(false);
  
  const [deliveryScrollToBottom, setDeliveryScrollToBottom] = useState(null);
  const [showJumpDelivery, setShowJumpDelivery] = useState(false);
  const [whatsappScrollToBottom, setWhatsappScrollToBottom] = useState(null);
  const [showJumpWhatsapp, setShowJumpWhatsapp] = useState(false);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAuthenticated = Boolean(appState?.isAuthenticated || appState?.token);
  const hasWallet = Boolean(appState?.account);

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
          Para acceder a los mensajes, necesitas conectar tu wallet.
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

  const activeProvider = customersChat.activeConversation?.provider;
  const activeId = customersChat.activeConversation?.id;
  const isDeliveryActive = activeProvider === 'delivery';
  const isWhatsappActive = activeProvider === 'whatsapp';

  return (
    <div 
      className={`flex justify-center items-center transition-all duration-500 ease-in-out w-full fixed md:relative z-[45] md:z-auto p-0 md:p-4 lg:p-6`}
      style={{
        top: isDesktop ? 'auto' : '90px',
        bottom: isDesktop ? 'auto' : '96px',
        left: isDesktop ? 'auto' : '16px',
        right: isDesktop ? 'auto' : '16px',
        width: isDesktop ? '100%' : 'auto',
        height: isDesktop ? 'calc(100vh - 180px)' : 'auto',
        maxHeight: isDesktop ? '800px' : 'none'
      }}
    >
        <motion.div
          className={`w-full h-full flex flex-col overflow-hidden pointer-events-auto ${WINDOW_GLASS} ${isDesktop ? 'max-w-[1200px] rounded-[24px]' : 'rounded-3xl'} border border-light-border/20 dark:border-dark-border/20 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]`}
          initial={isDesktop ? { opacity: 0, scale: 0.98, y: 20 } : { opacity: 0, y: 50, scale: 0.95 }}
          animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', bounce: 0.15 }}
        >
          
          {/* --- HEADER --- */}
          <div className="shrink-0 z-[60] relative">
            <ChatHeader
              variant="admin"
              title={activeTab === 'customers' ? 'Customers 👥' : 'Community 🍝'}
              connected={true}
              status="Online"
              onOpenInbox={() => setShowSidebar(v => !v)}
              unreadInboxCount={
                activeTab === 'customers' 
                  ? customersChat.items.reduce((s, i) => s + (i.unread || 0), 0)
                  : 0
              }
              rightContent={
                <div className="relative">
                  <button 
                    onClick={() => setShowContextSelector(!showContextSelector)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/50 dark:border-dark-border/50 hover:opacity-80 transition-opacity text-sm font-bold"
                  >
                    <span className="truncate max-w-[100px] sm:max-w-none">
                      {activeTab === 'customers' ? 'Customers 👥' : 'Community 🍝'}
                    </span>
                    <FaChevronDown size={12} className="opacity-50" />
                  </button>

                  <AnimatePresence>
                    {showContextSelector && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowContextSelector(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-light-border/30 dark:border-dark-border/30 overflow-hidden z-50 p-1.5 flex flex-col gap-1"
                        >
                          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-light-text-tertiary">Cambiar Contexto</div>
                          
                          <button 
                            className={`flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'community' ? 'bg-light-accent/10 text-light-accent dark:bg-dark-accent/20 dark:text-dark-accent shadow-sm' : 'hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'}`} 
                            onClick={() => { setActiveTab('community'); setShowContextSelector(false); }}
                          >Community 🍝</button>
                          
                          {canCustomers && (
                            <button 
                              className={`flex items-center px-3 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'customers' ? 'bg-light-accent/10 text-light-accent dark:bg-dark-accent/20 dark:text-dark-accent shadow-sm' : 'hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary'}`} 
                              onClick={() => { setActiveTab('customers'); setShowContextSelector(false); }}
                            >Customers 👥</button>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              }
            />
          </div>

          {/* --- MAIN CONTENT --- */}
          <div className="flex-1 min-h-0 flex relative">
            <AnimatePresence>
              {showSidebar && activeTab === 'customers' && (
                <motion.aside 
                  initial={{ width: 0, opacity: 0 }} 
                  animate={{ width: 300, opacity: 1 }} 
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="hidden md:block h-full border-r border-light-border/50 dark:border-dark-border/50 bg-light-surface-secondary/30 dark:bg-black/10 backdrop-blur-md"
                >
                   <div className="w-[300px] h-full overflow-hidden p-2">
                    <CustomersSidebar
                      items={customersChat.items}
                      scopeFilter={customersChat.scopeFilter}
                      onChangeScope={customersChat.setScopeFilter}
                      onOpen={(provider, id) => {
                        customersChat.selectConversation(provider, id);
                        setShowSidebar(false);
                      }}
                      activeConversation={customersChat.activeConversation}
                    />
                   </div>
                </motion.aside>
              )}
            </AnimatePresence>

            <main className="flex-1 h-full relative min-w-0 bg-light-surface/30 dark:bg-dark-surface/30">
               {activeTab === 'community' ? (
                  <CommunityTab 
                    appState={appState} 
                    isDesktop={isDesktop} 
                    showSidebar={showSidebar} 
                    setShowSidebar={setShowSidebar} 
                  />
               ) : (!isAuthenticated || !hasWallet) ? (
                  <Gate />
               ) : isDeliveryActive ? (
                  <CustomerMessagePane
                    provider="delivery"
                    appState={appState}
                    messages={customersChat.delivery.messages}
                    chatState={customersChat.delivery.chatState}
                    onShowJumpChange={(v) => setShowJumpDelivery(Boolean(v))}
                    onScrollToBottomReady={(fn) => { if (typeof fn === 'function') setDeliveryScrollToBottom(() => fn); }}
                  />
               ) : isWhatsappActive ? (
                  <CustomerMessagePane
                    provider="whatsapp"
                    appState={appState}
                    phone={activeId}
                    messages={customersChat.activeWaMessages}
                    onShowJumpChange={(v) => setShowJumpWhatsapp(Boolean(v))}
                    onScrollToBottomReady={(fn) => { if (typeof fn === 'function') setWhatsappScrollToBottom(() => fn); }}
                  />
               ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                    <span className="text-[13px] font-bold tracking-wider">Selecciona una conversación</span>
                  </div>
               )}
            </main>

            {/* Sidebar Mobile Overlay */}
            <AnimatePresence>
              {showSidebar && activeTab === 'customers' && (
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
                      <div className="flex-1 overflow-auto p-2">
                        <CustomersSidebar
                          items={customersChat.items}
                          scopeFilter={customersChat.scopeFilter}
                          onChangeScope={customersChat.setScopeFilter}
                          onOpen={(provider, id) => {
                            customersChat.selectConversation(provider, id);
                            setShowSidebar(false);
                          }}
                          activeConversation={customersChat.activeConversation}
                        />
                      </div>
                   </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>

          {/* --- FOOTER --- */}
          {activeTab === 'customers' && activeProvider && (
            <div className="shrink-0 z-20">
              <ChatInput
                placeholder="Escribe un mensaje..."
                disabled={!appState?.isAuthenticated}
                onSend={async (text, imgUrl) => {
                  if (isDeliveryActive) {
                    await customersChat.delivery.reply(text, imgUrl);
                  } else if (isWhatsappActive) {
                    await customersChat.wa.sendMessage({
                      phone: activeId,
                      type: 'text',
                      text: text
                    });
                    const res = await customersChat.wa.fetchMessages(activeId);
                    if (res?.messages) customersChat.wa.setActiveWaMessages?.(res.messages);
                  }
                }} 
                onTyping={isDeliveryActive ? customersChat.delivery.notifyTyping : undefined}
                onUpload={async (file) => {
                  if (isDeliveryActive && customersChat.delivery.uploadMedia) {
                    return await customersChat.delivery.uploadMedia(file);
                  }
                  return null;
                }}
                topActions={
                  <>
                   <div className="flex items-center gap-1.5">
                     {isDeliveryActive && customersChat.delivery.chatState?.status === 'closed' ? (
                       <button
                         onClick={customersChat.delivery.reopenConv}
                         className="px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 text-[11px] font-bold uppercase tracking-wide transition-colors"
                       >
                         Reabrir
                       </button>
                     ) : isDeliveryActive ? (
                       <>
                         <button
                           onClick={customersChat.delivery.take}
                           className="p-2 rounded-full bg-light-success/10 dark:bg-dark-success/10 text-light-success dark:text-dark-success hover:bg-light-success/20 dark:hover:bg-dark-success/20 transition-colors"
                           title="Tomar Chat"
                         ><UserCheck size={16} /></button>
                         <button
                           onClick={customersChat.delivery.release}
                           className="p-2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
                           title="Soltar Chat"
                         ><UserX size={16} /></button>
                         <button
                           onClick={customersChat.delivery.closeConv}
                           className="p-2 rounded-full bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error hover:bg-light-error/20 dark:hover:bg-dark-error/20 transition-colors"
                           title="Cerrar Chat"
                         ><XCircle size={16} /></button>
                       </>
                     ) : null}
                   </div>
                   {(isDeliveryActive ? showJumpDelivery : showJumpWhatsapp) && (
                      <button
                        type="button"
                        onClick={isDeliveryActive ? deliveryScrollToBottom : whatsappScrollToBottom}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase rounded-full bg-light-accent dark:bg-dark-accent text-white shadow-lg animate-bounce-small ml-auto"
                      >
                         Abajo <ArrowDown size={14} />
                      </button>
                   )}
                  </>
                }
              />
            </div>
          )}

        </motion.div>
    </div>
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