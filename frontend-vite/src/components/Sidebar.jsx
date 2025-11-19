import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'react-icons/fa';
import { ChevronDown, ChevronRight, LayoutDashboard, X } from 'lucide-react';
import { getSidebarConfig } from '../pages/pagesConfig';
import ActionButtons from './common/ActionButtons'; // Tu componente original
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'piccola:sidebar:expanded';

// --- ESTILOS VISUALES (Neon Glass) ---
const SIDEBAR_GLASS = "backdrop-blur-xl bg-light-surface/85 dark:bg-dark-surface/85 border border-light-border/50 dark:border-dark-border/50 shadow-modal";

const Sidebar = memo(({ isSidebarOpen, toggleSidebar, isAuthenticated, appState, onSidebarHoverChange, onSidebarWidthChange }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // 1. Mantenemos tu lógica de Configuración de Datos
  const pagesConfig = useMemo(() => getSidebarConfig(appState.roleLevel, t), [appState.roleLevel, t]);

  // === Animations ===
  const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } };

  // === Loading shimmer (Tu componente original) ===
  const SidebarLoading = () => (
    <motion.div className="flex flex-col gap-4 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {[...Array(4)].map((_, i) => (
        <motion.div key={i} className="h-9 bg-light-border dark:bg-dark-border rounded-xl animate-pulse w-full" style={{ opacity: 0.55 + 0.1 * i }} />
      ))}
    </motion.div>
  );

  // === Hover Logic ===
  const handleHover = (hovered) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(hovered);
      onSidebarHoverChange?.(hovered);
    }, 100);
  };

  // === Persistence Logic (Exactamente la tuya) ===
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setExpandedCategories(JSON.parse(saved));
    } catch {}
    
    const auto = {};
    for (const cat of pagesConfig) {
      if (cat.items?.some((it) => location.pathname.startsWith(it.fullPath))) {
        auto[cat.category] = true;
      }
    }
    if (Object.keys(auto).length) {
      setExpandedCategories((prev) => ({ ...prev, ...auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedCategories)); } catch {}
  }, [expandedCategories]);

  // Report Width (Ajustado a 80px colapsado / 280px expandido para el diseño nuevo)
  useEffect(() => {
    const width = (isHovered || isSidebarOpen) ? 280 : 80;
    onSidebarWidthChange?.(width);
    onSidebarHoverChange?.(isHovered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered, isSidebarOpen]);

  useEffect(() => () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }, []);

  const toggleCategory = useCallback((category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  // === Tooltip Flotante (Solo visual) ===
  const LabelTooltip = ({ label }) => (
    <motion.div
      initial={{ x: 10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 5, opacity: 0 }}
      className="pointer-events-none absolute left-[68px] top-1/2 -translate-y-1/2 z-[90]"
    >
      <div className="ml-2 rounded-xl px-3 py-1.5 text-xs bg-dark-surface/90 text-white shadow-modal border border-white/10 backdrop-blur-xl whitespace-nowrap">
        <div className="font-bold tracking-wide">{label}</div>
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-dark-surface/90 rotate-45 border-l border-b border-white/10" />
      </div>
    </motion.div>
  );

  // === Renderizado de Categorías (Tu lógica + Nuevo CSS) ===
  const renderCategory = (category) => {
    const isExpanded = !!expandedCategories[category.category];
    const hasItems = Array.isArray(category.items) && category.items.length > 0;
    const IconComponent = Icons[category.icon] || Icons.FaFolder;
    const isSidebarExpanded = isHovered || isSidebarOpen;

    // Header con estilo nuevo
    const header = (
      <button
        type="button"
        onClick={() => hasItems && toggleCategory(category.category)}
        className={`group relative w-full flex items-center transition-all duration-300 rounded-xl mb-1 outline-none
          ${isSidebarExpanded ? 'px-3 py-2.5 justify-start gap-3' : 'px-0 py-3 justify-center'}
          ${isExpanded && isSidebarExpanded ? 'text-light-text-primary dark:text-white' : 'text-light-text-secondary dark:text-dark-text-secondary'}
          hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary`}
      >
        <div className={`relative grid place-items-center transition-all duration-300 ease-out
          ${isSidebarExpanded ? 'h-6 w-6' : 'h-11 w-11 rounded-2xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border shadow-sm group-hover:scale-105 group-hover:border-light-accent/30 dark:group-hover:border-dark-accent/30'}
        `}>
          <IconComponent className={`transition-colors duration-300 ${isSidebarExpanded && isExpanded ? 'text-light-accent dark:text-dark-accent' : ''}`} size={isSidebarExpanded ? 18 : 20} />
        </div>

        <span className={`truncate text-[12px] font-bold uppercase tracking-wide transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0 overflow-hidden'}`}>
          {category.categoryLabel}
        </span>

        {hasItems && isSidebarExpanded && (
          <span className={`ml-auto text-light-text-secondary dark:text-dark-text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={14} />
          </span>
        )}
      </button>
    );

    // Items con estilo Neon
    const items = hasItems && isExpanded && isSidebarExpanded ? (
      <motion.div className="space-y-1 pl-3 mb-3 mt-1 border-l border-light-border/50 dark:border-dark-border/50 ml-2.5" variants={containerVariants} initial="hidden" animate="show">
        {category.items.map((item) => {
          const ItemIcon = Icons[item.icon] || Icons.FaFileAlt;
          const isActive = location.pathname === item.fullPath || location.pathname.startsWith(item.fullPath + '/');

          const ItemContent = (
             <motion.div
               whileHover={{ x: 4 }}
               className={`relative flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200
                 ${isActive
                   ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent font-semibold shadow-[inset_2px_0_0_0_currentColor]'
                   : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-white hover:bg-light-surface-secondary/50 dark:hover:bg-dark-surface-secondary/50'
                 }`}
             >
               <ItemIcon size={15} className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
               <span className="truncate text-sm leading-none pt-0.5">{item.label}</span>
               {item.badge && <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-light-accent dark:bg-dark-accent text-white shadow-neon">{item.badge}</span>}
             </motion.div>
          );
          
          const LinkProps = { title: item.description, className: "block group" };
          return item.isExternal 
            ? <a key={item.fullPath} href={item.fullPath} target={item.newTab ? '_blank' : '_self'} rel={item.newTab ? 'noopener noreferrer' : undefined} {...LinkProps}>{ItemContent}</a>
            : <NavLink key={item.fullPath} to={item.fullPath} {...LinkProps}>{ItemContent}</NavLink>;
        })}
      </motion.div>
    ) : null;

    return (
      <div key={category.category} className="mb-1">
        {!isSidebarExpanded ? <div className="relative group/tooltip">{header}<div className="hidden group-hover/tooltip:block"><LabelTooltip label={category.categoryLabel} /></div></div> : header}
        <AnimatePresence initial={false}>
          {items && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">{items}</motion.div>}
        </AnimatePresence>
      </div>
    );
  };

  // Ancho dinámico para el layout
  const sidebarWidth = (isHovered || isSidebarOpen) ? 280 : 80;

  return (
    <>
      {/* ================= DESKTOP SIDEBAR (Floating Neon) ================= */}
      <motion.aside
        className={`hidden lg:flex flex-col ${SIDEBAR_GLASS}`}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.4, type: 'spring', bounce: 0.15 }}
        style={{
          position: 'fixed',
          top: 80, // Debajo del Header
          left: 16, // Margen Izquierdo Flotante
          bottom: 96, // Espacio para el Footer Flotante
          zIndex: 90,
          borderRadius: '24px',
          overflow: 'visible',
        }}
      >
        {/* --- CRÍTICO: Aquí estaba el fallo. Restauramos el chequeo de carga --- */}
        {!appState?.isWalletDataReady ? (
          <SidebarLoading />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-none p-3 pb-0 flex flex-col rounded-t-[24px]">
              <nav className="space-y-2">
                 {pagesConfig?.length ? pagesConfig.map(renderCategory) : (
                   <div className="text-center p-4 text-xs text-gray-400">{t('sidebar.no_routes')}</div>
                 )}
              </nav>
            </div>

            {/* Footer del Sidebar (ActionButtons) */}
            <div className="overflow-hidden rounded-b-[24px] bg-light-surface-secondary/30 dark:bg-black/20 border-t border-light-border/50 dark:border-dark-border/50 p-1">
               <ActionButtons appState={appState} isSidebarHovered={isHovered} isSidebarOpen={isSidebarOpen} />
            </div>
          </>
        )}
      </motion.aside>

      {/* ================= MOBILE DRAWER (Card Flotante) ================= */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[105] lg:hidden bg-black/60 backdrop-blur-sm"
              onClick={toggleSidebar}
            />
            
            {/* Card Flotante Mobile */}
            <motion.div
              key="sidebar-mobile"
              initial={{ x: '-100%', opacity: 0 }} 
              animate={{ x: 0, opacity: 1 }} 
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className={`fixed top-20 left-4 bottom-28 w-[88vw] max-w-[320px] z-[110] flex flex-col rounded-3xl ${SIDEBAR_GLASS}`}
              onClick={(e) => e.stopPropagation()}
            >
               {/* Header Mobile */}
               <div className="relative h-16 flex items-center px-6 border-b border-light-border/50 dark:border-dark-border/50 font-bold text-xl tracking-tight bg-light-surface-secondary/20 dark:bg-white/5 rounded-t-3xl">
                  <LayoutDashboard className="mr-3 text-light-accent dark:text-dark-accent" size={24} />
                  <span className="font-futurist text-light-text-primary dark:text-dark-text-primary">Menú</span>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary"
                  >
                    <X size={20} />
                  </button>
               </div>

               {/* Content Mobile */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
                  {pagesConfig.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wider mb-2 px-2 opacity-80">
                        {React.createElement(Icons[cat.icon] || Icons.FaFolder, { size: 12 })}
                        {cat.categoryLabel}
                      </div>
                      <div className="space-y-1">
                        {cat.items?.map((item) => {
                          const ItemIcon = Icons[item.icon] || Icons.FaFileAlt;
                          const isActive = location.pathname === item.fullPath || location.pathname.startsWith(item.fullPath + '/');
                          return item.isExternal ? (
                             <a key={item.fullPath} href={item.fullPath} target={item.newTab ? '_blank' : '_self'} onClick={toggleSidebar}
                               className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-light-accent dark:bg-dark-accent text-white shadow-neon translate-x-1' : 'text-light-text-primary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'}`}>
                                <ItemIcon size={18} />{item.label}
                             </a>
                          ) : (
                             <NavLink key={item.fullPath} to={item.fullPath} onClick={toggleSidebar}
                               className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-light-accent dark:bg-dark-accent text-white shadow-neon translate-x-1' : 'text-light-text-primary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'}`}>
                                <ItemIcon size={18} />{item.label}
                             </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  ))}
               </div>

               {/* Footer Mobile (Action Buttons) */}
               <div className="p-2 border-t border-light-border/50 dark:border-dark-border/50 bg-light-surface-secondary/30 dark:bg-black/20 rounded-b-3xl">
                  <ActionButtons appState={appState} isSidebarHovered={false} isSidebarOpen={true} />
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default Sidebar;