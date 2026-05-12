// src/components/common/ai-chat/AIChatPanel.jsx
// ═══════════════════════════════════════════════════════════════
// Reusable AI Assistant chat panel — Grok-powered
// Used by: DeliveryConfig, Marketing, and any future admin panel
//
// Props:
//   title          — Header title (default: "Asistente IA")
//   subtitle       — Header subtitle (default: "Powered by Grok")
//   welcomeMessage — Initial assistant message
//   placeholder    — Input placeholder text
//   onSend         — async (message, history, context) => { reply, action }
//   onApply        — async (action) => void — called when user confirms action
//   context        — object passed to onSend for domain context
//   actionLabel    — function(action) => string — display label for action card
//   accentColor    — gradient start (default: "from-purple-500 to-blue-500")
// ═══════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaMagic, FaPaperPlane, FaCheck, FaTimes, FaTrash } from 'react-icons/fa';

/* ── Lightweight markdown renderer ─────────────────────────── */
const MiniMarkdown = ({ text }) => {
  const lines = (text || '').split('\n');
  return lines.map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    let html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\_(.+?)\_/g, '<em class="opacity-70">$1</em>');
    if (html.startsWith('• ') || html.startsWith('- ')) {
      return <div key={i} className="flex gap-1.5 ml-1"><span className="shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: html.slice(2) }} /></div>;
    }
    return <p key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: html }} />;
  });
};

const AIChatPanel = ({
  title = 'Asistente IA',
  subtitle = 'Powered by Grok',
  welcomeMessage = '¡Hola! 👋 ¿En qué puedo ayudarte?',
  placeholder = 'Escribe tu mensaje...',
  onSend,
  onApply,
  context,
  actionLabel,
  accentColor = 'from-purple-500 to-blue-500',
}) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsSending(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await onSend(userMsg, history, context);

      let displayReply = res.reply || '';
      if (res.action) {
        displayReply = displayReply.replace(/```json[\s\S]*?```/g, '').trim();
        if (res.action.message && !displayReply) {
          displayReply = res.action.message;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: displayReply || res.reply }]);

      if (res.action) {
        setPendingAction(res.action);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const applyAction = async () => {
    if (!pendingAction) return;
    try {
      await onApply(pendingAction);
      setMessages(prev => [...prev, { role: 'assistant', content: '✅ ¡Aplicado exitosamente!' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setPendingAction(null);
    }
  };

  const rejectAction = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Ok, cancelado. ¿Qué más necesitas?' }]);
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setPendingAction(null);
  };

  const getActionDisplayLabel = (action) => {
    if (actionLabel) return actionLabel(action);
    return `Acción: ${action.action || 'desconocida'}`;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-light-border/10 dark:border-dark-border/10 flex items-center gap-2.5 shrink-0">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accentColor} flex items-center justify-center`}>
          <FaMagic size={11} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary leading-tight">{title}</h3>
          <p className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary">{subtitle}</p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={clearChat}
            className="p-1.5 rounded-lg text-light-text-secondary/40 dark:text-dark-text-secondary/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Limpiar chat"
          >
            <FaTrash size={10} />
          </button>
        )}
      </div>

      {/* ── Messages ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin min-h-0">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-matrix-green/15 text-light-text-primary dark:text-dark-text-primary rounded-br-md'
                : 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary rounded-bl-md'
            }`}>
              <MiniMarkdown text={msg.content} />
            </div>
          </motion.div>
        ))}

        {/* Pending action confirmation */}
        <AnimatePresence>
          {pendingAction && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3"
            >
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FaMagic size={9} /> {getActionDisplayLabel(pendingAction)}
              </p>
              {pendingAction.message && (
                <p className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary mb-3 leading-relaxed">
                  {pendingAction.message}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={applyAction}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-matrix-green text-black rounded-lg hover:bg-matrix-green/80 transition-colors"
                >
                  <FaCheck size={9} /> Aplicar
                </button>
                <button
                  onClick={rejectAction}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary rounded-lg hover:text-red-400 transition-colors"
                >
                  <FaTimes size={9} /> Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-matrix-green/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-matrix-green/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-matrix-green/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* ── Input ────────────────────────────────────────── */}
      <div className="p-3 border-t border-light-border/10 dark:border-dark-border/10 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={placeholder}
            disabled={isSending}
            className="flex-1 px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-xl text-xs text-light-text-primary dark:text-dark-text-primary outline-none focus:ring-2 focus:ring-matrix-green/30 disabled:opacity-50 placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="px-3 py-2 bg-matrix-green text-black rounded-xl font-bold text-xs hover:bg-matrix-green/80 transition-colors disabled:opacity-40"
          >
            <FaPaperPlane size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
