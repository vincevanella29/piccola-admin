// ImagePickerModal.jsx — Modal: AI image generator + asset gallery
// Receives generateMarketingImage/fetchMarketingAssets from hook via props
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaMagic, FaSpinner, FaImage, FaCheck, FaUpload, FaTimesCircle } from 'react-icons/fa';

const STYLES = [
  { value: 'banner', label: '🖼 Banner', desc: 'Header ancho para emails' },
  { value: 'promo', label: '⭐ Promo', desc: 'Promoción de productos' },
  { value: 'hero', label: '🎬 Hero', desc: 'Imagen hero impactante' },
];

const ImagePickerModal = ({ open, generateMarketingImage, fetchMarketingAssets, onSelect, onClose }) => {
  const [tab, setTab] = useState('assets');
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [style, setStyle] = useState('banner');
  const [prompt, setPrompt] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referencePreview, setReferencePreview] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    loadAssets();
  }, [open]);

  const loadAssets = async () => {
    if (!fetchMarketingAssets) return;
    setLoadingAssets(true);
    try { const r = await fetchMarketingAssets(50); setAssets(r?.assets || []); }
    catch { setAssets([]); }
    setLoadingAssets(false);
  };

  const generate = async () => {
    if (!generateMarketingImage) return;
    setGenerating(true); setError(''); setResult(null);
    try {
      const r = await generateMarketingImage({ style, prompt, referenceUrl: referenceUrl || undefined });
      setResult(r);
      loadAssets();
    } catch (e) { setError(e?.message || 'Error generando imagen'); }
    setGenerating(false);
  };

  // File upload → base64 data URI for reference
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target.result;
      setReferenceUrl(dataUri);
      setReferencePreview(dataUri);
    };
    reader.readAsDataURL(file);
  };

  const clearReference = () => {
    setReferenceUrl('');
    setReferencePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelect = (url) => { onSelect(url); onClose(); };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
          className="bg-light-surface dark:bg-dark-surface rounded-2xl border border-light-border/10 dark:border-dark-border/10 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-light-border/10 dark:border-dark-border/10">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-light-text-primary dark:text-dark-text-primary">🖼 Imágenes</h3>
              <div className="flex gap-1 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg p-0.5">
                <button onClick={() => setTab('assets')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${tab === 'assets' ? 'bg-matrix-green/20 text-matrix-green' : 'text-light-text-tertiary hover:text-light-text-secondary'}`}>
                  <FaImage size={9} className="inline mr-1" /> Mis Assets
                </button>
                <button onClick={() => setTab('generate')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${tab === 'generate' ? 'bg-purple-500/20 text-purple-400' : 'text-light-text-tertiary hover:text-light-text-secondary'}`}>
                  <FaMagic size={9} className="inline mr-1" /> Generar con AI
                </button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary text-light-text-tertiary">
              <FaTimes size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'assets' ? (
              loadingAssets ? (
                <div className="flex items-center justify-center py-16"><FaSpinner className="animate-spin text-matrix-green" size={20} /></div>
              ) : assets.length === 0 ? (
                <div className="text-center py-16">
                  <span className="text-4xl mb-3 block opacity-30">🖼</span>
                  <p className="text-sm font-bold text-light-text-tertiary">No hay imágenes generadas aún</p>
                  <button onClick={() => setTab('generate')} className="mt-3 px-4 py-2 text-xs font-bold bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors">
                    <FaMagic size={10} className="inline mr-1" /> Generar tu primera imagen
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {assets.map(a => (
                    <button key={a.id} onClick={() => handleSelect(a.url)}
                      className="group relative bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 dark:border-dark-border/10 rounded-xl overflow-hidden hover:border-matrix-green/40 hover:shadow-lg transition-all">
                      <img src={a.url} alt={a.style} className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-matrix-green text-black text-xs font-bold rounded-lg transition-opacity">Usar imagen</span>
                      </div>
                      <div className="p-2">
                        <div className="flex items-center gap-1">
                          <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-md uppercase ${a.style === 'banner' ? 'bg-blue-500/10 text-blue-400' : a.style === 'promo' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-400'}`}>{a.style}</span>
                          <span className="text-[9px] text-light-text-tertiary truncate">{a.prompt || 'AI generated'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="max-w-lg mx-auto space-y-4">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">Genera imágenes profesionales para tus emails con Grok AI</p>
                <div className="grid grid-cols-3 gap-2">
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={`px-3 py-3 rounded-xl border transition-all text-center ${style === s.value ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 text-light-text-secondary hover:border-purple-500/20'}`}>
                      <span className="text-lg block">{s.label.split(' ')[0]}</span>
                      <span className="text-[10px] font-bold block mt-1">{s.label.split(' ')[1]}</span>
                      <span className="text-[9px] text-light-text-tertiary block">{s.desc}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">Instrucciones (opcional)</label>
                  <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder="Ej: pizza napolitana con ingredientes frescos..."
                    className="w-full px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-xl text-sm outline-none focus:ring-1 focus:ring-purple-500/30 text-light-text-primary dark:text-dark-text-primary resize-none" />
                </div>

                {/* Reference image upload */}
                <div>
                  <label className="block text-[10px] font-bold text-light-text-tertiary mb-1 uppercase">📷 Imagen de referencia (opcional)</label>
                  <p className="text-[9px] text-light-text-tertiary mb-2">Sube una foto de un plato o producto y la AI la usará como base</p>
                  {referencePreview ? (
                    <div className="relative inline-block">
                      <img src={referencePreview} alt="Referencia" className="h-28 rounded-xl border border-purple-500/20 object-cover" />
                      <button onClick={clearReference}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-colors">
                        <FaTimesCircle size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-light-border/20 dark:border-dark-border/20 rounded-xl text-xs font-bold text-light-text-tertiary hover:border-purple-500/30 hover:text-purple-400 transition-colors">
                      <FaUpload size={10} /> Subir foto de referencia
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </div>
                <button onClick={generate} disabled={generating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {generating ? <><FaSpinner className="animate-spin" size={12} /> Generando con Grok...</> : <><FaMagic size={12} /> Generar Imagen AI</>}
                </button>
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
                {result?.image_url && (
                  <div className="space-y-3">
                    <img src={result.image_url} alt="AI Generated" className="w-full rounded-xl border border-purple-500/20 shadow-lg" />
                    <button onClick={() => handleSelect(result.image_url)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold bg-matrix-green text-black rounded-xl hover:bg-matrix-green/80 transition-colors">
                      <FaCheck size={10} /> Usar esta imagen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImagePickerModal;
