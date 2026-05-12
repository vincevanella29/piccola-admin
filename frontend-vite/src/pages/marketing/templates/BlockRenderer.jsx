// BlockRenderer.jsx — Renders each block type with edit controls + drag handle
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical, FaTrash, FaCopy, FaPen } from 'react-icons/fa';

const VAR_OPTIONS = [
  { value: 'order_items_html', label: '📋 Tabla de items' },
  { value: 'suggested_products_html', label: '💡 Productos sugeridos' },
  { value: 'order_items_text', label: '📝 Items (texto)' },
];

/* ── Inline editors per block type ─────────────────────────── */

const HeaderEditor = ({ data, onChange }) => (
  <div className="space-y-2">
    <input value={data.title||''} onChange={e=>onChange({...data,title:e.target.value})} placeholder="Título"
      className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-sm text-light-text-primary dark:text-dark-text-primary outline-none" />
    <input value={data.subtitle||''} onChange={e=>onChange({...data,subtitle:e.target.value})} placeholder="Subtítulo (opcional)"
      className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs text-light-text-secondary dark:text-dark-text-secondary outline-none" />
  </div>
);

const TextEditor = ({ data, onChange }) => (
  <textarea value={data.html||''} onChange={e=>onChange({...data,html:e.target.value})} rows={4}
    className="w-full px-3 py-2 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs font-mono text-light-text-primary dark:text-dark-text-primary outline-none resize-none" />
);

const ImageEditor = ({ data, onChange }) => (
  <div className="space-y-2">
    <input value={data.src||''} onChange={e=>onChange({...data,src:e.target.value})} placeholder="URL de imagen"
      className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs text-light-text-primary dark:text-dark-text-primary outline-none" />
    <input value={data.alt||''} onChange={e=>onChange({...data,alt:e.target.value})} placeholder="Alt text"
      className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs text-light-text-secondary outline-none" />
    <input value={data.link||''} onChange={e=>onChange({...data,link:e.target.value})} placeholder="Link (opcional)"
      className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs text-light-text-secondary outline-none" />
  </div>
);

const ButtonEditor = ({ data, onChange }) => (
  <div className="flex gap-2">
    <input value={data.text||''} onChange={e=>onChange({...data,text:e.target.value})} placeholder="Texto del botón"
      className="flex-1 px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs outline-none text-light-text-primary dark:text-dark-text-primary" />
    <input value={data.url||''} onChange={e=>onChange({...data,url:e.target.value})} placeholder="URL"
      className="flex-1 px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs outline-none text-light-text-primary dark:text-dark-text-primary" />
    <input type="color" value={data.color||'#22c55e'} onChange={e=>onChange({...data,color:e.target.value})}
      className="w-8 h-8 rounded-lg border-0 cursor-pointer" />
  </div>
);

