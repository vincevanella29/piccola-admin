// src/components/common/ai-chat/AIChatSidebar.jsx
// ═══════════════════════════════════════════════════════════════
// Sidebar wrapper for AIChatPanel — handles toggle animation,
// fixed height, and responsive layout.
//
// Usage:
//   <AIChatSidebar show={showAI} onClose={() => setShowAI(false)} {...panelProps} />
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AIChatPanel from './AIChatPanel';

const AIChatSidebar = ({
  show,
  onClose,
  height = 580,
  width = 380,
  ...panelProps
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20, width: 0 }}
          animate={{ opacity: 1, x: 0, width }}
          exit={{ opacity: 0, x: 20, width: 0 }}
          transition={{ type: 'spring', bounce: 0.12, duration: 0.35 }}
          className="shrink-0 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-2xl overflow-hidden"
          style={{ height, maxHeight: 'calc(100vh - 200px)' }}
        >
          <AIChatPanel {...panelProps} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIChatSidebar;
