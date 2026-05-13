import { useState, useRef, useEffect, useCallback } from 'react';
import useCommunityActions from '../useCommunityActions';

export default function useChannelView({
  channel,
  messages,
  onSend,
  onUpload,
  onLoadOlder,
  onNotifyTyping,
  token,
  myWallet,
  isGroup,
  groupName,
  appState
}) {
  const [text, setText] = useState('');
  const [sharingMerits, setSharingMerits] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showJump, setShowJump] = useState(false);
  
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingRef = useRef(false);

  const actions = useCommunityActions(appState);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages?.length]);

  // Initial scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [channel?.slug]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(distFromBottom > 200);
    if (el.scrollTop < 50 && onLoadOlder) onLoadOlder();
  }, [onLoadOlder]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim(), replyTo?.id || null);
    setText('');
    setReplyTo(null);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    const url = await onUpload(file);
    if (url) {
      onSend(`${text}\n${url}`.trim(), replyTo?.id || null);
      setText('');
      setReplyTo(null);
    }
    e.target.value = '';
  };

  const handleTyping = (val) => {
    setText(val);
    if (!typingRef.current && val.length > 0) {
      typingRef.current = true;
      onNotifyTyping?.(true);
    } else if (val.length === 0 && typingRef.current) {
      typingRef.current = false;
      onNotifyTyping?.(false);
    }
  };

  const handleShareMerits = async () => {
    if (!token || sharingMerits) return;
    setSharingMerits(true);
    try {
      const res = await actions.fetchMyMerits();
      if (res && res.merits) {
        let totalPoints = 0;
        res.merits.history_fulfilled?.forEach(m => totalPoints += (m.merit_points || 0));
        res.merits.current_month?.forEach(m => {
          if (m.status === 'fulfilled') totalPoints += (m.merit_points || 0);
        });
        
        const message = `🏆 ¡Hola equipo! Actualmente tengo **${totalPoints} puntos** de mérito en Vanellix. ¡Vamos por más! 🔥`;
        onSend(message, replyTo?.id || null);
        setReplyTo(null);
      }
    } catch (e) {
      console.error('Error sharing merits', e);
    } finally {
      setSharingMerits(false);
    }
  };

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  return {
    text, setText,
    replyTo, setReplyTo,
    showJump, setShowJump,
    sharingMerits,
    scrollRef, bottomRef, fileInputRef,
    handleScroll, handleSend, handleKeyDown, handleFileSelect, handleTyping, handleShareMerits,
    scrollToBottom
  };
}
