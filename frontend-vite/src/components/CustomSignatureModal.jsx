import React, { useState } from 'react';  
import { useTranslation } from 'react-i18next';  
import { motion, AnimatePresence } from 'framer-motion';  
import { X, FileSignature, ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';  
  
const CustomSignatureModal = ({   
  isOpen,   
  onClose,   
  message,   
  uiOptions = {},  
  onConfirm,  
  onCancel,  
  isLoading = false,  
  error = null,  
  success = false  
}) => {  
  const { t } = useTranslation();  
  const [showRawMessage, setShowRawMessage] = useState(false);  
  
  const {  
    title = t('signature.sign_message') || 'Firmar Mensaje',  
    description = t('signature.no_fees') || 'Firmar este mensaje no tiene costo de gas.',  
    buttonText = t('signature.sign_continue') || 'Firmar y Continuar'  
  } = uiOptions;  
  
  if (!isOpen) return null;  
  
  return (  
    <AnimatePresence>  
      {isOpen && (
        <>
          {/* Backdrop con Blur */}
          <motion.div  
            initial={{ opacity: 0 }}  
            animate={{ opacity: 1 }}  
            exit={{ opacity: 0 }}  
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={!isLoading ? onCancel : undefined}  
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <motion.div  
              initial={{ scale: 0.95, opacity: 0, y: 20 }}  
              animate={{ scale: 1, opacity: 1, y: 0 }}  
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}  
              className="w-full max-w-md pointer-events-auto bg-light-surface dark:bg-dark-surface rounded-[32px] shadow-2xl border border-light-border dark:border-dark-border overflow-hidden flex flex-col relative"
            >  
              
              {/* Close Button (Solo si no está cargando o exitoso) */}
              {!isLoading && !success && (
                <button  
                  onClick={onCancel}  
                  className="absolute top-4 right-4 p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors z-10"  
                >  
                  <X size={20} />  
                </button>
              )}

              {/* --- HEADER --- */}
              <div className="pt-8 px-8 pb-2 flex flex-col items-center text-center">  
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`p-4 rounded-2xl mb-4 shadow-inner ${
                    success 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                      : error
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-accent dark:text-dark-accent'
                  }`}
                >  
                  {success ? <CheckCircle2 size={32} /> : error ? <AlertTriangle size={32} /> : <FileSignature size={32} />}  
                </motion.div>  
                
                <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">  
                  {success ? t('signature.success', '¡Firmado!') : error ? t('signature.failed', 'Error') : title}  
                </h2>
                
                {!success && !error && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 px-3 py-1 rounded-full">
                    <ShieldCheck size={14} className="text-green-500" />
                    {t('signature.secure_request', 'Solicitud Segura')}
                  </div>
                )}
              </div>  
      
              {/* --- CONTENT --- */}  
              <div className="px-8 py-4 space-y-5">  
                {success ? (  
                  <div className="text-center pb-6">  
                    <p className="text-light-text-secondary dark:text-dark-text-secondary">  
                      {t('signature.success_description', 'La operación se ha firmado correctamente.')}  
                    </p>  
                  </div>  
                ) : (  
                  <>  
                    {/* Info Banner */}  
                    {!error && (
                      <p className="text-sm text-center text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">  
                        {description}  
                      </p> 
                    )}
      
                    {/* Message Content (Code Block) */}  
                    {!error && message && (
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-light-accent/20 to-purple-500/20 rounded-xl blur opacity-50 group-hover:opacity-75 transition duration-200"></div>
                        <div className="relative bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-xl p-4 border border-light-border dark:border-dark-border max-h-40 overflow-y-auto scrollbar-thin">  
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] uppercase tracking-widest text-light-text-tertiary dark:text-dark-text-tertiary font-bold">
                              {showRawMessage
                                ? t('signature.raw_message', 'RAW MESSAGE')
                                : t('signature.message_preview', 'PREVIEW MESSAGE')}
                            </div>
                            <button
                              onClick={() => setShowRawMessage(!showRawMessage)}
                              className="text-[10px] px-2 py-1 rounded-full border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-colors"
                            >
                              {showRawMessage
                                ? t('signature.view_pretty', 'Ver legible')
                                : t('signature.view_raw', 'Ver RAW')}
                            </button>
                          </div>
                          <pre className="text-xs text-light-text-primary dark:text-dark-text-primary whitespace-pre-wrap font-mono break-all">  
                            {(() => {
                              if (showRawMessage) return message;
                              try {
                                const parsed = typeof message === 'string' ? JSON.parse(message) : message;

                                if (parsed && typeof parsed === 'object') {
                                  if (parsed.type === 'PROMOTION_CLAIM') {
                                    return t('promotion.claim_signature_message', {
                                      name: parsed.promotionName,
                                      wallet: parsed.walletAddress,
                                    });
                                  }

                                  if (parsed.type === 'SWAP') {
                                    return t('swap.signature_message', {
                                      walletAddress: parsed.walletAddress,
                                      inputSymbol: parsed.inputSymbol,
                                      outputSymbol: parsed.outputSymbol,
                                      inputAmount: parsed.inputAmount,
                                      outputAmount: parsed.outputAmount,
                                      minOutputAmount: parsed.minOutputAmount,
                                    });
                                  }
                                }

                                return JSON.stringify(parsed, null, 2);
                              } catch {
                                return message;
                              }
                            })()}  
                          </pre>  
                        </div>  
                      </div>
                    )}  
      
                    {/* Error Display */}  
                    {error && (  
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-3 animate-shake">  
                        <div className="text-red-500 dark:text-red-400 mt-0.5"><AlertTriangle size={18} /></div>  
                        <div>  
                          <p className="font-bold text-sm text-red-600 dark:text-red-400">  
                            {t('signature.error_title', 'Error al firmar')}  
                          </p>  
                          <p className="text-xs text-red-500 dark:text-red-300 mt-1 leading-relaxed">  
                            {error?.message || error || t('signature.unknown_error')}  
                          </p>  
                        </div>  
                      </div>  
                    )}  
                  </>  
                )}  
              </div>  
      
              {/* --- ACTIONS --- */}  
              <div className="p-8 pt-2 mt-auto">
                {success ? (  
                  <button  
                    onClick={onClose}  
                    className="w-full py-3.5 bg-light-accent dark:bg-dark-accent text-white rounded-xl font-bold shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"  
                  >  
                    {t('signature.close', 'Cerrar')}  
                  </button>  
                ) : (
                  <div className="flex gap-3">  
                    <button  
                      onClick={onCancel}  
                      disabled={isLoading}  
                      className="flex-1 py-3.5 border border-light-border dark:border-dark-border rounded-xl text-light-text-secondary dark:text-dark-text-secondary font-semibold hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors disabled:opacity-50"  
                    >  
                      {t('signature.cancel', 'Cancelar')}  
                    </button>  
                    
                    <button  
                      onClick={onConfirm}  
                      disabled={isLoading || !!error}  
                      className="flex-[1.5] py-3.5 bg-light-accent dark:bg-dark-accent text-white rounded-xl font-bold shadow-lg shadow-light-accent/20 dark:shadow-dark-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"  
                    >  
                      {isLoading ? (  
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {t('signature.signing', 'Firmando...')}
                        </>
                      ) : (
                        buttonText
                      )}  
                    </button>  
                  </div>  
                )}  
              </div>
  
            </motion.div>  
          </div>
        </>
      )}  
    </AnimatePresence>  
  );  
};  
  
export default CustomSignatureModal;