const SpacerEditor = ({ data, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-light-text-tertiary">Altura:</span>
    <input type="range" min={8} max={64} value={data.height||24} onChange={e=>onChange({...data,height:parseInt(e.target.value)})}
      className="flex-1" />
    <span className="text-xs font-mono text-light-text-secondary dark:text-dark-text-secondary">{data.height||24}px</span>
  </div>
);

const VariableEditor = ({ data, onChange }) => (
  <select value={data.variable||''} onChange={e=>onChange({...data,variable:e.target.value})}
    className="w-full px-3 py-1.5 bg-dark-surface/50 border border-light-border/10 rounded-lg text-xs text-light-text-primary dark:text-dark-text-primary outline-none">
    {VAR_OPTIONS.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
  </select>
);

/* ── Block preview (non-editing state) ─────────────────────── */

const BlockPreview = ({ block }) => {
  const { type, data } = block;
  switch (type) {
    case 'header':
      return <div className="text-center py-3"><h2 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary">🍕 <span className="text-matrix-green">{data.title||'Header'}</span></h2>{data.subtitle&&<p className="text-xs text-light-text-tertiary mt-1">{data.subtitle}</p>}</div>;
    case 'text':
      return <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed py-1" dangerouslySetInnerHTML={{__html:data.html||'<p>Texto...</p>'}} />;
    case 'image':
      return data.src ? <img src={data.src} alt={data.alt||''} className="w-full max-h-48 object-cover rounded-lg" /> : <div className="h-24 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg flex items-center justify-center text-2xl opacity-30">🖼️</div>;
    case 'product_card':
      return <div className="flex items-center gap-3 py-2">{data.image?<img src={data.image} alt="" className="w-12 h-12 rounded-lg object-cover" />:<div className="w-12 h-12 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center text-lg">🍕</div>}<div><p className="text-sm font-bold text-light-text-primary dark:text-dark-text-primary">{data.name||'Producto'}</p><p className="text-xs font-bold text-matrix-green">${Number(data.price||0).toLocaleString('es-CL')}</p></div></div>;
    case 'product_grid':
      return <div className="grid grid-cols-3 gap-2 py-1">{(data.products||[]).map((p,i)=><div key={i} className="bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg overflow-hidden"><div className="h-16">{p.image?<img src={p.image} className="w-full h-full object-cover" />:<div className="w-full h-full flex items-center justify-center text-lg opacity-30">🍕</div>}</div><div className="p-1.5"><p className="text-[10px] font-bold truncate text-light-text-primary dark:text-dark-text-primary">{p.name}</p><p className="text-[10px] font-bold text-matrix-green">${Number(p.price||0).toLocaleString('es-CL')}</p></div></div>)}</div>;
    case 'button':
      return <div className="text-center py-2"><span className="inline-block px-6 py-2 rounded-lg text-white text-sm font-bold" style={{background:data.color||'#22c55e'}}>{data.text||'Botón'}</span></div>;
    case 'divider':
      return <hr className="border-t border-light-border/20 dark:border-dark-border/20 my-2" />;
    case 'spacer':
      return <div className="flex items-center justify-center opacity-30" style={{height:data.height||24}}><span className="text-[9px] text-light-text-tertiary">↕ {data.height||24}px</span></div>;
    case 'variable':
      return <div className="py-2 px-3 bg-purple-500/10 border border-purple-500/20 rounded-lg"><code className="text-xs text-purple-400 font-mono">{`{{${data.variable||'...'}}}`}</code></div>;
    default:
      return <div className="py-2 text-xs text-light-text-tertiary">Bloque desconocido</div>;
  }
};

/* ── Main BlockRenderer with sortable ──────────────────────── */

const EDITORS = { header: HeaderEditor, text: TextEditor, image: ImageEditor, button: ButtonEditor, spacer: SpacerEditor, variable: VariableEditor };

const BlockRenderer = ({ block, onUpdate, onDelete, onDuplicate }) => {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', position: 'relative' };
  const Editor = EDITORS[block.type];

  return (
    <div ref={setNodeRef} style={style}
      className={`group relative rounded-xl border transition-all ${isDragging ? 'opacity-40 shadow-xl scale-[1.02] border-matrix-green/40' : 'border-light-border/10 dark:border-dark-border/10 hover:border-matrix-green/30'} bg-light-surface dark:bg-dark-surface mb-2`}>
      {/* Toolbar */}
      <div className="absolute -top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {Editor && <button onClick={()=>setEditing(!editing)} className={`p-1 rounded-md text-[10px] ${editing?'bg-matrix-green/20 text-matrix-green':'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-tertiary hover:text-matrix-green'} border border-light-border/10 shadow-sm`}><FaPen size={8}/></button>}
        <button onClick={()=>onDuplicate(block)} className="p-1 rounded-md bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 text-light-text-tertiary hover:text-blue-400 shadow-sm"><FaCopy size={8}/></button>
        <button onClick={()=>onDelete(block.id)} className="p-1 rounded-md bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border/10 text-light-text-tertiary hover:text-red-400 shadow-sm"><FaTrash size={8}/></button>
      </div>
      <div className="flex items-start">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="shrink-0 w-7 flex items-center justify-center pt-3 cursor-grab active:cursor-grabbing text-light-text-tertiary/30 hover:text-matrix-green/60 transition-colors">
          <FaGripVertical size={10}/>
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0 p-2 pr-3">
          {editing && Editor ? <Editor data={block.data} onChange={(d)=>onUpdate(block.id,d)} /> : <BlockPreview block={block} />}
        </div>
      </div>
      {/* Type badge */}
      <span className="absolute bottom-1 left-2 text-[8px] font-bold text-light-text-tertiary/40 uppercase tracking-wider">{block.type}</span>
    </div>
  );
};

export default BlockRenderer;
