import React, { useCallback, useState } from 'react';
import { Plus, X, Loader2, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../../../../utils/imageCompression';

const ChatInput = ({
  disabled = false,
  placeholder = 'Mensaje',
  onSend,
  onTyping,
  onUpload,
  topActions,
  leftActions,
}) => {
  const [text, setText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null); // { url, type, name, isUploading: boolean }
  const fileInputRef = React.useRef(null);

  const handleChange = useCallback((e) => {
    const v = e.target.value;
    setText(v);
    onTyping?.(v.length > 0);
  }, [onTyping]);

  const doSend = useCallback(() => {
    const trimmed = (text || '').trim();
    if ((!trimmed && !selectedMedia?.url) || disabled || selectedMedia?.isUploading) return;
    
    onSend?.(trimmed, selectedMedia?.url);
    
    setText('');
    setSelectedMedia(null);
    onTyping?.(false);
  }, [text, disabled, onSend, onTyping, selectedMedia]);

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
      console.error('Failed to upload media', err);
      setSelectedMedia(null);
    }
    e.target.value = '';
  };

  return (
    <div className="w-full px-4 py-3 pb-6 sm:pb-4 backdrop-blur-2xl bg-light-surface/80 dark:bg-dark-surface/80 border-t border-light-border/20 dark:border-dark-border/20">
      
      {/* Top Actions Row */}
      {topActions && (
         <div className="flex items-center justify-between gap-2 mb-3">
            {topActions}
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
        
        {leftActions}

        {onUpload && (
          <div className="pl-1 pb-0.5">
             <button
               type="button"
               onClick={() => fileInputRef.current?.click()}
               disabled={disabled || selectedMedia?.isUploading}
               className="h-8 w-8 flex items-center justify-center rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface/80 dark:hover:bg-dark-surface/80 hover:text-light-accent dark:hover:text-dark-accent transition-all disabled:opacity-50"
               title="Adjuntar Archivo"
             >
               <Plus size={22} strokeWidth={2.5} />
             </button>
             <input 
               ref={fileInputRef} 
               type="file" 
               accept="image/*,video/*,.pdf,.doc,.docx" 
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
          disabled={disabled || selectedMedia?.isUploading}
          placeholder={selectedMedia?.isUploading ? 'Subiendo...' : placeholder}
          className="flex-1 resize-none bg-transparent border-none text-[15px] leading-tight text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary px-2 py-[10px] focus:ring-0 max-h-[120px] scrollbar-none"
          style={{ minHeight: '38px' }}
        />
        
        <div className="pr-1 pb-0.5">
          <button
            type="button"
            onClick={doSend}
            disabled={disabled || (!text.trim() && !selectedMedia?.url) || selectedMedia?.isUploading}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-light-accent dark:bg-dark-accent text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 disabled:bg-light-surface-secondary dark:disabled:bg-dark-surface-secondary disabled:text-light-text-tertiary dark:disabled:text-dark-text-tertiary shadow-sm"
          >
            <ArrowUp size={18} strokeWidth={3} className={text.trim() || selectedMedia?.url ? "mt-[1px]" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;