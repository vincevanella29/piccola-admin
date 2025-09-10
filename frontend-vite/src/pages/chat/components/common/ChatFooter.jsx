// src/pages/chat/components/common/ChatFooter.jsx
import React, { useCallback, useState } from 'react';

/**
 * ChatFooter: unified composer with a single design.
 * - Lives inside its parent's layout (not window-sticky), but visually sticky at bottom by container placement.
 * - Keeps the same compact footprint while switching only the action buttons for admin vs client.
 *
 * Props (client):
 * - variant: 'client' | 'admin'
 * - t
 * - clientDisabled
 * - onClientSend(text)
 * - onClientTyping(state)
 * - clientProfileReady
 * - onClientNew()
 *
 * Props (admin):
 * - adminConvId
 * - adminDisabled
 * - onAdminReply(text)
 * - onAdminTake()
 * - onAdminRelease()
 * - onAdminClose()
 * - onAdminTyping(state)
 */
const ChatFooter = ({
  variant = 'client',
  // client props
  t,
  clientDisabled,
  onClientSend,
  onClientTyping,
  clientProfileReady,
  onClientNew,
  // admin props
  adminConvId,
  adminDisabled,
  onAdminReply,
  onAdminTake,
  onAdminRelease,
  onAdminClose,
  onAdminTyping,
  // common extras
  showJump,
  onJump,
}) => {
  const isAdmin = variant === 'admin';
  const [text, setText] = useState('');

  const disabled = isAdmin ? adminDisabled : clientDisabled;
  // New button should still work when there's no convId; require profile readiness for client
  const newDisabled = isAdmin ? disabled : !clientProfileReady;

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setText(v);
    if (isAdmin) {
      onAdminTyping && onAdminTyping(v.length > 0);
    } else {
      onClientTyping && onClientTyping(v.length > 0);
    }
  }, [isAdmin, onAdminTyping, onClientTyping]);

  const doSend = useCallback(() => {
    const trimmed = (text || '').trim();
    if (!trimmed || disabled) return;
    if (isAdmin) {
      onAdminReply && onAdminReply(trimmed);
    } else {
      onClientSend && onClientSend(trimmed);
    }
    setText('');
    if (isAdmin) {
      onAdminTyping && onAdminTyping(false);
    } else {
      onClientTyping && onClientTyping(false);
    }
  }, [text, disabled, isAdmin, onAdminReply, onClientSend, onAdminTyping, onClientTyping]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }, [doSend]);

  return (
    <div className="rounded-lg border bg-light-surface-secondary/60 border-light-border/60 dark:bg-dark-surface-secondary/60 dark:border-dark-border/60 p-2 sm:p-3">
      {/* Top controls row: sticky inside this footer container if it grows */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {!isAdmin && (
          <button
            type="button"
            className="px-2 py-1 text-xs rounded bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/60 dark:border-dark-border/60 hover:opacity-90"
            onClick={onClientNew}
            disabled={newDisabled}
          >
            {(t && t('chat.new')) || 'New'}
          </button>
        )}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/60 dark:border-dark-border/60 hover:opacity-90 disabled:opacity-50"
              onClick={onAdminTake}
              disabled={disabled}
            >Take</button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/60 dark:border-dark-border/60 hover:opacity-90 disabled:opacity-50"
              onClick={onAdminRelease}
              disabled={disabled}
            >Release</button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-vanellix-purple/15 hover:bg-vanellix-purple/25 border border-vanellix-purple/30 text-vanellix-purple disabled:opacity-50"
              onClick={onAdminClose}
              disabled={disabled}
            >Close</button>
          </div>
        )}
        <div className="flex-1" />
        {showJump && (
          <button
            type="button"
            onClick={onJump}
            className="px-3 py-1.5 text-xs rounded-full bg-matrix-green text-dark-background shadow hover:bg-matrix-green/90"
          >{(t && t('chat.jump_to_latest')) || 'Jump to latest'}</button>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled || (isAdmin ? false : !clientProfileReady)}
          placeholder={(t && t('chat.type_message')) || 'Type a message...'}
          className="flex-1 resize-none rounded-md border border-light-border/60 dark:border-dark-border/60 bg-light-surface/70 dark:bg-dark-surface/50 text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary p-2 focus:outline-none focus:ring-1 focus:ring-matrix-green/60"
        />
        <button
          type="button"
          onClick={doSend}
          disabled={disabled || !text.trim()}
          className="px-3 py-2 rounded-md bg-matrix-green text-dark-background hover:bg-matrix-green/90 disabled:opacity-50"
        >
          {(t && t('chat.send')) || 'Send'}
        </button>
      </div>
    </div>
  );
};

export default ChatFooter;
