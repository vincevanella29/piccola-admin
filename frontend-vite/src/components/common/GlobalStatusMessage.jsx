import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';

/**
 * GlobalStatusMessage
 * @param {'success'|'error'|'loading'} type
 * @param {string} message
 * @param {string} [txHash] - Optional transaction hash for explorer link
 * @param {string} [blockExplorerUrl] - Optional block explorer base URL
 * @param {function} [onClose] - Optional close handler
 */;

// Notificación individual
const NotificationBar = ({ type, message, txHash, blockExplorerUrl, onClose, autoHideDuration = 5000 }) => {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const [internalOpen, setInternalOpen] = useState(true);

  useEffect(() => {
    if (!type || !message) return;
    setInternalOpen(true);
    setProgress(100);
    if (timerRef.current) clearInterval(timerRef.current);
    const step = 100 / (autoHideDuration / 100);
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - step;
        if (next <= 0) {
          clearInterval(timerRef.current);
          setInternalOpen(false);
          // onClose will be called in a separate effect when internalOpen becomes false and progress is 0
          return 0;
        }
        return next;
      });
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line
  }, [type, message, autoHideDuration]);

  const handleClose = () => {
    setInternalOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
    // onClose will be called in a separate effect
  };

  // Only call onClose after animation closes and progress is 0
  useEffect(() => {
    if (!internalOpen && progress === 0) {
      if (onClose) onClose();
    }
    // eslint-disable-next-line
  }, [internalOpen, progress, onClose]);

  // Iconos minimalistas según tipo
  const iconProps = 'w-6 h-6';
  const icons = {
    success: <CheckCircle className={"text-green-400 dark:text-green-300 "+iconProps} />, 
    error: <AlertTriangle className={"text-red-400 dark:text-red-300 "+iconProps} />, 
    warning: <AlertTriangle className={"text-yellow-400 dark:text-yellow-300 "+iconProps} />,
    loading: <Loader2 className={"animate-spin text-blue-400 dark:text-blue-300 "+iconProps} />,
    info: <Loader2 className={"animate-spin text-blue-400 dark:text-blue-300 "+iconProps} />,
  };
  return (
    <AnimatePresence>
      {internalOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className={`relative flex items-center gap-3 w-full max-w-sm px-4 py-3 rounded-2xl shadow-2xl border border-white/10 dark:border-black/20 bg-neutral-900/95 dark:bg-neutral-950/95 text-neutral-100 pointer-events-auto transition-all duration-200`}
        >
          <div className="flex-shrink-0 flex items-center justify-center">
            {icons[type] || icons.info}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="font-medium text-sm sm:text-base break-words">
              {message}
            </span>
            {txHash && blockExplorerUrl && (
              <div className="mt-1 flex items-center gap-1">
                <a
                  href={`${blockExplorerUrl}/tx/${typeof txHash === 'object' && txHash !== null ? txHash.hash : txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline font-medium text-xs text-blue-400 dark:text-blue-300 hover:text-blue-200"
                >
                  <ExternalLink size={14} />
                  <span className="break-all">{typeof txHash === 'object' && txHash !== null ? txHash.hash : txHash}</span>
                </a>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="ml-2 text-lg font-bold text-neutral-400 hover:text-neutral-200 focus:outline-none"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
          {/* Progress Bar */}
          <div className="absolute left-0 bottom-0 h-1.5 w-full bg-neutral-800/70 rounded-b-2xl overflow-hidden z-20 shadow-md">
            <div
              className="bg-primary-500 dark:bg-primary-400"
              style={{ width: `${progress}%`, minWidth: '0%', maxWidth: '100%', transition: 'width 0.1s linear', background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// STACK DE NOTIFICACIONES
const GlobalStatusMessage = ({ notifications = [], onClose, autoHideDuration = 5000 }) => {
  // notifications: array de { type, message, txHash, blockExplorerUrl, id }
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col items-end space-y-3 pointer-events-none max-w-full">
      {notifications.map((n) => (
        <NotificationBar
          key={n.id || n.message+String(n.type)}
          type={n.type}
          message={n.message}
          txHash={n.txHash}
          blockExplorerUrl={n.blockExplorerUrl}
          onClose={() => onClose && onClose(n.id)}
          autoHideDuration={n.autoHideDuration || autoHideDuration}
        />
      ))}
    </div>
  );
};

export { NotificationBar, GlobalStatusMessage };
export default GlobalStatusMessage;

