// blockCompiler.js — Compiles visual blocks to email-safe HTML
const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const CLP = (v) => `$${Number(v||0).toLocaleString('es-CL')}`;

const WRAPPER_START = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f5;}a{color:#22c55e;}</style></head><body><div style="max-width:600px;margin:0 auto;padding:20px;">`;
const WRAPPER_END = `</div></body></html>`;

const compilers = {
  header: (d) => `<div style="text-align:center;padding:24px 0;"><h1 style="margin:0;font-size:24px;color:#2d2d2d;">🍕 <span style="color:#22c55e;">${esc(d.title||'La Piccola Italia')}</span></h1>${d.subtitle?`<p style="margin:8px 0 0;color:#999;font-size:13px;">${esc(d.subtitle)}</p>`:''}</div>`,
  text: (d) => `<div style="padding:8px 0;font-size:14px;line-height:1.6;color:#444;">${d.html||''}</div>`,
  image: (d) => `<div style="padding:8px 0;text-align:center;">${d.link?`<a href="${d.link}">`:''}<img src="${d.src}" alt="${esc(d.alt||'')}" style="max-width:100%;border-radius:12px;" />${d.link?'</a>':''}</div>`,
  product_card: (d) => `<table style="width:100%;margin:8px 0;border-collapse:collapse;"><tr><td style="width:64px;padding:4px;"><img src="${d.image||''}" alt="${esc(d.name)}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;" /></td><td style="padding:8px;"><strong style="font-size:14px;color:#2d2d2d;">${esc(d.name)}</strong><br/><span style="font-size:13px;color:#22c55e;font-weight:700;">${CLP(d.price)}</span></td></tr></table>`,
  product_grid: (d) => {
    const prods = d.products || [];
    if (!prods.length) return '';
    const cells = prods.map(p => `<td style="width:${Math.floor(100/prods.length)}%;padding:4px;text-align:center;vertical-align:top;"><div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #f0f0f0;"><img src="${p.image||''}" alt="${esc(p.name)}" style="width:100%;height:120px;object-fit:cover;" /><div style="padding:8px;"><p style="font-size:12px;font-weight:600;color:#2d2d2d;margin:0;">${esc(p.name)}</p><p style="font-size:13px;font-weight:700;color:#22c55e;margin:4px 0 0;">${CLP(p.price)}</p></div></div></td>`).join('');
    return `<table style="width:100%;border-collapse:collapse;margin:8px 0;"><tr>${cells}</tr></table>`;
  },
  button: (d) => `<div style="text-align:center;padding:16px 0;"><a href="${d.url||'#'}" style="display:inline-block;background:${d.color||'#22c55e'};color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${esc(d.text||'Click aquí')}</a></div>`,
  review_button: (d) => `<div style="text-align:center;padding:20px 0;"><div style="margin-bottom:12px;font-size:28px;letter-spacing:4px;">⭐⭐⭐⭐⭐</div><a href="${d.url||'{{review_url}}'}" style="display:inline-block;background:${d.color||'#f59e0b'};color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(245,158,11,0.3);">${esc(d.text||'⭐ Dejanos tu opinión')}</a><p style="margin:8px 0 0;font-size:11px;color:#999;">Tu feedback nos ayuda a mejorar 💚</p></div>`,
  divider: () => `<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;" />`,
  spacer: (d) => `<div style="height:${d.height||24}px;"></div>`,
  variable: (d) => `{{${d.variable||''}}}`,
};

export function compileBlocks(blocks) {
  const inner = (blocks||[]).map(b => {
    const fn = compilers[b.type];
    return fn ? fn(b.data||{}) : '';
  }).join('\n');
  return WRAPPER_START + inner + WRAPPER_END;
}

export const BLOCK_TYPES = [
  { type:'header', label:'Header', icon:'🏠', defaultData:{title:'La Piccola Italia',subtitle:''} },
  { type:'text', label:'Texto', icon:'📝', defaultData:{html:'<p>Escribe tu contenido aquí...</p>'} },
  { type:'image', label:'Imagen', icon:'🖼️', defaultData:{src:'',alt:'',link:''} },
  { type:'product_card', label:'Producto', icon:'📦', defaultData:{name:'',price:0,image:'',codigo:''} },
  { type:'product_grid', label:'Grid Productos', icon:'🔲', defaultData:{products:[]} },
  { type:'button', label:'Botón', icon:'👆', defaultData:{text:'Ver más',url:'{{reorder_url}}',color:'#22c55e'} },
  { type:'review_button', label:'Review', icon:'⭐', defaultData:{text:'⭐ Dejanos tu opinión',url:'{{review_url}}',color:'#f59e0b'} },
  { type:'divider', label:'Separador', icon:'➖', defaultData:{} },
  { type:'spacer', label:'Espacio', icon:'↕️', defaultData:{height:24} },
  { type:'variable', label:'Variable', icon:'⚡', defaultData:{variable:'order_items_html'} },
];

export function createBlock(type, data={}) {
  const bt = BLOCK_TYPES.find(b=>b.type===type);
  return { id: `b_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type, data: {...(bt?.defaultData||{}), ...data} };
}
