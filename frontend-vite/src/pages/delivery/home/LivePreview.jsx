// src/pages/delivery/home/LivePreview.jsx
// Faithful replica of the delivery Home page for admin live preview
// Mirrors: HeroSlider, GatewaySelector, FeaturedPromos, AnnouncementBar
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDesktop, FaMobileAlt, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaStore } from 'react-icons/fa';

// ── Resolve image URL ────────────────────────────────────────
// Default templates use /assets/banners/... (delivery local paths)
// In the admin preview we remap those to our template endpoint
const resolveImgUrl = (url) => {
  if (!url) return '';
  // Already a full URL (R2 or external)
  if (url.startsWith('http')) return url;
  // Local delivery paths → use admin template endpoint
  if (url.startsWith('/assets/')) {
    const filename = url.split('/').pop();
    return `/api/delivery/home-config/templates/${filename}`;
  }
  return url;
};

// ── Announcement Bar ─────────────────────────────────────────
const AnnouncementPreview = ({ announcement }) => {
  if (!announcement?.active || !announcement?.text) return null;
  return (
    <div className="w-full bg-gradient-to-r from-[#DE141D] to-[#B91016] text-white text-center py-2 px-3">
      <p className="text-[9px] sm:text-[10px] font-bold tracking-wide">{announcement.text}</p>
    </div>
  );
};

