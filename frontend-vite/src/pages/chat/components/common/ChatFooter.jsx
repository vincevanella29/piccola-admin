import React, { useCallback, useState } from 'react';
import { Send, Plus, ArrowDown, UserCheck, UserX, XCircle } from 'lucide-react';

// Estilo Glass interno
const FOOTER_GLASS = "backdrop-blur-md bg-light-surface/80 dark:bg-dark-surface/80 border-t border-light-border/50 dark:border-dark-border/50";

const ChatFooter = ({
  variant = 'client',
  t,
  clientDisabled,
  onClientSend,
  onClientTyping,
  clientProfileReady,
  onClientNew,
  adminDisabled,
  onAdminReply,
  onAdminTake,
  onAdminRelease,
  onAdminClose,
  onAdminTyping,
  showJump,
  onJump,
}) => {
  const isAdmin = variant === 'admin';
  const [text, setText] = useState('');

  const disabled = isAdmin ? adminDisabled : clientDisabled;
  const newDisabled = isAdmin ? disabled : !clientProfileReady;

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setText(v);
    if (isAdmin) onAdminTyping?.(v.length > 0);
    else onClientTyping?.(v.length > 0);
  }, [isAdmin, onAdminTyping, onClientTyping]);

  const doSend = useCallback(() => {
    const trimmed = (text || '').trim();
    if (!trimmed || disabled) return;
    if (isAdmin) onAdminReply?.(trimmed);
    else onClientSend?.(trimmed);
    setText('');
    if (isAdmin) onAdminTyping?.(false);
    else onClientTyping?.(false);
  }, [text, disabled, isAdmin, onAdminReply, onClientSend, onAdminTyping, onClientTyping]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }, [doSend]);

  return (
    <div className={`w-full px-4 py-3 ${FOOTER_GLASS}`}>
      
      {/* Top Row: Actions & Jump Button (Absolute positioned for overlay effect if needed, or stacked) */}
      {(showJump || isAdmin || (!isAdmin && !newDisabled)) && (
         <div className="flex items-center justify-between gap-2 mb-2">
            
            {/* Left Actions */}
            <div className="flex items-center gap-2">
               {!isAdmin && (
                 <button
                   type="button"
                   onClick={onClientNew}
                   disabled={newDisabled}
                   className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors disabled:opacity-50"
                 >
                   <Plus size={12} /> {(t && t('chat.new')) || 'Nuevo'}
                 </button>
               )}

               {isAdmin && (
                 <>
                   <button
                     onClick={onAdminTake} disabled={disabled}
                     className="p-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20"
                     title="Take Ticket"
                   ><UserCheck size={14} /></button>
                   <button
                     onClick={onAdminRelease} disabled={disabled}
                     className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20"
                     title="Release Ticket"
                   ><UserX size={14} /></button>
                   <button
                     onClick={onAdminClose} disabled={disabled}
                     className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20"
                     title="Close Ticket"
                   ><XCircle size={14} /></button>
                 </>
               )}
            </div>

            {/* Right Actions (Jump) */}
            {showJump && (
              <button
                type="button"
                onClick={onJump}
                className="flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase rounded-full bg-light-accent dark:bg-dark-accent text-white shadow-neon animate-bounce-small"
              >
                 {(t && t('chat.latest')) || 'Abajo'} <ArrowDown size={10} />
              </button>
            )}
         </div>
      )}

      {/* Input Capsule */}
      <div className="relative flex items-end gap-2 p-1.5 rounded-2xl bg-light-surface-tertiary/50 dark:bg-black/20 border border-light-border dark:border-dark-border focus-within:border-light-accent dark:focus-within:border-dark-accent focus-within:ring-1 focus-within:ring-light-accent/50 dark:focus-within:ring-dark-accent/50 transition-all duration-300">
        <textarea
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled || (isAdmin ? false : !clientProfileReady)}
          placeholder={(t && t('chat.type_message')) || 'Escribe un mensaje a la Nonna...'}
          className="flex-1 resize-none bg-transparent border-none text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary px-3 py-2 focus:ring-0 max-h-24 scrollbar-none"
          style={{ minHeight: '40px' }}
        />
        <button
          type="button"
          onClick={doSend}
          disabled={disabled || !text.trim()}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-light-accent dark:bg-dark-accent text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
        >
          <Send size={18} className={text.trim() ? "ml-0.5" : ""} />
        </button>
      </div>
    </div>
  );
};

export default ChatFooter;