// src/pages/chat/components/community/CommunityTab.jsx
// Wrapper: ServerSidebar + ChannelView/GroupView + DMs + MembersPanel
import React, { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ServerSidebar from './ServerSidebar';
import ChannelView from './ChannelView';
import MembersPanel from './MembersPanel';
import SectionPermsModal from './SectionPermsModal';
import GroupModal from './GroupModal';
import MemberProfileModal from './MemberProfileModal';
import { CreateChannelModal, DmPickerModal } from './CreateModals';
import { FaComments, FaPaperPlane, FaArrowLeft } from 'react-icons/fa';
import useCommunityTab from '../../../../hooks/chat/useCommunityTab';

// ─── Inline DM View (now with WS support) ────────────────────────
const DmView = ({ peer, messages, connected, typingUsers = [], onSend, onTyping, onBack, myWallet }) => {
  const [text, setText] = useState('');
  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  const handleChange = (val) => {
    setText(val);
    onTyping?.(!!val.trim());
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40 backdrop-blur-md">
        <button onClick={onBack} className="text-light-text-tertiary hover:text-light-text-primary transition">
          <FaArrowLeft size={14} />
        </button>
        <div className="w-8 h-8 rounded-full bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-sm font-bold overflow-hidden">
          {peer?.profile_image_url
            ? <img src={peer.profile_image_url} className="w-8 h-8 rounded-full object-cover" alt="" />
            : (peer?.name || '?')[0]?.toUpperCase()
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold truncate">{peer?.name}</h3>
          <p className="text-[11px] text-light-text-tertiary truncate">{peer?.cargo} · {peer?.seccion}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-light-text-tertiary">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-2xl mb-3">💬</div>
            <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">
              Inicia la conversación con {peer?.name}
            </p>
            <p className="text-[11px] text-light-text-tertiary mt-1">Los mensajes son directos y privados</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isMine = m.sender_wallet?.toLowerCase() === myWallet?.toLowerCase();
          return (
            <motion.div
              key={m.id || i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${isMine
                  ? 'bg-blue-500/15 text-blue-400 rounded-br-sm'
                  : 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 rounded-bl-sm'
                }`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className="text-[10px] opacity-50 mt-1 text-right">
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
          {typingUsers.map(u => u.name || u.wallet?.slice(0,8)).join(', ')} escribiendo...
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-light-border/40 dark:border-dark-border/40">
        <div className="flex items-center gap-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-xl border border-light-border/30 dark:border-dark-border/30 px-3 py-2">
          <textarea
            value={text}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Mensaje a ${peer?.name}...`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none max-h-32 text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary/60"
          />
          <button onClick={handleSend} disabled={!text.trim()} className="p-1.5 rounded-lg bg-blue-500 text-white disabled:opacity-30 hover:bg-blue-600 transition">
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Community Tab ────────────────────────────────────────
const CommunityTab = ({ appState, isDesktop = true, showSidebar, setShowSidebar }) => {
  const {
    token, walletAddress, isAdmin, canPin,
    channelHook, groupHook, presence,
    mode, setMode,
    showCreateChannel, setShowCreateChannel,
    showCreateGroup, setShowCreateGroup,
    showDmPicker, setShowDmPicker,
    showMembersPanel, setShowMembersPanel,
    showSectionPerms, setShowSectionPerms,
    selectedGroupForSettings, setSelectedGroupForSettings,
    selectedMemberProfile, setSelectedMemberProfile,
    dmPeer, setDmPeer,
    dmChat,
    dmConversations,
    handleSelectChannel, handleSelectGroup, handlePinMessage,
    handleSelectDmPeer, handleSelectDmConvo, handleSendDm, handleMemberClick
  } = useCommunityTab({ appState });

  // Mobile specific state (now synced with parent)
  const closeMobileSidebar = useCallback(() => {
    if (!isDesktop) setShowSidebar(false);
  }, [isDesktop, setShowSidebar]);

  const openMobileSidebar = useCallback(() => {
    setShowSidebar(true);
  }, [setShowSidebar]);

  const mainContent = useMemo(() => {
    const onBack = () => {
      if (!isDesktop) {
        setShowSidebar(true);
      } else {
        setMode(null);
        dmChat.disconnectWs();
        setDmPeer(null);
      }
    };

    if (mode === 'dm' && dmPeer) {
      return (
        <DmView
          peer={dmPeer}
          messages={dmChat.messages}
          connected={dmChat.connected}
          typingUsers={dmChat.typingUsers}
          onSend={handleSendDm}
          onTyping={dmChat.notifyTyping}
          onBack={onBack}
          myWallet={walletAddress}
        />
      );
    }

    if (mode === 'channel' && channelHook.activeChannel) {
      return (
        <ChannelView
          channel={channelHook.activeChannel}
          messages={channelHook.messages}
          connected={channelHook.connected}
          typingUsers={channelHook.typingUsers}
          onSend={channelHook.sendMessage}
          onReact={channelHook.reactToMessage}
          onPin={handlePinMessage}
          onUpload={channelHook.uploadMedia}
          onLoadOlder={channelHook.loadOlder}
          onNotifyTyping={channelHook.notifyTyping}
          onToggleSidebar={onBack}
          onToggleMembers={() => setShowMembersPanel(v => !v)}
          isDesktop={isDesktop}
          myWallet={walletAddress}
          token={token}
          isAdmin={isAdmin}
          canPin={canPin}
          messagesLoading={channelHook.messagesLoading}
          members={presence.members}
          employeeMap={presence.employeeMap}
          showMembersPanel={showMembersPanel}
        />
      );
    }

    if (mode === 'group' && groupHook.activeGroup) {
      return (
        <ChannelView
          channel={groupHook.activeGroup}
          messages={groupHook.messages}
          connected={groupHook.connected}
          typingUsers={groupHook.typingUsers}
          onSend={groupHook.sendMessage}
          onReact={groupHook.reactToMessage}
          onPin={null}
          onUpload={groupHook.uploadMedia}
          onLoadOlder={groupHook.loadOlder}
          onNotifyTyping={groupHook.notifyTyping}
          onToggleSidebar={onBack}
          onToggleMembers={() => setShowMembersPanel(v => !v)}
          isDesktop={isDesktop}
          myWallet={walletAddress}
          token={token}
          isAdmin={isAdmin}
          canPin={false}
          messagesLoading={groupHook.messagesLoading}
          isGroup={true}
          groupName={groupHook.activeGroup?.name}
          members={presence.members}
          employeeMap={presence.employeeMap}
          showMembersPanel={showMembersPanel}
        />
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <div className="w-20 h-20 rounded-2xl bg-matrix-green/10 flex items-center justify-center mb-4">
          <FaComments size={32} className="text-matrix-green" />
        </div>
        <h2 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
          🍝 Piccola Community
        </h2>
        <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary max-w-sm">
          Selecciona un canal, grupo, o mensaje directo.
          {isAdmin && ' Como admin, puedes crear nuevos canales y gestionar permisos.'}
        </p>
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-4 opacity-60">
          Menciona <strong className="text-purple-400">@nonna</strong> en cualquier canal para hablar con la IA
        </p>
      </div>
    );
  }, [mode, channelHook, groupHook, dmPeer, dmChat, walletAddress, isAdmin, canPin, handlePinMessage, handleSendDm]);

  return (
    <div className="h-full flex relative overflow-hidden">
      {/* Left Sidebar (ServerSidebar) */}
      <AnimatePresence mode="wait">
        {(isDesktop || showSidebar) && (
          <motion.div
            initial={isDesktop ? { width: 240, opacity: 1 } : { x: '-100%', opacity: 1 }}
            animate={isDesktop ? { width: 240, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isDesktop ? { width: 0, opacity: 0 } : { x: '-100%', opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`h-full border-r border-light-border/20 dark:border-dark-border/10 bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 backdrop-blur-3xl shrink-0 z-30 ${
              isDesktop ? 'relative' : 'fixed inset-y-0 left-0 w-[280px] shadow-[20px_0_40px_rgba(0,0,0,0.3)]'
            }`}
          >
            <ServerSidebar
              channels={channelHook.channels}
              groups={groupHook.groups}
              activeSlug={mode === 'channel' ? channelHook.activeSlug : null}
              activeGroupId={mode === 'group' ? groupHook.activeGroupId : null}
              onSelectChannel={(slug) => { handleSelectChannel(slug); closeMobileSidebar(); }}
              onSelectGroup={(id) => { handleSelectGroup(id); closeMobileSidebar(); }}
              onCreateChannel={() => setShowCreateChannel(true)}
              onCreateGroup={() => setShowCreateGroup(true)}
              onOpenDm={() => setShowDmPicker(true)}
              onToggleMembers={() => setShowMembersPanel(v => !v)}
              onOpenSectionPerms={() => setShowSectionPerms(true)}
              onOpenGroupSettings={setSelectedGroupForSettings}
              isAdmin={isAdmin}
              walletAddress={walletAddress}
              onlineCount={presence.onlineCount}
              showMembersPanel={showMembersPanel}
              dmConversations={dmConversations}
              activeDmPeer={mode === 'dm' ? dmPeer : null}
              onSelectDmConvo={(convo) => { handleSelectDmConvo(convo); closeMobileSidebar(); }}
              employeeMap={presence.employeeMap}
              isMobile={!isDesktop}
              onClose={closeMobileSidebar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      {!isDesktop && showSidebar && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-20"
        />
      )}

      {/* Main content */}
      <main className="flex-1 h-full min-w-0 relative bg-transparent">
        {mainContent}
      </main>

      {/* Right Sidebar: Members Panel */}
      <AnimatePresence mode="wait">
        {showMembersPanel && (
          <motion.div
            initial={isDesktop ? { width: 0, opacity: 0 } : { x: '100%', opacity: 1 }}
            animate={isDesktop ? { width: 220, opacity: 1 } : { x: 0, opacity: 1 }}
            exit={isDesktop ? { width: 0, opacity: 0 } : { x: '100%', opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`h-full border-l border-light-border/20 dark:border-dark-border/10 bg-light-surface-secondary/80 dark:bg-dark-surface-secondary/80 backdrop-blur-3xl shrink-0 z-30 ${
              isDesktop ? 'relative' : 'fixed inset-y-0 right-0 w-[280px] shadow-[-20px_0_40px_rgba(0,0,0,0.3)]'
            }`}
          >
            <MembersPanel
              onlineBySection={presence.onlineBySection}
              idleBySection={presence.idleBySection}
              offlineBySection={presence.offlineBySection}
              unregisteredBySection={presence.unregisteredBySection}
              onlineCount={presence.onlineCount}
              idleCount={presence.idleCount}
              offlineCount={presence.offlineCount}
              unregisteredCount={presence.unregisteredCount}
              activeGroup={mode === 'group' ? groupHook.activeGroup : null}
              onClickMember={handleMemberClick}
              onDmMember={handleSelectDmPeer}
              onClose={() => setShowMembersPanel(false)}
              isMobile={!isDesktop}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Members Overlay */}
      {!isDesktop && showMembersPanel && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowMembersPanel(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20"
        />
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateChannel && (
          <CreateChannelModal
            open={showCreateChannel}
            onClose={() => setShowCreateChannel(false)}
            token={token}
            walletAddress={walletAddress}
            onCreated={() => channelHook.loadChannels()}
          />
        )}
        {showCreateGroup && (
          <GroupModal
            open={showCreateGroup}
            group={null}
            onClose={() => setShowCreateGroup(false)}
            onUpdated={() => groupHook.loadGroups()}
            token={token}
            walletAddress={walletAddress}
            isAdmin={isAdmin}
            appState={appState}
          />
        )}
        {showDmPicker && (
          <DmPickerModal
            open={showDmPicker}
            onClose={() => setShowDmPicker(false)}
            onSelectPeer={handleSelectDmPeer}
            token={token}
            walletAddress={walletAddress}
          />
        )}
        {showSectionPerms && (
          <SectionPermsModal
            open={showSectionPerms}
            onClose={() => setShowSectionPerms(false)}
            token={token}
            walletAddress={walletAddress}
            appState={appState}
          />
        )}
        {selectedGroupForSettings && (
          <GroupModal
            open={!!selectedGroupForSettings}
            group={selectedGroupForSettings}
            onClose={() => setSelectedGroupForSettings(null)}
            token={token}
            walletAddress={walletAddress}
            isAdmin={isAdmin}
            onUpdated={() => groupHook.loadGroups()}
            appState={appState}
          />
        )}
        {selectedMemberProfile && (
          <MemberProfileModal
            open={!!selectedMemberProfile}
            member={selectedMemberProfile}
            onClose={() => setSelectedMemberProfile(null)}
            onDm={handleSelectDmPeer}
            token={token}
            walletAddress={walletAddress}
            appState={appState}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CommunityTab;
