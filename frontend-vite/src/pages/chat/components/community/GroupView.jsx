// src/pages/chat/components/community/GroupView.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUsers, FaSmile, FaReply, FaPaperPlane, FaPaperclip, FaImage, FaArrowDown, FaTrophy, FaTimes, FaSpinner } from 'react-icons/fa';
import useGroupView from '../../../../hooks/chat/useGroupView';
import { getSectionColor } from './sectionColors';
import MessageList from '../message/core/MessageList';

// ─── Group View ──────────────────────────────────────────────────
const GroupView = ({
  group,
  messages = [],
  connected,
  typingUsers = [],
  onSend,
  onReact,
  onPin,
  onUpload,
  onLoadOlder,
  onNotifyTyping,
  onToggleSidebar,
  onToggleMembers,
  isDesktop = true,
  myWallet,
  isAdmin = false,
  canPin = false,
  messagesLoading = false,
  // For group mode reuse
  groupName,
  token,
  appState,
  members,
  employeeMap = {},
  showMembersPanel,
}) => {
  const {
    text, replyTo, showJump, sharingMerits,
    scrollRef, bottomRef, fileInputRef,
    selectedMedia, setSelectedMedia,
    handleScroll, handleSend, handleKeyDown, handleFileSelect, handleTyping, handleShareMerits,
    scrollToBottom, setReplyTo
  } = useGroupView({
    group, messages, onSend, onUpload, onLoadOlder, onNotifyTyping,
    token, myWallet, groupName, appState
  });

  const title = groupName || 'Grupo';
  const icon = group?.icon || '👥';
  const description = group?.description || '';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40 backdrop-blur-md">
        {!isDesktop && (
          <button onClick={onToggleSidebar} className="p-1.5 -ml-1 text-light-text-tertiary hover:text-light-text-primary transition">
            <FaReply size={14} className="rotate-0" />
          </button>
        )}
        <span className="text-light-text-tertiary dark:text-dark-text-tertiary">{typeof icon === 'string' ? icon : icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{title}</h3>
          {description && <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary truncate">{description}</p>}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="hidden sm:inline opacity-60 uppercase font-bold tracking-tighter">
              {connected ? 'Sync' : 'Offline'}
            </span>
          </div>
          
          <button 
            onClick={onToggleMembers}
            className={`p-1.5 rounded-md transition ${showMembersPanel ? 'bg-matrix-green/15 text-matrix-green' : 'hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}
            title="Alternar Panel de Miembros"
          >
            <FaUsers size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        variant="flat"
        myWallet={myWallet}
        isAdmin={isAdmin}
        members={members}
        employeeMap={employeeMap}
        appState={appState}
        onReact={onReact}
        onReply={setReplyTo}
        onPin={onPin}
        isLoading={messagesLoading}
        emptyText={`Este es el inicio del canal #${title}. ¡Escribe algo!`}
        listRef={scrollRef}
        onScroll={handleScroll}
        bottomRef={bottomRef}
      />

      {/* Jump to bottom */}
      <AnimatePresence>
        {showJump && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-6 p-2.5 rounded-full bg-matrix-green text-dark-bg shadow-lg hover:scale-110 transition-transform z-10"
          >
            <FaArrowDown size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
          {typingUsers.map(u => u.name || u.wallet?.slice(0,8)).join(', ')} escribiendo...
        </div>
      )}

      {/* Media preview */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 border-t border-light-border/40 dark:border-dark-border/40 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40"
          >
            <div className="relative inline-block">
              {selectedMedia.type.startsWith('image/') ? (
                <img src={selectedMedia.url} alt="Preview" className="h-32 w-auto rounded-lg object-cover" />
              ) : (
                <div className="h-20 w-32 rounded-lg bg-matrix-green/10 flex items-center justify-center text-[10px] text-matrix-green p-2 text-center break-all">
                  {selectedMedia.name}
                </div>
              )}
              {selectedMedia.isUploading && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <FaSpinner className="animate-spin text-white" />
                </div>
              )}
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              >
                <FaTimes size={10} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply indicator */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-1.5 bg-matrix-green/5 border-t border-matrix-green/20 flex items-center gap-2 text-xs"
          >
            <FaReply size={10} className="text-matrix-green" />
            <span className="text-light-text-tertiary dark:text-dark-text-tertiary truncate">
              Respondiendo a <strong>{replyTo.sender_name}</strong>: {(replyTo.text || '').slice(0, 80)}
            </span>
            <button onClick={() => setReplyTo(null)} className="text-light-text-tertiary hover:text-red-400 ml-auto">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40">
        <div className="flex items-end gap-2 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 rounded-xl border border-light-border/30 dark:border-dark-border/30 px-3 py-2">
          <button 
            onClick={handleShareMerits} 
            disabled={sharingMerits}
            className={`p-1.5 rounded-lg transition ${sharingMerits ? 'opacity-50' : 'text-yellow-500 hover:bg-yellow-500/20'}`}
            title="Compartir mis Méritos"
          >
            <FaTrophy size={14} />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-matrix-green transition">
            <FaPaperclip size={14} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
          <textarea
            value={text}
            onChange={e => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Mensaje en #${title}... (usa @nonna para hablar con la IA)`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary/60 dark:placeholder:text-dark-text-tertiary/60 outline-none max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() && !selectedMedia?.url}
            className="p-1.5 rounded-lg bg-matrix-green text-dark-bg disabled:opacity-30 hover:bg-matrix-green/90 transition"
          >
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupView;
