import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, CreditCard, CheckCircle2, Terminal } from 'lucide-react';

const TrackerPlayground = ({ service, eventsFired, onFireEvent, trackerId }) => {
  const { t } = useTranslation('tracker_guides');
  const consoleRef = useRef(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [eventsFired]);

  const handleAction = (eventName) => {
    onFireEvent({
      id: Date.now().toString(),
      name: eventName,
      time: new Date().toLocaleTimeString(),
      service
    });
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Simulator UI */}
      <div className="flex-1 bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 rounded-3xl border border-light-border/40 dark:border-dark-border/40 p-6 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-xl">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-matrix-green/5 to-vanellix-cyan/5 z-0" />
        
        <div className="z-10 text-center mb-8">
          <h3 className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            {t('playground.title', 'Interactive Simulator')}
          </h3>
          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
            {t('playground.subtitle', 'Test your pixels before saving')}
          </p>
        </div>
        
        {(!trackerId || trackerId.length < 3) && (
          <div className="absolute inset-0 z-20 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-light-surface dark:bg-dark-surface p-6 rounded-3xl shadow-2xl border border-light-border/50 dark:border-dark-border/50 max-w-sm">
              <div className="w-12 h-12 rounded-full bg-matrix-green/20 text-matrix-green flex items-center justify-center mx-auto mb-4">
                <Terminal size={24} />
              </div>
              <h4 className="font-bold text-lg text-light-text-primary dark:text-dark-text-primary mb-2">
                Awaiting Configuration
              </h4>
              <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                Please enter your ID in the steps on the left to unlock the simulator and test your events.
              </p>
            </div>
          </div>
        )}

        <div className="z-10 grid grid-cols-1 gap-4 w-full max-w-xs">
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction('add_to_cart')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/50 dark:border-dark-border/50 shadow-lg hover:border-matrix-green/50 transition-colors group"
          >
            <ShoppingCart className="text-matrix-green group-hover:scale-110 transition-transform" />
            <span className="font-bold text-light-text-primary dark:text-dark-text-primary">
              {t('playground.add_to_cart', 'Add to Cart')}
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction('begin_checkout')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-light-surface/60 dark:bg-dark-surface/60 border border-light-border/50 dark:border-dark-border/50 shadow-lg hover:border-blue-500/50 transition-colors group"
          >
            <CreditCard className="text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-light-text-primary dark:text-dark-text-primary">
              {t('playground.begin_checkout', 'Begin Checkout')}
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAction('purchase')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-matrix-green to-vanellix-cyan text-black shadow-neon group"
          >
            <CheckCircle2 className="text-black group-hover:scale-110 transition-transform" />
            <span className="font-bold">
              {t('playground.purchase', 'Purchase')}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Terminal / Live Event Log */}
      <div className="h-48 bg-[#0D1117] rounded-3xl border border-gray-800 p-4 flex flex-col font-mono text-xs relative overflow-hidden">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-800 mb-3 text-gray-400">
          <Terminal size={14} className="text-matrix-green" />
          <span className="font-semibold tracking-wider uppercase text-[10px]">
            {t('playground.console_title', 'Live Event Log')}
          </span>
          <div className="ml-auto flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
        </div>

        <div ref={consoleRef} className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {eventsFired.length === 0 ? (
            <div className="text-gray-600 italic flex items-center gap-2 h-full justify-center">
              <span className="animate-pulse">_</span> {t('playground.console_waiting', 'Waiting for events...')}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {eventsFired.map((ev) => (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col gap-1 bg-gray-900/50 p-2 rounded-lg border border-gray-800/50"
                >
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-matrix-green">[{ev.time}]</span>
                    <span className="text-blue-400">[{ev.service.toUpperCase()}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500">✅ {t('playground.event_fired', 'Event Fired')}:</span>
                    <span className="text-white font-bold">{ev.name}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackerPlayground;
