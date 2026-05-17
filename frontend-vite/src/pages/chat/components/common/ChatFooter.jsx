import React, { useCallback, useState } from 'react';
import { Plus, ArrowDown, UserCheck, UserX, XCircle, X, Loader2, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../../../../utils/imageCompression';

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
    <div className="w-full px-4 py-3 pb-6 sm:pb-4 backdrop-blur-2xl bg-light-surface/80 dark:bg-dark-surface/80 border-t border-light-border/20 dark:border-dark-border/20">
      
      {/* Top Row: Actions & Jump Button */}
      {(showJump || isAdmin || (!isAdmin && !newDisabled)) && (
         <div className="flex items-center justify-between gap-2 mb-3">
            
            {/* Left Actions */}
            <div className="flex items-center gap-2">
               {!isAdmin && (
                 <button
                   type="button"
                   onClick={onClientNew}
                   disabled={newDisabled}
                   className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border/50 dark:border-dark-border/50 hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors disabled:opacity-50"
                 >
                   <Plus size={14} /> {(t && t('chat.new')) || 'Nuevo'}
                 </button>
               )}

               {isAdmin && (
                 <div className="flex items-center gap-1.5">
                   {isClosed ? (
                     <button
                       onClick={onAdminReopen} disabled={adminDisabled}
                       className="px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent hover:bg-light-accent/20 dark:hover:bg-dark-accent/20 text-[11px] font-bold uppercase tracking-wide transition-colors"
                       title="Reabrir Ticket"
                     >
                       Reabrir
                     </button>
                   ) : (
                     <>
                       <button
                         onClick={onAdminTake} disabled={disabled}
                         className="p-2 rounded-full bg-light-success/10 dark:bg-dark-success/10 text-light-success dark:text-dark-success hover:bg-light-success/20 dark:hover:bg-dark-success/20 transition-colors"
                         title="Tomar Chat"
                       ><UserCheck size={16} /></button>
                       <button
                         onClick={onAdminRelease} disabled={disabled}
                         className="p-2 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 transition-colors"
                         title="Soltar Chat"
                       ><UserX size={16} /></button>
                       <button
                         onClick={onAdminClose} disabled={disabled}
                         className="p-2 rounded-full bg-light-error/10 dark:bg-dark-error/10 text-light-error dark:text-dark-error hover:bg-light-error/20 dark:hover:bg-dark-error/20 transition-colors"
                         title="Cerrar Chat"
                       ><XCircle size={16} /></button>
                     </>
                   )}
                 </div>
               )}
            </div>

            {/* Right Actions (Jump) */}
            {showJump && (
              <button
                type="button"
                onClick={onJump}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase rounded-full bg-light-accent dark:bg-dark-accent text-white shadow-lg animate-bounce-small"
              >
                 {(t && t('chat.latest')) || 'Abajo'} <ArrowDown size={14} />
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
            className="mb-3 relative inline-block"
          >
             <div className="relative">
                {selectedMedia.type.startsWith('image/') ? (
                   <img src={selectedMedia.url} alt="preview" className="h-24 w-auto rounded-xl object-cover border border-light-border/30 dark:border-dark-border/30 shadow-md" />
                ) : (
                   <div className="h-20 w-32 rounded-xl bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary border border-light-border/20 p-2 text-center break-all shadow-sm">
                      {selectedMedia.name}
                   </div>
                )}
                {selectedMedia.isUploading && (
                   <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <Loader2 size={20} className="text-white animate-spin" />
                   </div>
                )}
                <button
                   onClick={() => setSelectedMedia(null)}
                   className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-light-error dark:bg-dark-error text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                   <X size={12} strokeWidth={3} />
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Capsule - Apple Style */}
      <div className="relative flex items-end gap-2 p-1.5 bg-light-surface-tertiary/60 dark:bg-dark-surface-tertiary/60 border border-light-border/30 dark:border-dark-border/30 rounded-3xl transition-all duration-300 focus-within:ring-2 focus-within:ring-light-accent/30 dark:focus-within:ring-dark-accent/30 focus-within:border-light-accent/50 dark:focus-within:border-dark-accent/50 shadow-inner">
        
        {onUpload && (
          <div className="pl-1 pb-0.5">
             <button
               type="button"
               onClick={() => fileInputRef.current?.click()}
               disabled={disabled || uploading || (!isAdmin && !clientProfileReady)}
               className="h-8 w-8 flex items-center justify-center rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface/80 dark:hover:bg-dark-surface/80 hover:text-light-accent dark:hover:text-dark-accent transition-all disabled:opacity-50"
               title="Adjuntar Imagen"
             >
               <Plus size={22} strokeWidth={2.5} />
             </button>
             <input 
               ref={fileInputRef} 
               type="file" 
               accept="image/*" 
               className="hidden" 
               onChange={handleFileSelect} 
             />
          </div>
        )}

        <textarea
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled || uploading || (isAdmin ? false : !clientProfileReady)}
          placeholder={uploading ? 'Subiendo...' : ((t && t('chat.type_message')) || 'Mensaje')}
          className="flex-1 resize-none bg-transparent border-none text-[15px] leading-tight text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary px-2 py-[10px] focus:ring-0 max-h-[120px] scrollbar-none"
          style={{ minHeight: '38px' }}
        />
        
        <div className="pr-1 pb-0.5">
          <button
            type="button"
            onClick={doSend}
            disabled={disabled || (!text.trim() && !selectedMedia?.url)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-light-accent dark:bg-dark-accent text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:bg-light-surface-secondary dark:disabled:bg-dark-surface-secondary disabled:text-light-text-tertiary dark:disabled:text-dark-text-tertiary shadow-sm"
          >
            <ArrowUp size={18} strokeWidth={3} className={text.trim() || selectedMedia?.url ? "mt-[1px]" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatFooter;