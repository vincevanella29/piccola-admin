import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'react-icons/fa';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getSidebarConfig } from '../pages/pagesConfig';
import ActionButtons from './common/ActionButtons';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'piccola:sidebar:expanded';

const Sidebar = memo(({ isSidebarOpen, toggleSidebar, isAuthenticated, appState, onSidebarHoverChange, onSidebarWidthChange }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const pagesConfig = useMemo(() => getSidebarConfig(appState.roleLevel, t), [appState.roleLevel, t]);

  // === Animations
  const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } };
  const itemVariants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 28 } } };

  // === Loading shimmer
  const SidebarLoading = () => (
    <motion.div className="flex flex-col gap-4 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {[...Array(4)].map((_, i) => (
        <motion.div key={i} className="h-9 bg-light-border dark:bg-dark-border rounded-xl animate-pulse w-full" style={{ opacity: 0.55 + 0.1 * i }} />
      ))}
    </motion.div>
  );

  // === Hover rail (desktop)
  const handleHover = (hovered) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(hovered);
      onSidebarHoverChange?.(hovered);
    }, 90);
  };

  // === Persist & restore expanded categories
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setExpandedCategories(JSON.parse(saved));
    } catch {}
    // auto-expand category if current route matches one of its items
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedCategories));
    } catch {}
  }, [expandedCategories]);

  // Report width to layout consumers
  useEffect(() => {
    const width = (isHovered || isSidebarOpen) ? 264 : 64;
    onSidebarWidthChange?.(width);
    onSidebarHoverChange?.(isHovered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered, isSidebarOpen]);

  useEffect(() => () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }, []);

  const toggleCategory = useCallback((category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  // === Tiny Tooltip (shown only when rail está colapsado)
  const LabelTooltip = ({ label, description }) => (
    <motion.div
      initial={{ x: 8, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 8, opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="pointer-events-none absolute left-[72px] top-1/2 -translate-y-1/2 z-[75]"
    >
      <div className="rounded-lg px-3 py-1.5 text-xs bg-[#0b0b0e]/90 text-white shadow-xl border border-white/10 backdrop-blur-md max-w-[220px]">
        <div className="font-semibold">{label}</div>
        {description ? <div className="text-[10px] opacity-75 mt-0.5 line-clamp-2">{description}</div> : null}
      </div>
    </motion.div>
  );

  const CollapsedItem = ({ children, label, description }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="relative"
           onMouseEnter={() => setOpen(true)}
           onMouseLeave={() => setOpen(false)}
           onFocus={() => setOpen(true)}
           onBlur={() => setOpen(false)}>
        {children}
        <AnimatePresence>{open && <LabelTooltip label={label} description={description} />}</AnimatePresence>
      </div>
    );
  };

  // === Render category + items
  const renderCategory = (category) => {
    const isExpanded = !!expandedCategories[category.category];
    const hasItems = Array.isArray(category.items) && category.items.length > 0;
    const IconComponent = Icons[category.icon] || Icons.FaFolder;

    // Header row
    const header = (
      <button
        type="button"
        onClick={() => hasItems && toggleCategory(category.category)}
        className={`group relative w-full flex items-center rounded-xl transition-all duration-200
          ${ (isHovered || isSidebarOpen) ? 'gap-3 px-3 py-2.5 justify-start' : 'px-0 py-2.5 justify-center' }
          text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary
          hover:bg-light-accent-hover/70 dark:hover:bg-dark-accent-hover/70`}
        aria-expanded={isExpanded}
      >
        <span className="grid place-items-center h-9 w-9 rounded-lg border border-light-border/60 dark:border-dark-border/60 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 shadow-sm group-hover:shadow">
          <IconComponent className="text-light-accent dark:text-dark-accent" size={18} />
        </span>
        <span className={`truncate text-[13px] font-semibold uppercase tracking-wide ${ (isHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 w-0' } transition-opacity`}>
          {category.categoryLabel}
        </span>
        {hasItems && (isHovered || isSidebarOpen) && (
          <span className="ml-auto text-light-text-tertiary dark:text-dark-text-tertiary">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}
      </button>
    );

    // Items list
    const items = hasItems && isExpanded && (isHovered || isSidebarOpen) ? (
      <motion.div className="space-y-1 pl-2" variants={containerVariants} initial="hidden" animate="show">
        {category.items.map((item) => {
          const ItemIcon = Icons[item.icon] || Icons.FaFileAlt;
          const isActive = location.pathname === item.fullPath || location.pathname.startsWith(item.fullPath + '/');

          const ItemInner = (
            <motion.div
              whileHover={{ x: 2 }}
              className={`relative flex items-center gap-3 py-2 px-3 rounded-lg transition-colors
                ${isActive
                  ? 'bg-gradient-to-r from-light-accent/15 to-transparent dark:from-dark-accent/15 text-light-text-primary dark:text-dark-text-primary'
                  : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover/70 dark:hover:bg-dark-accent-hover/70 hover:text-light-text-primary dark:hover:text-dark-text-primary'
                }`}
            >
              <span className="relative grid place-items-center h-8 w-8 rounded-md border border-light-border/60 dark:border-dark-border/60 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60">
                <ItemIcon className={`${isActive ? 'text-light-accent dark:text-dark-accent' : ''}`} size={16} />
                {isActive && (
                  <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-light-accent dark:bg-dark-accent shadow-[0_0_12px] shadow-light-accent/50 dark:shadow-dark-accent/50" />
                )}
              </span>
              <span className="truncate text-sm">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border border-light-border/60 dark:border-dark-border/60 bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60">
                  {item.badge}
                </span>
              )}
            </motion.div>
          );

          return item.isExternal ? (
            <a
              key={item.fullPath}
              href={item.fullPath}
              target={item.newTab ? '_blank' : '_self'}
              rel={item.newTab ? 'noopener noreferrer' : undefined}
              title={item.description}
              className="block"
            >
              {ItemInner}
            </a>
          ) : (
            <NavLink key={item.fullPath} to={item.fullPath} title={item.description} className="block">
              {ItemInner}
            </NavLink>
          );
        })}
      </motion.div>
    ) : null;

    // Collapsed -> show tooltip on hover
    if (!(isHovered || isSidebarOpen)) {
      return (
        <CollapsedItem key={category.category} label={category.categoryLabel} description={category.description}>
          {header}
        </CollapsedItem>
      );
    }

    return (
      <div key={category.category}>
        {header}
        <AnimatePresence initial={false}>
          {items && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}>
              {items}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      {/* Desktop rail */}
      <motion.aside
        className="hidden lg:flex flex-col border-r border-light-border/70 dark:border-dark-border/70 bg-[rgba(245,246,250,0.7)] dark:bg-[rgba(12,13,16,0.55)] backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl"
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        animate={{ width: (isHovered || isSidebarOpen) ? 264 : 64 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          bottom: 'var(--app-footer-h,40px)',
          width: (isHovered || isSidebarOpen) ? 264 : 64,
          overflow: 'visible', // necesario para los tooltips
          zIndex: 60,
        }}
        aria-label="Primary navigation"
      >
        {!appState?.isWalletDataReady ? (
          <SidebarLoading />
        ) : (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, delay: (isHovered || isSidebarOpen) ? 0.05 : 0 }}
            className="p-3 h-full flex flex-col"
          >
            <motion.nav className="flex-1 space-y-3 overflow-y-auto scrollbar-none pr-1" variants={containerVariants} initial="hidden" animate="show">
              {pagesConfig?.length ? pagesConfig.map(renderCategory) : (
                <p className={`text-light-text-secondary dark:text-dark-text-secondary px-3 py-1 text-sm ${(isHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 w-0'} transition-opacity`}>
                  {t('sidebar.no_routes')}
                </p>
              )}
            </motion.nav>

            <div className="pt-3 border-t border-light-border/70 dark:border-dark-border/70">
              <ActionButtons appState={appState} isSidebarHovered={isHovered} isSidebarOpen={isSidebarOpen} />
            </div>
          </motion.div>
        )}
      </motion.aside>

      {/* Mobile overlay + drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="fixed top-16 left-0 right-0 bottom-[var(--app-footer-h,40px)] z-50 lg:hidden bg-black/60 backdrop-blur-sm"
              onClick={toggleSidebar}
              aria-label="Close sidebar"
            />
            <motion.div
              key="sidebar-mobile"
              initial={{ x: -320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -320, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="fixed top-16 left-0 bottom-[var(--app-footer-h,40px)] w-72 bg-light-surface/95 dark:bg-dark-surface/95 backdrop-blur-xl z-[80] rounded-r-xl shadow-2xl flex flex-col"
              style={{ overflow: 'hidden' }}
            >
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: 0.08 }} className="p-4 space-y-4 h-full overflow-y-auto flex flex-col">
                <nav className="space-y-3">
                  {pagesConfig.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex items-center gap-3 text-light-text-primary dark:text-dark-text-primary font-semibold uppercase text-xs tracking-wide mb-1">
                        {React.createElement(Icons[cat.icon] || Icons.FaFolder, { size: 16, className: 'text-light-accent dark:text-dark-accent' })}
                        {cat.categoryLabel}
                      </div>
                      <div className="space-y-1">
                        {cat.items?.map((item) => {
                          const ItemIcon = Icons[item.icon] || Icons.FaFileAlt;
                          const isActive = location.pathname === item.fullPath || location.pathname.startsWith(item.fullPath + '/');
                          const Row = (
                            <div className={`flex items-center gap-3 py-2 px-3 rounded-lg ${isActive
                              ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-text-primary dark:text-dark-text-primary'
                              : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover/70 dark:hover:bg-dark-accent-hover/70 hover:text-light-text-primary dark:hover:text-dark-text-primary'
                            }`}>
                              <ItemIcon size={16} className={`${isActive ? 'text-light-accent dark:text-dark-accent' : ''}`} />
                              <span className="truncate text-sm">{item.label}</span>
                            </div>
                          );
                          return item.isExternal ? (
                            <a key={item.fullPath} href={item.fullPath} target={item.newTab ? '_blank' : '_self'} rel={item.newTab ? 'noopener noreferrer' : undefined} onClick={toggleSidebar}>
                              {Row}
                            </a>
                          ) : (
                            <NavLink key={item.fullPath} to={item.fullPath} onClick={toggleSidebar}>
                              {Row}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
                <div className="mt-auto pt-3 border-t border-light-border/70 dark:border-dark-border/70">
                  <ActionButtons appState={appState} isSidebarHovered={false} isSidebarOpen={true} />
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default Sidebar;
