// src/pages/chat/components/community/ChannelView.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHashtag, FaBullhorn, FaThumbtack, FaUsers, FaSmile, FaReply, FaPaperPlane, FaPaperclip, FaImage, FaArrowDown, FaTrophy } from 'react-icons/fa';
import useChannelView from '../../../../hooks/chat/useChannelView';
import { getSectionColor } from './sectionColors';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🍕', '👵'];

// ─── Message Bubble ────────────────────────────────────────────────
const MessageBubble = ({ msg, myWallet, onReact, onReply, onPin, isAdmin, canPin = false, members, employeeMap = {} }) => {
  const isMine = msg.sender_wallet && myWallet && msg.sender_wallet.toLowerCase() === myWallet.toLowerCase();
  const isBot = msg.sender_name === 'La Nonna 👵';
  const [showEmoji, setShowEmoji] = useState(false);

  const roleLabel = msg.sender_role_level ? (
    msg.sender_role_level <= 4 ? '👑' : msg.sender_role_level <= 5 ? '⭐' : ''
  ) : '';

  // Fallback chain: msg data → presence member → employee directory
  const senderWallet = (msg.sender_wallet || '').toLowerCase();
  const presenceMember = members?.find(m => m.wallet?.toLowerCase() === senderWallet);
  const employee = senderWallet ? employeeMap[senderWallet] : null;
  const avatarUrl = msg.sender_avatar_url || presenceMember?.profile_image_url || employee?.profile_image_url;
  const displayName = msg.sender_name || presenceMember?.name || employee?.name || 'Anónimo';

  // Resolve section from msg or presence member or employee directory
  const senderSeccion = msg.sender_seccion || presenceMember?.seccion || employee?.seccion || '';
  const sectionColor = getSectionColor(senderSeccion);


  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex gap-2.5 px-4 py-1.5 hover:bg-light-surface-tertiary/30 dark:hover:bg-dark-surface-tertiary/20 transition-colors ${isBot ? 'bg-purple-500/5' : ''}`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-light-border/30 dark:border-dark-border/30" />
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${isBot ? 'bg-purple-500/20 text-purple-400' : isMine ? 'bg-matrix-green/20 text-matrix-green' : 'bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
            {isBot ? '👵' : displayName[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: isBot ? '#a855f7' : isMine ? undefined : sectionColor.color }}
          >
            {displayName} {roleLabel}
          </span>
          {msg.sender_cargo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-light-text-tertiary dark:text-dark-text-tertiary"
              style={{ backgroundColor: `${sectionColor.color}15`, color: sectionColor.color }}>
              {msg.sender_cargo}
            </span>
          )}
          <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          {msg.is_pinned && <FaThumbtack size={10} className="text-yellow-500" />}
        </div>

        {/* Reply preview */}
        {msg.reply_preview && (
          <div className="mt-0.5 mb-1 pl-2 border-l-2 border-matrix-green/40 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
            <span className="font-medium">{msg.reply_preview.sender_name}: </span>
            {(msg.reply_preview.text || '').slice(0, 100)}
          </div>
        )}

        {/* Text */}
        <p className="text-sm text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap break-words leading-relaxed">
          {msg.text}
        </p>

        {/* Media */}
        {msg.media_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {msg.media_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                  ? <img src={url} alt="" className="max-w-[240px] max-h-[180px] rounded-lg object-cover border border-light-border/30 dark:border-dark-border/30" />
                  : url.match(/\.(mp4|webm|mov)$/i)
                    ? <video src={url} controls className="max-w-[300px] rounded-lg" />
                    : <span className="text-xs text-matrix-green underline">📎 {url.split('/').pop()}</span>
                }
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(msg.id, emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition ${
                  users.includes(myWallet?.toLowerCase())
                    ? 'bg-matrix-green/15 border-matrix-green/40 text-matrix-green'
                    : 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 border-light-border/30 dark:border-dark-border/30 hover:border-matrix-green/30'
                }`}
              >
                {emoji} <span className="font-medium">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div className="hidden group-hover:flex items-center gap-0.5 mt-1 -ml-1">
          {QUICK_EMOJIS.slice(0, 4).map(e => (
            <button key={e} onClick={() => onReact?.(msg.id, e)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-xs transition">{e}</button>
          ))}
          <button onClick={() => setShowEmoji(v => !v)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary transition"><FaSmile size={12} /></button>
          <button onClick={() => onReply?.(msg)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary transition"><FaReply size={12} /></button>
          {(canPin || isAdmin) && onPin && (
            <button onClick={() => onPin(msg.id)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary transition"><FaThumbtack size={12} /></button>
          )}
        </div>
        {showEmoji && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {QUICK_EMOJIS.map(e => (
              <button key={e} onClick={() => { onReact?.(msg.id, e); setShowEmoji(false); }} className="p-1.5 rounded hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-sm transition">{e}</button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Channel View ──────────────────────────────────────────────────
const ChannelView = ({
  channel,
  messages = [],
  connected,
  typingUsers = [],
  onSend,
  onReact,
  onPin,
  onUpload,
  onLoadOlder,
  onNotifyTyping,
  myWallet,
  isAdmin = false,
  canPin = false,
  messagesLoading = false,
  // For group mode reuse
  isGroup = false,
  groupName,
  token,
  appState,
  members,
  employeeMap = {},
}) => {
  const {
    text, replyTo, showJump, sharingMerits,
    scrollRef, bottomRef, fileInputRef,
    handleScroll, handleSend, handleKeyDown, handleFileSelect, handleTyping, handleShareMerits,
    scrollToBottom, setReplyTo
  } = useChannelView({
    channel, messages, onSend, onUpload, onLoadOlder, onNotifyTyping,
    token, myWallet, isGroup, groupName, appState
  });

  const title = isGroup ? (groupName || 'Grupo') : (channel?.name || 'Canal');
  const icon = isGroup ? (channel?.icon || '👥') : (channel?.channel_type === 'announcement' ? <FaBullhorn size={14} /> : <FaHashtag size={14} />);
  const description = channel?.description || '';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-light-border/40 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40 backdrop-blur-md">
        <span className="text-light-text-tertiary dark:text-dark-text-tertiary">{typeof icon === 'string' ? icon : icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary truncate">{title}</h3>
          {description && <p className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary truncate">{description}</p>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <FaUsers size={12} />
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        {messagesLoading && <div className="text-center py-4 text-sm text-light-text-tertiary dark:text-dark-text-tertiary">Cargando...</div>}
        {messages.length === 0 && !messagesLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="text-4xl mb-3">{typeof icon === 'string' ? icon : '💬'}</div>
            <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Bienvenido a #{title}</h3>
            <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-1">Este es el inicio del canal. ¡Escribe algo!</p>
          </div>
        )}
        <div className="py-2">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              myWallet={myWallet}
              onReact={onReact}
              onReply={setReplyTo}
              onPin={onPin}
              isAdmin={isAdmin}
              canPin={canPin}
              members={members}
              employeeMap={employeeMap}
            />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

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
            disabled={!text.trim()}
            className="p-1.5 rounded-lg bg-matrix-green text-dark-bg disabled:opacity-30 hover:bg-matrix-green/90 transition"
          >
            <FaPaperPlane size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelView;