// ── Hero Banner Slide ────────────────────────────────────────
const BannerSlide = ({ banner, isMobile }) => (
  <div className="relative w-full h-full">
    <img
      src={resolveImgUrl(banner.image)}
      alt={banner.title || 'Promoción'}
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => { e.target.style.display = 'none'; }}
    />
    {/* Overlays — exact match */}
    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

    {/* Text content */}
    <div className={`absolute inset-y-0 left-0 z-10 flex flex-col justify-center ${isMobile ? 'px-4 w-full' : 'px-6 w-2/3'}`}>
      {banner.badge && (
        <span className="self-start px-3 py-0.5 bg-[#FFD700] text-black rounded-md text-[7px] font-black tracking-widest uppercase mb-2 shadow-sm">
          {banner.badge}
        </span>
      )}
      {banner.title && (
        <div className="flex flex-col gap-0.5">
          <h1 className={`font-black text-white tracking-tighter leading-[0.9] ${isMobile ? 'text-xl' : 'text-4xl'}`}>
            <span className="block">{banner.title}</span>
            {banner.subtitle && <span className="block text-[#FFD700]">{banner.subtitle}</span>}
          </h1>
          {banner.promo_price && (
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`font-black text-white ${isMobile ? 'text-lg' : 'text-3xl'}`}>
                DESDE {banner.promo_price}
              </span>
            </div>
          )}
          {banner.cta_text && (
            <button className={`mt-2 self-start bg-white text-black font-black rounded-lg hover:bg-[#FFD700] transition-colors uppercase ${isMobile ? 'px-4 py-1.5 text-[7px]' : 'px-5 py-2 text-[9px]'}`}>
              {banner.cta_text}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

// ── Hero Slider ──────────────────────────────────────────────
const HeroSliderPreview = ({ banners = [], isMobile }) => {
  const active = banners.filter(b => b.active);
  const [idx, setIdx] = useState(0);

  // Auto-advance
  useEffect(() => {
    if (active.length <= 1) return;
    const timer = setInterval(() => setIdx(p => (p + 1) % active.length), 5000);
    return () => clearInterval(timer);
  }, [active.length]);

  if (!active.length) {
    return (
      <div className={`w-full ${isMobile ? 'aspect-[4/5]' : 'h-[240px]'} bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center`}>
        <p className="text-white/30 text-[10px]">Sin banners activos</p>
      </div>
    );
  }

  const current = active[idx % active.length];

  return (
    <div className={`relative w-full ${isMobile ? 'aspect-[4/5]' : 'h-[240px]'} overflow-hidden bg-gray-900`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <BannerSlide banner={current} isMobile={isMobile} />
        </motion.div>
      </AnimatePresence>

      {/* Navigation arrows */}
      {active.length > 1 && !isMobile && (
        <>
          <button onClick={() => setIdx(p => (p - 1 + active.length) % active.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <FaChevronLeft size={8} />
          </button>
          <button onClick={() => setIdx(p => (p + 1) % active.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
            <FaChevronRight size={8} />
          </button>
        </>
      )}

      {/* Pagination dots */}
      {active.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1">
          {active.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx % active.length ? 'bg-white w-4' : 'bg-white/40 w-1.5'}`} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Gateway Selector ─────────────────────────────────────────
const GatewayPreview = ({ isMobile }) => (
  <div className={`w-full flex items-center justify-center ${isMobile ? '-mt-8' : '-mt-10'} z-20 px-3 relative`}>
    <div className={`bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl w-full rounded-2xl shadow-2xl shadow-black/15 border border-white/20 p-1.5 flex ${isMobile ? 'flex-col' : 'flex-row'} gap-1.5`}>
      {/* Delivery button — active */}
      <div className="flex-1 p-2.5 flex items-center gap-2 rounded-xl bg-[#DE141D] text-white shadow-lg shadow-red-600/25">
        <div className="p-1.5 rounded-full bg-white/20 shrink-0">
          <FaMapMarkerAlt size={isMobile ? 10 : 12} />
        </div>
        <div className="min-w-0">
          <h3 className={`font-black uppercase tracking-tight ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Pide Delivery</h3>
          <p className="text-[7px] text-red-100 font-bold truncate">A domicilio u oficina</p>
        </div>
      </div>
      {/* Pickup button */}
      <div className="flex-1 p-2.5 flex items-center gap-2 rounded-xl bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 ring-1 ring-gray-100 dark:ring-gray-700">
        <div className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 shrink-0">
          <FaStore size={isMobile ? 10 : 12} />
        </div>
        <div className="min-w-0">
          <h3 className={`font-black uppercase tracking-tight ${isMobile ? 'text-[10px]' : 'text-xs'}`}>Retiro en Local</h3>
          <p className="text-[7px] text-gray-500 font-bold truncate">Sin filas, pasa y lleva</p>
        </div>
      </div>
    </div>
  </div>
);

// ── Featured Promos ──────────────────────────────────────────
const PromosPreview = ({ promos = [], isMobile }) => {
  const active = promos.filter(p => p.active);
  if (!active.length) return null;

  return (
    <div className="px-3 py-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className={`font-black uppercase tracking-tighter text-gray-900 dark:text-white ${isMobile ? 'text-sm' : 'text-base'}`}>
          Promos <span className="text-[#DE141D]">Destacadas</span>
        </h2>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400">
            <FaChevronLeft size={6} />
          </div>
          <div className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400">
            <FaChevronRight size={6} />
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {active.map((promo) => (
          <div key={promo.id || promo.title}
            className={`flex-shrink-0 rounded-2xl overflow-hidden bg-white dark:bg-[#1e1e1e] shadow-lg border border-transparent dark:border-white/5 transition-all hover:-translate-y-0.5 hover:shadow-xl cursor-pointer ${isMobile ? 'w-[130px]' : 'w-[170px]'}`}>
            <div className="aspect-[16/9] overflow-hidden">
              {promo.image ? (
                <img src={resolveImgUrl(promo.image)} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
              ) : (
                <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <span className="text-gray-400 text-[8px]">Sin imagen</span>
                </div>
              )}
            </div>
            <div className="p-2">
              <h4 className={`font-black uppercase text-gray-900 dark:text-white truncate leading-tight ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}>
                {promo.title}
              </h4>
              {promo.price && (
                <span className="text-[7px] text-gray-500 dark:text-[#FFD700] font-bold">
                  <span className="text-[#DE141D]">Desde</span> {promo.price}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Category Explorer ────────────────────────────────────────
const CATEGORY_THEMES = {
  pizza: { bg: '#DE141D', text: '#fff' },
  pasta: { bg: '#D4AF37', text: '#000' },
  entrada: { bg: '#D4AF37', text: '#fff' },
  papas: { bg: '#D4AF37', text: '#fff' },
  postre: { bg: '#F3F4F6', text: '#000' },
  bebida: { bg: '#3B82F6', text: '#fff' },
  nuevo: { bg: '#111', text: '#fff' },
};
const getCatTheme = (name) => {
  const n = (name || '').toLowerCase();
  for (const key in CATEGORY_THEMES) {
    if (n.includes(key)) return CATEGORY_THEMES[key];
  }
  return { bg: '#F3F4F6', text: '#000' };
};

const CategoryExplorerPreview = ({ featuredCategories = [], isMobile }) => {
  // Handle both string[] and object[] formats
  const cats = (featuredCategories.length > 0
    ? featuredCategories.map(c => typeof c === 'string' ? { slug: c, name: c, image: '' } : c)
    : [
      { slug: 'pizzas', name: 'Pizzas', image: '' },
      { slug: 'pastas', name: 'Pastas', image: '' },
      { slug: 'entradas', name: 'Entradas', image: '' },
      { slug: 'nuevos platos piccola', name: 'Nuevos Platos Piccola', image: '' },
      { slug: 'papas fritas', name: 'Papas Fritas', image: '' },
      { slug: 'postres', name: 'Postres', image: '' },
    ]
  ).slice(0, 6);

  return (
    <div className="px-3 py-4">
      <h2 className={`font-black uppercase tracking-tighter text-gray-900 dark:text-white mb-2.5 ${isMobile ? 'text-sm' : 'text-base'}`}>
        Explora nuestro <span className="text-[#DE141D]">Menú</span>
      </h2>
      <div className={`grid ${isMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-3 gap-2'}`}>
        {cats.map((cat) => {
          const theme = getCatTheme(cat.name || cat.slug);
          const imgUrl = resolveImgUrl(cat.image);
          return (
            <div
              key={cat.slug || cat.name}
              className={`rounded-xl overflow-hidden relative ${isMobile ? 'h-14' : 'h-16'} flex items-center cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5`}
              style={{ backgroundColor: theme.bg }}
            >
              <span className="text-[9px] font-black uppercase tracking-tight leading-tight capitalize pl-2.5 z-10 drop-shadow-md"
                style={{ color: theme.text }}>
                {cat.name || cat.slug}
              </span>
              <div className="absolute bottom-1 left-2.5 h-0.5 w-4 rounded-full z-10" style={{ backgroundColor: theme.text, opacity: 0.4 }} />
              {imgUrl && (
                <img src={imgUrl} alt="" className="absolute right-0 top-0 h-[130%] w-auto object-contain translate-x-1 translate-y-1 opacity-90 drop-shadow-lg"
                  onError={(e) => { e.target.style.display = 'none'; }} />
              )}
            </div>
          );
        })}
      </div>
      <button className="w-full mt-2 py-2 text-center font-black uppercase tracking-widest text-[7px] text-gray-400 hover:text-[#DE141D] transition-colors">
        Ver todo el menú →
      </button>
    </div>
  );
};

// ── Device Frames ────────────────────────────────────────────
const MobileFrame = ({ children }) => (
  <div className="mx-auto w-[280px] rounded-[2.5rem] border-[5px] border-gray-800 dark:border-gray-500 bg-black overflow-hidden shadow-2xl shadow-black/40">
    {/* Status bar */}
    <div className="w-full h-6 bg-black flex items-center justify-between px-5">
      <span className="text-[8px] text-white/60 font-semibold">9:41</span>
      <div className="w-20 h-4 bg-gray-900 rounded-full" />
      <div className="flex gap-1">
        <div className="w-3 h-2 bg-white/40 rounded-sm" />
        <div className="w-3 h-2 bg-white/40 rounded-sm" />
      </div>
    </div>
    <div className="w-full h-[520px] overflow-y-auto overflow-x-hidden bg-white dark:bg-[#111] scrollbar-hide">
      {children}
    </div>
    {/* Home indicator */}
    <div className="w-full h-5 bg-black flex items-center justify-center">
      <div className="w-24 h-1 bg-gray-700 rounded-full" />
    </div>
  </div>
);

const DesktopFrame = ({ children }) => (
  <div className="mx-auto w-full max-w-[640px] rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111] overflow-hidden shadow-2xl shadow-black/20">
    {/* Browser chrome */}
    <div className="h-7 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2.5 gap-1.5">
      <div className="flex gap-1">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
      </div>
      <div className="flex-1 mx-3 h-4 bg-white dark:bg-gray-700 rounded-md text-[8px] text-gray-400 dark:text-gray-500 flex items-center px-2 font-mono gap-1">
        <span className="text-green-500">🔒</span> lapiccolaitalia.cl
      </div>
    </div>
    <div className="w-full h-[420px] overflow-y-auto overflow-x-hidden scrollbar-hide">
      {children}
    </div>
  </div>
);

// ── Main LivePreview ─────────────────────────────────────────
const LivePreview = ({ config }) => {
  const [mode, setMode] = useState('desktop');
  const isMobile = mode === 'mobile';

  const Frame = isMobile ? MobileFrame : DesktopFrame;

  return (
    <div className="space-y-3">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Vista Previa en Vivo
        </h3>
        <div className="flex items-center bg-light-surface-secondary/70 dark:bg-dark-surface-secondary/70 p-0.5 rounded-lg gap-0.5 border border-light-border/30 dark:border-dark-border/30">
          <button onClick={() => setMode('desktop')}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1 ${mode === 'desktop'
              ? 'bg-matrix-green text-white shadow-sm'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}>
            <FaDesktop size={10} />
            <span className="text-[9px] font-semibold">PC</span>
          </button>
          <button onClick={() => setMode('mobile')}
            className={`p-1.5 rounded-md transition-all duration-200 flex items-center gap-1 ${mode === 'mobile'
              ? 'bg-matrix-green text-white shadow-sm'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}>
            <FaMobileAlt size={10} />
            <span className="text-[9px] font-semibold">Mobile</span>
          </button>
        </div>
      </div>

      {/* Preview frame */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="flex justify-center"
        >
          <Frame>
            <AnnouncementPreview announcement={config?.announcement} />
            <HeroSliderPreview banners={config?.hero_banners || []} isMobile={isMobile} />
            <GatewayPreview isMobile={isMobile} />
            <PromosPreview promos={config?.featured_promos || []} isMobile={isMobile} />
            <CategoryExplorerPreview featuredCategories={config?.featured_categories || []} isMobile={isMobile} />
          </Frame>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LivePreview;

