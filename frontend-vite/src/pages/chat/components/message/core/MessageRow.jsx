import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSmile, FaReply, FaThumbtack } from 'react-icons/fa';

/**
 * MessageRow - Universal Layout Component
 * @param {string} variant - 'bubble' (iMessage style) | 'flat' (Discord style)
 */
const MessageRow = ({
  variant = 'bubble',
  isMine = false,
  isBot = false,
  isSystem = false,
  
  // Data
  msgId,
  senderName,
  senderCargo,
  senderColor,
  timeString,
  isPinned,
  
  // Slots
  avatarSlot,
  replyPreviewSlot,
  contentSlot,
  mediaSlot,
  reactionsSlot,
  actionsSlot,
  
  // Handlers
  onReply,
  onReact,
}) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🍕', '👵'];

  // --------------------------------------------------------------------------
  // FLAT LAYOUT (Discord / Slack style) - Used for Community Groups
  // --------------------------------------------------------------------------
  if (variant === 'flat') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group flex gap-2.5 px-4 py-1.5 hover:bg-light-surface-tertiary/30 dark:hover:bg-dark-surface-tertiary/20 transition-colors ${isBot ? 'bg-purple-500/5' : ''}`}
      >
        <div className="shrink-0 mt-0.5">{avatarSlot}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold" style={{ color: isBot ? '#a855f7' : isMine ? undefined : senderColor }}>
              {senderName}
            </span>
            {senderCargo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded text-light-text-tertiary dark:text-dark-text-tertiary" style={senderColor ? { backgroundColor: `${senderColor}15`, color: senderColor } : {}}>
                {senderCargo}
              </span>
            )}
            <span className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">
              {timeString}
            </span>
            {isPinned && <FaThumbtack size={10} className="text-yellow-500" />}
          </div>

          {replyPreviewSlot}
          {contentSlot}
          {mediaSlot}
          {reactionsSlot}

          {/* Quick Actions Hover */}
          <div className="hidden group-hover:flex items-center gap-0.5 mt-1 -ml-1">
            {QUICK_EMOJIS.slice(0, 4).map(e => (
              <button key={e} onClick={() => onReact?.(msgId, e)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-xs transition">{e}</button>
            ))}
            <button onClick={() => setShowEmoji(v => !v)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary transition"><FaSmile size={12} /></button>
            <button onClick={() => onReply?.(msgId)} className="p-1 rounded hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 text-light-text-tertiary transition"><FaReply size={12} /></button>
            {actionsSlot}
          </div>
          {showEmoji && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => { onReact?.(msgId, e); setShowEmoji(false); }} className="p-1.5 rounded hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary text-sm transition">{e}</button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // --------------------------------------------------------------------------
  // BUBBLE LAYOUT (iMessage / WhatsApp style) - Used for Delivery & DMs
  // --------------------------------------------------------------------------
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex w-full mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}
    >
      {/* Left Avatar (Others) */}
      {!isMine && !isSystem && avatarSlot && (
        <div className="shrink-0 mr-2 mt-auto">
          {avatarSlot}
        </div>
      )}

      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%]`}>
        {/* Name Header */}
        {!isMine && !isSystem && senderName && (
          <span className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary ml-1 mb-0.5 flex items-center gap-1">
            {senderName} {senderCargo && <span className="opacity-70">({senderCargo})</span>}
          </span>
        )}

        {/* Bubble */}
        <div className={`relative px-4 py-2.5 shadow-sm transition-all duration-200 ${
          isSystem 
            ? 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 text-light-text-tertiary dark:text-dark-text-tertiary rounded-xl text-center text-xs mx-auto'
            : isMine
              ? 'bg-gradient-to-br from-light-accent to-matrix-green text-dark-bg rounded-2xl rounded-tr-sm'
              : 'bg-light-surface dark:bg-dark-surface/60 backdrop-blur-md border border-light-border/50 dark:border-dark-border/50 text-light-text-primary dark:text-dark-text-primary rounded-2xl rounded-tl-sm'
        }`}>
          {replyPreviewSlot}
          <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {contentSlot}
          </div>
          {mediaSlot}
          
          <div className={`text-[10px] mt-1 flex items-center gap-1 ${isMine ? 'text-dark-bg/70 justify-end' : 'text-light-text-tertiary dark:text-dark-text-tertiary justify-end'}`}>
            {timeString}
          </div>

          {/* Sutil efecto de brillo para mensajes del usuario */}
          {isMine && !isSystem && (
            <div className="absolute inset-0 rounded-2xl rounded-tr-sm bg-white/10 pointer-events-none mix-blend-overlay" />
          )}
        </div>

        {reactionsSlot}
      </div>

      {/* Right Avatar (Mine - Optional) */}
      {isMine && !isSystem && avatarSlot && (
        <div className="shrink-0 ml-2 mt-auto hidden sm:block">
          {avatarSlot}
        </div>
      )}
    </motion.div>
  );
};

export default MessageRow;
