import React, { useCallback, useState } from 'react';
import { Send, Plus, ArrowDown, UserCheck, UserX, XCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../../../../utils/imageCompression';

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
  onAdminReopen,
  onAdminTyping,
  isClosed,
  showJump,
  onJump,
  onUpload,
}) => {
  const isAdmin = variant === 'admin' || variant === 'delivery';
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null); // { url, type, name, isUploading: boolean }
  const fileInputRef = React.useRef(null);

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
    if ((!trimmed && !selectedMedia?.url) || disabled) return;
    
    if (isAdmin) {
      onAdminReply?.(trimmed, selectedMedia?.url);
    } else {
      onClientSend?.(trimmed, selectedMedia?.url);
    }
    
    setText('');
    setSelectedMedia(null);
    if (isAdmin) onAdminTyping?.(false);
    else onClientTyping?.(false);
  }, [text, disabled, isAdmin, onAdminReply, onClientSend, onAdminTyping, onClientTyping, selectedMedia]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }, [doSend]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    
    const isImage = file.type.startsWith('image/');
    setSelectedMedia({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
      isUploading: true
    });
    
    try {
      let fileToUpload = file;
      if (isImage) {
        try {
          fileToUpload = await compressImage(file, 1080, 0.8);
        } catch (err) {
          console.error('Compression failed:', err);
        }
      }
      
      const url = await onUpload(fileToUpload);
      if (url) {
        setSelectedMedia(prev => ({ ...prev, url, isUploading: false }));
      } else {
        setSelectedMedia(null);
      }
    } catch (err) {
      console.error('Failed to upload image', err);
      setSelectedMedia(null);
    }
    e.target.value = '';
  };

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
                   {isClosed ? (
                     <button
                       onClick={onAdminReopen} disabled={adminDisabled}
                       className="px-2 py-1.5 flex items-center gap-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-[10px] font-bold uppercase"
                       title="Reabrir Ticket"
                     >
                       Reabrir
                     </button>
                   ) : (
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

      {/* Media Preview */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-2 relative inline-block"
          >
             <div className="relative">
                {selectedMedia.type.startsWith('image/') ? (
                   <img src={selectedMedia.url} alt="preview" className="h-20 w-auto rounded-lg object-cover border border-light-border/30 dark:border-dark-border/30 shadow-sm" />
                ) : (
                   <div className="h-16 w-24 rounded-lg bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-[10px] text-light-text-secondary dark:text-dark-text-secondary border border-light-border/20 p-2 text-center break-all">
                      {selectedMedia.name}
                   </div>
                )}
                {selectedMedia.isUploading && (
                   <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin" />
                   </div>
                )}
                <button
                   onClick={() => setSelectedMedia(null)}
                   className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                >
                   <X size={10} />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Capsule */}
      <div className="relative flex items-end gap-2 p-1.5 rounded-2xl bg-light-surface-tertiary/50 dark:bg-black/20 border border-light-border dark:border-dark-border focus-within:border-light-accent dark:focus-within:border-dark-accent focus-within:ring-1 focus-within:ring-light-accent/50 dark:focus-within:ring-dark-accent/50 transition-all duration-300">
        <textarea
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled || uploading || (isAdmin ? false : !clientProfileReady)}
          placeholder={uploading ? 'Subiendo imagen...' : ((t && t('chat.type_message')) || 'Escribe un mensaje a la Nonna...')}
          className="flex-1 resize-none bg-transparent border-none text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary px-3 py-2 focus:ring-0 max-h-24 scrollbar-none"
          style={{ minHeight: '40px' }}
        />
        
        {onUpload && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading || (!isAdmin && !clientProfileReady)}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-light-text-tertiary hover:text-matrix-green hover:bg-light-surface-tertiary/50 dark:hover:bg-dark-surface-tertiary/50 transition-all disabled:opacity-50"
              title="Adjuntar Imagen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect} 
            />
          </>
        )}

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