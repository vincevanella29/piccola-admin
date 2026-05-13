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

// ─── Inline DM View ────────────────────────────────────────────
const DmView = ({ peer, messages, onSend, onBack, myWallet }) => {
  const [text, setText] = useState('');
  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40 backdrop-blur-md">
        <button onClick={onBack} className="text-light-text-tertiary hover:text-light-text-primary"><FaArrowLeft size={14} /></button>
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
      </div>
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-light-text-tertiary">
            Inicia la conversación con {peer?.name}
          </div>
        )}
        {messages.map((m, i) => {
          const isMine = m.sender_wallet?.toLowerCase() === myWallet?.toLowerCase();
          return (
            <div key={m.id || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${isMine
                  ? 'bg-matrix-green/15 text-matrix-green rounded-br-sm'
                  : 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 rounded-bl-sm'
                }`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className="text-[10px] opacity-50 mt-1 text-right">
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-light-border/40 dark:border-dark-border/40">
        <div className="flex items-center gap-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-xl border border-light-border/30 dark:border-dark-border/30 px-3 py-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Mensaje a ${peer?.name}...`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none max-h-32"
          />
          <button onClick={handleSend} disabled={!text.trim()} className="p-1.5 rounded-lg bg-matrix-green text-dark-bg disabled:opacity-30">
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Community Tab ────────────────────────────────────────
const CommunityTab = ({ appState }) => {
  const {
    token, walletAddress, isAdmin,
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
    dmMessages,
    handleSelectChannel, handleSelectGroup, handlePinMessage,
    handleSelectDmPeer, handleSendDm, handleMemberClick
  } = useCommunityTab({ appState });

  const mainContent = useMemo(() => {
    if (mode === 'dm' && dmPeer) {
      return (
        <DmView
          peer={dmPeer}
          messages={dmMessages}
          onSend={handleSendDm}
          onBack={() => { setMode(null); setDmPeer(null); }}
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
          myWallet={walletAddress}
          token={token}
          isAdmin={isAdmin}
          messagesLoading={channelHook.messagesLoading}
          members={presence.members}
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
          myWallet={walletAddress}
          token={token}
          isAdmin={isAdmin}
          messagesLoading={groupHook.messagesLoading}
          isGroup={true}
          groupName={groupHook.activeGroup?.name}
          members={presence.members}
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
          Selecciona un canal o grupo, o envía un mensaje directo.
          {isAdmin && ' Como admin, puedes crear nuevos canales y gestionar permisos.'}
        </p>
        <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-4 opacity-60">
          Menciona <strong className="text-purple-400">@nonna</strong> en cualquier canal para hablar con la IA
        </p>
      </div>
    );
  }, [mode, channelHook, groupHook, dmPeer, dmMessages, walletAddress, isAdmin, handlePinMessage, handleSendDm]);

  return (
    <div className="h-full flex">
      {/* Left Sidebar */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 240, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="h-full border-r border-light-border/30 dark:border-dark-border/30 bg-light-surface-secondary/20 dark:bg-dark-surface-secondary/20 overflow-hidden shrink-0"
      >
        <div className="w-[240px] h-full">
          <ServerSidebar
            channels={channelHook.channels}
            groups={groupHook.groups}
            activeSlug={mode === 'channel' ? channelHook.activeSlug : null}
            activeGroupId={mode === 'group' ? groupHook.activeGroupId : null}
            onSelectChannel={handleSelectChannel}
            onSelectGroup={handleSelectGroup}
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
          />
        </div>
      </motion.div>

      {/* Main content */}
      <main className="flex-1 h-full min-w-0 relative">
        {mainContent}
      </main>

      {/* Right Sidebar: Members Panel */}
      <AnimatePresence>
        {showMembersPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full border-l border-light-border/30 dark:border-dark-border/30 overflow-hidden shrink-0"
          >
            <div className="w-[220px] h-full">
              <MembersPanel
                onlineBySection={presence.onlineBySection}
                idleBySection={presence.idleBySection}
                offlineBySection={presence.offlineBySection}
                onlineCount={presence.onlineCount}
                idleCount={presence.idleCount}
                offlineCount={presence.offlineCount}
                activeGroup={mode === 'group' ? groupHook.activeGroup : null}
                onClickMember={handleMemberClick}
                onClose={() => setShowMembersPanel(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
