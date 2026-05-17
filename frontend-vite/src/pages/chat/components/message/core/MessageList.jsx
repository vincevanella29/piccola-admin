import React from 'react';
import MessageRow from './MessageRow';
import MessageAvatar from './MessageAvatar';
import MessageContent from './MessageContent';

const MessageList = ({
  messages = [],
  variant = 'bubble', // 'flat' (community) | 'bubble' (delivery/dm)
  myWallet,
  isAdmin = false,
  members = [],
  employeeMap = {},
  appState = {},
  customerName, // For delivery chats
  onReact,
  onReply,
  onPin,
  onAvatarClick,
  onRowClick,
  isLoading = false,
  emptyText = 'Aún no hay mensajes...',
  
  // Scroll refs
  listRef,
  onScroll,
  bottomRef,
}) => {

  const renderMessage = (m, idx) => {
    const roleStr = (m?.role || '').toLowerCase();
    
    // Core Identity Resolution
    const isBot = roleStr === 'assistant' || roleStr === 'bot' || m?.sender_wallet === 'nonna' || m?.sender_name?.includes('Nonna');
    const isMe = (m?.sender_wallet && myWallet && m?.sender_wallet.toLowerCase() === myWallet.toLowerCase()) || (isAdmin && roleStr === 'admin');
    
    // Attempt to enrich from presence/directory
    const senderWallet = (m?.sender_wallet || '').toLowerCase();
    const presenceMember = members?.find(mem => mem.wallet?.toLowerCase() === senderWallet);
    const employee = senderWallet ? employeeMap[senderWallet] : null;
    
    // Resolve Display Name
    let displayName = m?.sender_name || presenceMember?.name || employee?.name || 'Usuario';
    let avatarUrl = m?.sender_avatar_url || presenceMember?.profile_image_url || employee?.profile_image_url || '';
    
    // Special Overrides
    if (isBot) {
      displayName = 'La Nonna (AI)';
    } else if (isAdmin && roleStr === 'admin') {
      const adminWallet = m?.admin_wallet;
      const isCurrentAdmin = !adminWallet || (appState?.account || '').toLowerCase() === adminWallet.toLowerCase();
      if (!displayName || displayName === 'Local' || displayName === 'Usuario') {
         if (isCurrentAdmin) {
           displayName = appState?.profile?.name || 'Local';
           if (!avatarUrl) avatarUrl = appState?.profile?.profile_image_url || '';
         } else {
           displayName = adminWallet ? `Admin (${adminWallet.slice(0, 6)}...)` : 'Local';
         }
      }
    } else if (typeof displayName === 'string' && displayName.startsWith('0x') && displayName.length === 42) {
      displayName = employee?.name || presenceMember?.name || displayName;
    } else if (roleStr === 'user' && customerName) {
      displayName = m?.sender_name || customerName;
    }

    // Resolve Context Colors & Cargo
    const cargo = m?.sender_cargo || employee?.cargo || presenceMember?.cargo || (isBot ? 'Asistente AI' : '');
    const seccion = m?.sender_seccion || employee?.seccion || presenceMember?.seccion || '';
    
    // Time format
    const timeString = m?.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    // Construct generic participant object for clicking
    const participantData = employee || presenceMember || m;

    return (
      <MessageRow
        key={m.id || idx}
        variant={variant}
        isMine={isMe}
        isBot={isBot}
        msgId={m.id}
        senderName={displayName}
        senderCargo={cargo}
        timeString={timeString}
        isPinned={m.is_pinned}
        onReact={onReact}
        onReply={onReply}
        
        avatarSlot={
          <MessageAvatar 
            url={avatarUrl} 
            name={displayName} 
            isAssistant={isBot} 
            isAdmin={roleStr === 'admin'} 
            isMine={isMe}
            size={variant === 'flat' ? 'w-9 h-9' : 'w-8 h-8'}
            onClick={() => onAvatarClick?.(participantData)}
          />
        }
        
        replyPreviewSlot={m.reply_preview && (
          <div className={`mt-0.5 mb-1 pl-2 border-l-2 text-xs opacity-80 ${isMe && variant === 'bubble' ? 'border-dark-bg/40 text-dark-bg' : 'border-matrix-green/40 text-light-text-tertiary dark:text-dark-text-tertiary'}`}>
            <span className="font-medium">{m.reply_preview.sender_name}: </span>
            {(m.reply_preview.text || '').slice(0, 100)}
          </div>
        )}
        
        contentSlot={<MessageContent msg={m} onRowClick={onRowClick} />}
        
        mediaSlot={m.media_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {m.media_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                  ? <img src={url} alt="" className="max-w-[240px] max-h-[180px] rounded-lg object-cover border border-light-border/30 dark:border-dark-border/30" />
                  : url.match(/\.(mp4|webm|mov)$/i)
                    ? <video src={url} controls className="max-w-[300px] rounded-lg" />
                    : <span className="text-xs text-matrix-green underline">📎 Archivo adjunto</span>
                }
              </a>
            ))}
          </div>
        )}

        reactionsSlot={m.reactions && Object.keys(m.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${variant === 'bubble' && isMe ? 'justify-end' : ''}`}>
            {Object.entries(m.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(m.id, emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition ${
                  users.includes((myWallet || '').toLowerCase())
                    ? 'bg-matrix-green/15 border-matrix-green/40 text-matrix-green'
                    : 'bg-light-surface-tertiary/50 dark:bg-dark-surface-tertiary/50 border-light-border/30 dark:border-dark-border/30 hover:border-matrix-green/30 text-light-text-tertiary dark:text-dark-text-tertiary'
                }`}
              >
                {emoji} <span className="font-medium">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      />
    );
  };

  return (
    <div
      ref={listRef}
      onScroll={onScroll}
      className={`flex-1 min-h-0 w-full max-w-full relative overflow-y-auto overflow-x-hidden ${variant === 'bubble' ? 'p-3 pr-1 md:pr-2' : 'py-2'} break-words`}
    >
      {isLoading && messages.length === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm animate-pulse">Cargando historial...</p>
      ) : messages.length === 0 ? (
        <p className="text-center text-light-text/60 pt-10 text-sm">{emptyText}</p>
      ) : (
        messages.map(renderMessage)
      )}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
