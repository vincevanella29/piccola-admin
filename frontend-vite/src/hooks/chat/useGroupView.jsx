import { useState, useRef, useEffect, useCallback } from 'react';
import useCommunityActions from '../useCommunityActions';
import { compressImage } from '../../utils/imageCompression';

export default function useGroupView({
  group,
  messages,
  onSend,
  onUpload,
  onLoadOlder,
  onNotifyTyping,
  token,
  myWallet,
  groupName,
  appState
}) {
  const [text, setText] = useState('');
  const [sharingMerits, setSharingMerits] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showJump, setShowJump] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null); // { url, type, name, isUploading: boolean }
  
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [group?.group_id]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJump(distFromBottom > 200);
    if (el.scrollTop < 50 && onLoadOlder) onLoadOlder();
  }, [onLoadOlder]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !selectedMedia?.url) return;
    
    const mediaUrls = selectedMedia?.url ? [selectedMedia.url] : [];
    onSend(trimmed, replyTo?.id || null, mediaUrls);
    
    setText('');
    setReplyTo(null);
    setSelectedMedia(null);
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
    
    const isImage = file.type.startsWith('image/');
    setSelectedMedia({ 
      url: URL.createObjectURL(file), // Local preview
      type: file.type, 
      name: file.name,
      isUploading: true 
    });
    
    let fileToUpload = file;
    if (isImage) {
      try {
        fileToUpload = await compressImage(file, 1080, 0.8);
      } catch (err) {
        console.error('Compression failed:', err);
      }
    }
    
    try {
      const url = await onUpload(fileToUpload);
      if (url) {
        setSelectedMedia(prev => ({ ...prev, url, isUploading: false }));
      } else {
        setSelectedMedia(null);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setSelectedMedia(null);
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
    selectedMedia, setSelectedMedia,
    handleScroll, handleSend, handleKeyDown, handleFileSelect, handleTyping, handleShareMerits,
    scrollToBottom
  };
}
