import React from 'react';
import { motion } from 'framer-motion';

/**
 * Replaces Handlebars-style {{variables}} in a template string using a payload object.
 */
const renderTemplate = (templateStr, payload) => {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const cleanKey = key.trim();
    // Resolve dot notation (e.g. customer.name)
    const value = cleanKey.split('.').reduce((acc, part) => acc && acc[part], payload);
    return value !== undefined && value !== null ? value : match;
  });
};

const NotificationPreview = ({ template, trigger }) => {
  // Extract mock data from trigger
  const mockPayload = trigger?.mock_payload || {};
  
  // Extract configuration from template
  const rawTitle = template?.title_template || 'Nuevo mensaje';
  const rawBody = template?.body_template || 'Aquí va el contenido de tu notificación...';
  const iconUrl = template?.icon_url;
  const imageUrl = template?.image_url;
  
  // Render templates with mock data
  const title = renderTemplate(rawTitle, mockPayload);
  const body = renderTemplate(rawBody, mockPayload);
  
  // Current time for the mockup header
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full h-full min-h-[500px] bg-gradient-to-br from-gray-900 to-black rounded-[40px] p-4 relative overflow-hidden shadow-2xl border-[8px] border-black/80 flex flex-col">
      {/* iOS Status Bar */}
      <div className="flex justify-between items-center px-4 pt-1 text-white text-[11px] font-medium z-10 opacity-90">
        <span>{timeString}</span>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
            <path d="M1 8L3 10L6 7L13 0L14 1L6 9L1 8Z" />
          </svg>
          <div className="w-4 h-2.5 bg-white rounded-sm"></div>
        </div>
      </div>

      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black/80 rounded-b-2xl z-20"></div>
      
      {/* iOS Lock Screen Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-40 blur-sm"></div>

      {/* Lock Screen Time */}
      <div className="relative z-10 mt-12 text-center">
        <h1 className="text-white text-6xl font-extralight tracking-tighter">{timeString}</h1>
        <p className="text-white/80 text-sm mt-1 font-medium">Lunes, 16 de Mayo</p>
      </div>

      {/* Notifications Stack */}
      <div className="relative z-10 mt-auto mb-10 w-full px-2 flex flex-col gap-2">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full bg-white/60 dark:bg-[#2c2c2e]/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-lg border border-white/20"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-black/20 border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2">
              {iconUrl ? (
                <img src={iconUrl} alt="App Icon" className="w-5 h-5 rounded-[5px] object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-[5px] bg-gradient-to-br from-matrix-green to-vanellix-cyan flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">V</span>
                </div>
              )}
              <span className="text-[11px] font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide">
                Piccola Italia
              </span>
            </div>
            <span className="text-[11px] text-black/40 dark:text-white/40">ahora</span>
          </div>
          
          {/* Content */}
          <div className="p-4">
            <h4 className="text-[15px] font-bold text-black/90 dark:text-white/90 leading-tight mb-1">
              {title}
            </h4>
            <p className="text-[14px] text-black/70 dark:text-white/70 leading-snug">
              {body}
            </p>
          </div>
          
          {/* Rich Media (Image) */}
          {imageUrl && (
            <div className="px-4 pb-4">
              <div className="w-full h-32 rounded-xl overflow-hidden">
                <img src={imageUrl} alt="Push Attachment" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </motion.div>
      </div>
      
      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/50 rounded-full z-20"></div>
    </div>
  );
};

export default NotificationPreview;
