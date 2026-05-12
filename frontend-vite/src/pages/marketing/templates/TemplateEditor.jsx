// TemplateEditor.jsx — Drag & drop builder: Canvas | Live Preview
// Props from hook: searchProducts, getBestsellers, generateMarketingImage, fetchMarketingAssets
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { FaSave, FaTimes, FaCode, FaDesktop, FaMobileAlt } from 'react-icons/fa';
import EmailCanvas from './EmailCanvas';
import ProductPickerModal from './ProductPickerModal';
import ImagePickerModal from './ImagePickerModal';
import { compileBlocks, createBlock } from './blockCompiler';

const TYPES = [
  { value: 'transactional', label: '📋 Trans.' },
  { value: 'automation', label: '🤖 Auto.' },
  { value: 'campaign', label: '📣 Campaña' },
];

const DEFAULT_BLOCKS = [
  createBlock('header', { title: 'La Piccola Italia', subtitle: '' }),
  createBlock('text', { html: '<h2>¡Hola {{customer_name}}!</h2><p>Gracias por tu pedido.</p>' }),
  createBlock('variable', { variable: 'order_items_html' }),
  createBlock('button', { text: 'Volver a pedir', url: '{{reorder_url}}', color: '#22c55e' }),
];

const TemplateEditor = ({
  template, onSave, onCancel, onPreview,
  searchProducts, getBestsellers, generateMarketingImage, fetchMarketingAssets,
}) => {
  const isNew = !template?._id;

  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [type, setType] = useState(template?.type || 'campaign');
  const [blocks, setBlocks] = useState(template?.blocks || DEFAULT_BLOCKS);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState('card');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const iframeRef = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Live preview
  useEffect(() => {
    if (iframeRef.current) {
      const html = compileBlocks(blocks);
      const doc = iframeRef.current.contentDocument;
      doc.open(); doc.write(html); doc.close();
    }
  }, [blocks]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks(prev => {
      const oi = prev.findIndex(b => b.id === active.id);
      const ni = prev.findIndex(b => b.id === over.id);
      return (oi === -1 || ni === -1) ? prev : arrayMove(prev, oi, ni);
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) return;
    setSaving(true);
    try { await onSave({ name, subject, html: compileBlocks(blocks), type, blocks }); }
    finally { setSaving(false); }
  };

  // Product picker
  const openPicker = (mode) => { setPickerMode(mode); setPickerOpen(true); };
  const addProductCard = (p) => setBlocks(prev => [...prev, createBlock('product_card', { name: p.nombre, price: p.precio, image: p.media_r2 || '', codigo: p.codigo })]);
  const addProductGrid = (prods) => setBlocks(prev => [...prev, createBlock('product_grid', { products: prods.map(p => ({ name: p.nombre, price: p.precio, image: p.media_r2 || '', codigo: p.codigo })) })]);

  // Block add handler
  const onAddBlock = (type) => {
    if (type === 'product_card') { openPicker('card'); return; }
    if (type === 'product_grid') { openPicker('grid'); return; }
    if (type === 'image') { setImagePickerOpen(true); return; }
    setBlocks(prev => [...prev, createBlock(type)]);
  };

  const addImage = (url) => setBlocks(prev => [...prev, createBlock('image', { src: url, alt: 'Marketing' })]);

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-end gap-2 bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl p-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[9px] font-bold text-light-text-tertiary mb-0.5 uppercase">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Confirmación"
            className="w-full px-2.5 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" />
        </div>
        <div className="flex-[2] min-w-[180px]">
          <label className="block text-[9px] font-bold text-light-text-tertiary mb-0.5 uppercase">Asunto</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tu pedido {{order_number}} 🍕"
            className="w-full px-2.5 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-matrix-green/30 text-light-text-primary dark:text-dark-text-primary" />
        </div>
        <div className="flex gap-1">
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`px-2 py-1.5 text-[9px] font-bold rounded-lg border transition-all ${type === t.value ? 'bg-matrix-green/20 border-matrix-green/40 text-matrix-green' : 'bg-light-surface-secondary dark:bg-dark-surface-secondary border-light-border/10 text-light-text-tertiary'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowCode(!showCode)} className={`p-1.5 rounded-lg transition-colors ${showCode ? 'bg-purple-500/20 text-purple-400' : 'text-light-text-tertiary hover:text-purple-400'}`}><FaCode size={11} /></button>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-light-text-tertiary hover:text-red-400"><FaTimes size={11} /></button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !subject.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-matrix-green text-black rounded-lg hover:bg-matrix-green/80 disabled:opacity-50">
            <FaSave size={10} /> {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* 2 panels: Canvas | Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {showCode ? (
            <textarea value={compileBlocks(blocks)} readOnly
              className="w-full h-full px-3 py-2 bg-dark-surface border border-light-border/10 rounded-xl text-[10px] text-matrix-green font-mono outline-none resize-none" />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <EmailCanvas blocks={blocks} onBlocksChange={setBlocks} onAddBlock={onAddBlock} />
            </DndContext>
          )}
        </div>

        <div className="bg-light-surface dark:bg-dark-surface border border-light-border/10 dark:border-dark-border/10 rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-light-border/10 dark:border-dark-border/10 bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50">
            <span className="text-[9px] font-bold text-light-text-tertiary uppercase tracking-wider">📧 Preview — {blocks.length} bloques</span>
            <div className="flex gap-0.5">
              <button onClick={() => setMobilePreview(false)} className={`p-1 rounded transition-colors ${!mobilePreview ? 'bg-matrix-green/20 text-matrix-green' : 'text-light-text-tertiary'}`}><FaDesktop size={10} /></button>
              <button onClick={() => setMobilePreview(true)} className={`p-1 rounded transition-colors ${mobilePreview ? 'bg-matrix-green/20 text-matrix-green' : 'text-light-text-tertiary'}`}><FaMobileAlt size={10} /></button>
            </div>
          </div>
          <div className="flex-1 flex items-start justify-center p-3 bg-[#eee] dark:bg-[#1a1a1a] overflow-y-auto">
            <div className={`bg-white rounded-lg shadow-lg transition-all duration-300 overflow-hidden ${mobilePreview ? 'w-[375px]' : 'w-full max-w-[600px]'}`}>
              <iframe ref={iframeRef} title="Preview" className="w-full border-0" style={{ minHeight: mobilePreview ? 600 : 500 }} sandbox="allow-same-origin allow-scripts" />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductPickerModal open={pickerOpen} mode={pickerMode}
        searchProducts={searchProducts} getBestsellers={getBestsellers}
        onInsertCard={addProductCard} onInsertGrid={addProductGrid} onClose={() => setPickerOpen(false)} />
      <ImagePickerModal open={imagePickerOpen}
        generateMarketingImage={generateMarketingImage} fetchMarketingAssets={fetchMarketingAssets}
        onSelect={addImage} onClose={() => setImagePickerOpen(false)} />
    </div>
  );
};

export default TemplateEditor;
