// src/pages/whatsapp/send/WhatsAppSend.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Terminal, Users, ChevronDown, Play, Phone, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'react-toastify';

const WhatsAppSend = ({ wa }) => {
  const [mode, setMode] = useState('template'); // template | text
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLang, setTemplateLang] = useState('en_US');
  const [response, setResponse] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { wa.fetchTemplates(); }, []);

  const handleSend = async () => {
    if (!phone.trim()) { toast.error('Número de teléfono requerido'); return; }
    if (mode === 'text' && !text.trim()) { toast.error('Mensaje requerido'); return; }
    if (mode === 'template' && !templateName) { toast.error('Selecciona un template'); return; }
    
    setSending(true);
    setResponse(null);
    try {
      const data = mode === 'text'
        ? { phone: phone.replace('+', ''), type: 'text', text }
        : { phone: phone.replace('+', ''), type: 'template', template_name: templateName, template_language: templateLang };
      
      const res = await wa.sendMessage(data);
      setResponse({ status: 'success', data: res });
      toast.success('✅ Mensaje enviado');
    } catch (e) {
      const errorData = e.response?.data || e.message || e;
      setResponse({ status: 'error', data: errorData });
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = wa.templates.find(t => t.name === templateName);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">WhatsApp Playground</h2>
        <p className="text-base text-gray-500 dark:text-gray-400">Envía mensajes de texto o templates pre-aprobados a cualquier número.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="p-6 rounded-[2rem] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 shadow-xl flex flex-col gap-5">
            
            {/* Mode Selector */}
            <div className="flex p-1 bg-gray-100 dark:bg-black/30 rounded-xl">
              {[{id: 'template', label: 'Template', icon: FileText}, {id: 'text', label: 'Texto Libre', icon: MessageSquare}].map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${mode === m.id ? 'bg-white dark:bg-[#2c2c2e] text-green-500 shadow-sm' : 'text-gray-500'}`}>
                  <m.icon size={14} /> {m.label}
                </button>
              ))}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Phone size={14} className="text-green-500" /> Número de Destino
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="56994694038"
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono text-sm"
              />
            </div>

            {mode === 'template' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText size={14} className="text-green-500" /> Template
                  </label>
                  <div className="relative">
                    <select value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 appearance-none font-medium text-sm">
                      <option value="">-- Seleccionar template --</option>
                      {wa.templates.map(t => (
                        <option key={t.name} value={t.name}>{t.name} ({t.status}) [{t.language}]</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                </div>

                {/* Template Preview */}
                <AnimatePresence>
                  {selectedTemplate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/10 text-sm space-y-1">
                        <p className="font-bold text-gray-900 dark:text-white">{selectedTemplate.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Status: <span className={selectedTemplate.status === 'APPROVED' ? 'text-green-500' : 'text-yellow-500'}>{selectedTemplate.status}</span></p>
                        <p className="text-xs text-gray-500">Category: {selectedTemplate.category} · Language: {selectedTemplate.language}</p>
                        {selectedTemplate.components?.map((c, i) => (
                          <div key={i} className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-bold uppercase text-[10px]">{c.type}:</span> {c.text || c.format || JSON.stringify(c)}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Idioma</label>
                  <input type="text" value={templateLang} onChange={e => setTemplateLang(e.target.value)} className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono text-sm" />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <MessageSquare size={14} className="text-green-500" /> Mensaje
                </label>
                <textarea
                  rows={4}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm resize-none"
                />
                <p className="text-[11px] text-yellow-500">⚠️ Texto libre solo funciona dentro de la ventana de 24h después de que el usuario te escriba.</p>
              </div>
            )}
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSend} disabled={sending} className="w-full p-4 rounded-[1.5rem] bg-gradient-to-r from-green-500 to-green-600 text-white shadow-xl shadow-green-500/20 flex items-center justify-center gap-3 disabled:opacity-50 font-bold text-base transition-all">
            {sending ? <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <Play size={20} fill="currentColor" />}
            Enviar WhatsApp
          </motion.button>
        </div>

        {/* Terminal */}
        <div className="lg:col-span-7 flex flex-col h-[500px] border border-gray-200/60 dark:border-white/10 rounded-[2rem] overflow-hidden bg-white/80 dark:bg-[#0c0c0c]/80 backdrop-blur-3xl shadow-2xl">
          <div className="flex items-center px-5 py-3.5 bg-gray-50/80 dark:bg-[#1a1a1a]/80 border-b border-gray-200/50 dark:border-white/5">
            <div className="flex gap-2 mr-4">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex-1 text-center text-[13px] font-semibold text-gray-500 dark:text-gray-400">WhatsApp Console</div>
            {response && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${response.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                {response.status}
              </span>
            )}
          </div>
          <div className="flex-1 p-6 overflow-auto font-mono text-[13px] leading-relaxed text-gray-800 dark:text-gray-300">
            {sending ? (
              <div className="animate-pulse flex gap-2 items-start">
                <div className="h-3 w-3 bg-green-500 rounded-full" />
                <div className="h-3 w-3 bg-green-500/70 rounded-full" />
                <div className="h-3 w-3 bg-green-500/40 rounded-full" />
              </div>
            ) : response ? (
              <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre-wrap">
                {JSON.stringify(response.data, null, 2)}
              </motion.pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-600 flex-col gap-4">
                <div className="p-4 rounded-full bg-gray-100 dark:bg-white/5"><Terminal size={32} /></div>
                <span className="font-sans text-sm font-medium">Ingresa un número y envía un mensaje para ver el resultado.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSend;
