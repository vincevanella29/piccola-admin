import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as Icons from 'react-icons/fa';
import { Sun, Moon, Globe, Settings, Ellipsis, Share2, X } from 'lucide-react';

import PiccolaFavicon from './common/PiccolaFavicon';
import { getFooterConfig } from '../pages/pagesConfig';

/**
 * Footer Premium "Floating Dock"
 * - Desktop: Flota centrado, estilo MacOS/Vercel.
 * - Mobile: Barra inferior glassmorphic con safe-area.
 */

const MOBILE_LIMIT = 3;
const DESKTOP_LIMIT = 6;

// --- Componentes Atómicos ---

const Separator = () => (
  <div className="w-[1px] h-6 bg-light-border/40 dark:bg-dark-border/40 mx-1.5 hidden sm:block" />
);

const IconCircleBtn = ({ 
  as: As = 'button', 
  to, 
  href, 
  onClick, 
  children, 
  label, 
  className = '', 
  isActive = false,
  ...rest 
}) => {
  
  const content = (
    <motion.div
      whileHover={{ scale: 1.15, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`
        group relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full 
        transition-all duration-300 ease-out cursor-pointer
        ${isActive 
          ? 'bg-light-accent text-white shadow-[0_0_15px_rgba(0,0,0,0.2)] scale-105' 
          : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary border border-transparent hover:border-light-border/30 dark:hover:border-dark-border/30'
        }
        ${className}
      `}
      aria-label={label}
    >
      {children}
      
      {/* Tooltip Flotante */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 transform translate-y-2 group-hover:translate-y-0 z-50">
        <div className="px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide shadow-xl border border-white/10 whitespace-nowrap">
          {label}
        </div>
        {/* Triangulito del tooltip */}
        <div className="w-2 h-2 bg-black/80 rotate-45 absolute bottom-[-3px] left-1/2 -translate-x-1/2 border-r border-b border-white/10" />
      </div>
      
      {/* Dot indicador de activo */}
      {isActive && (
        <motion.div 
          layoutId="activeDot"
          className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-light-accent dark:bg-dark-accent" 
        />
      )}
    </motion.div>
  );

  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>{content}</a>;
  if (to) return <Link to={to} onClick={onClick}>{content}</Link>;
  return <button type="button" onClick={onClick} className="focus:outline-none" {...rest}>{content}</button>;
};

const Popover = ({ open, onClose, className = '', children }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55]"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[60] rounded-2xl border border-light-border/50 dark:border-dark-border/50 bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl shadow-2xl shadow-black/20 ${className}`}
        >
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Mobile Bottom Sheet ---
const BottomSheet = ({ open, onClose, title, children }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[75] rounded-t-[32px] border-t border-white/10 bg-light-surface dark:bg-dark-surface shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
              <div className="w-10 h-1 rounded-full bg-light-text-tertiary/30 dark:bg-dark-text-tertiary/30" />
            </div>
            <div className="px-6 pb-[env(safe-area-inset-bottom,24px)] pt-2">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary tracking-tight">{title}</h3>
                <button onClick={onClose} className="p-2 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary">
                  <X size={16} />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- MAIN COMPONENT ---

const Footer = ({ isAuthenticated, changeLanguage, roleLevel, theme, setTheme, language, t }) => {
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState(null);
  const toggleMenu = (menu) => setActiveMenu(prev => prev === menu ? null : menu);
  const closeAll = () => setActiveMenu(null);

  const footerConfig = useMemo(() => getFooterConfig(roleLevel, t), [roleLevel, t]);
  const buttons = useMemo(() => (
    footerConfig.flatMap((c) => c.items).sort((a, b) => (a.order || 1e9) - (b.order || 1e9))
  ), [footerConfig]);

  // Logic: Chat priority + Limits
  const chatItem = buttons.find((it) => /chat/i.test(it?.label || '') || it?.icon === 'FaComments');
  const otherButtons = buttons.filter(b => b !== chatItem);
  const visibleButtons = chatItem ? [chatItem, ...otherButtons] : otherButtons;

  // Split Desktop/Mobile
  const desktopItems = visibleButtons.slice(0, DESKTOP_LIMIT);
  const overflowDesktop = visibleButtons.slice(DESKTOP_LIMIT);
  const mobileItems = visibleButtons.slice(0, MOBILE_LIMIT);

  const renderNavButton = (item) => {
    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
    const isCurrent = location.pathname === item.fullPath;
    return (
      <IconCircleBtn
        key={item.fullPath}
        to={!item.isExternal ? item.fullPath : undefined}
        href={item.isExternal ? item.fullPath : undefined}
        label={item.label}
        onClick={closeAll}
        isActive={isCurrent}
      >
        <IconComponent size={18} />
      </IconCircleBtn>
    );
  };

  // Si no está autenticado, a veces no queremos footer, o uno simple. 
  // Asumo que quieres mostrarlo igual o manejarlo fuera.
  
  return (
    <>
      {/* FOOTER CONTAINER */}
      <motion.footer
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="fixed z-[100] bottom-0 left-0 right-0 pointer-events-none flex justify-center"
      >
        <div className={`
          pointer-events-auto
          relative flex items-center gap-1.5 px-4 py-2.5 md:px-5 md:py-3 mx-auto mb-0 md:mb-6
          bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl
          border-t md:border border-light-border/40 dark:border-dark-border/40
          w-full md:w-auto md:rounded-full md:shadow-2xl md:shadow-black/10
          pb-[calc(env(safe-area-inset-bottom,16px)+4px)] md:pb-3
          transition-all duration-300
        `}>
          
          {/* LOGO (Desktop only) */}
          <div className="hidden md:flex mr-2 items-center">
             <Link to="/" className="hover:scale-105 transition-transform">
                <PiccolaFavicon className="w-7 h-7" />
             </Link>
          </div>
          <Separator />

          {/* NAVIGATION */}
          <div className="flex items-center justify-between w-full md:w-auto md:gap-2">
            
            {/* Desktop Nav */}
            <div className="hidden md:flex gap-2">
              {desktopItems.map(renderNavButton)}
              {overflowDesktop.length > 0 && (
                <div className="relative">
                  <IconCircleBtn label="Más" onClick={() => toggleMenu('explore')} isActive={activeMenu === 'explore'}>
                    <Ellipsis size={20} />
                  </IconCircleBtn>
                  <Popover open={activeMenu === 'explore'} onClose={closeAll}>
                    <div className="p-3 w-64 grid grid-cols-3 gap-2">
                      {overflowDesktop.map(item => {
                        const Icon = Icons[item.icon] || Icons.FaCircle;
                         return (
                          <Link key={item.fullPath} to={item.fullPath} onClick={closeAll} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-light-surface-tertiary dark:hover:bg-dark-surface-tertiary transition">
                             <Icon size={20} className="mb-1 text-light-text-secondary dark:text-dark-text-secondary"/>
                             <span className="text-[10px] font-medium text-center truncate w-full">{item.label}</span>
                          </Link>
                         )
                      })}
                    </div>
                  </Popover>
                </div>
              )}
            </div>

            {/* Mobile Nav (Space Between) */}
            <div className="flex md:hidden items-center justify-around w-full gap-1">
               <IconCircleBtn to="/" label="Inicio" onClick={closeAll} isActive={location.pathname === '/'}>
                  <Icons.FaHome size={20} />
               </IconCircleBtn>
               
               {mobileItems.map(renderNavButton)}

               <IconCircleBtn label="Menú" onClick={() => toggleMenu('mobile_explore')} isActive={activeMenu === 'mobile_explore'}>
                 <Ellipsis size={20} />
               </IconCircleBtn>
            </div>
          </div>

          {/* TOOLS (Desktop Only) */}
          <div className="hidden md:flex items-center">
            <Separator />
            <div className="flex gap-2 ml-1">
              {/* Social */}
              <div className="relative">
                <IconCircleBtn label="Social" onClick={() => toggleMenu('social')} isActive={activeMenu === 'social'}>
                  <Share2 size={18} />
                </IconCircleBtn>
                <Popover open={activeMenu === 'social'} onClose={closeAll}>
                   <div className="flex p-2 gap-2">
                      <IconCircleBtn href="https://instagram.com" className="border-none bg-transparent hover:bg-pink-500/10 hover:text-pink-500"><Icons.FaInstagram size={22}/></IconCircleBtn>
                      <IconCircleBtn href="https://twitter.com" className="border-none bg-transparent hover:bg-blue-400/10 hover:text-blue-400"><Icons.FaTwitter size={22}/></IconCircleBtn>
                   </div>
                </Popover>
              </div>

              {/* Language */}
              <div className="relative">
                <IconCircleBtn label="Idioma" onClick={() => toggleMenu('lang')} isActive={activeMenu === 'lang'}>
                  <Globe size={18} />
                </IconCircleBtn>
                <Popover open={activeMenu === 'lang'} onClose={closeAll}>
                   <div className="flex flex-col p-1.5 w-32">
                      {['es', 'en', 'it', 'pt'].map(lng => (
                        <button key={lng} onClick={()=>{changeLanguage(lng); closeAll()}} className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition ${language===lng ? 'bg-light-accent text-white' : 'hover:bg-light-surface-tertiary text-light-text-secondary'}`}>
                           {lng.toUpperCase()}
                        </button>
                      ))}
                   </div>
                </Popover>
              </div>

              {/* Theme */}
              <IconCircleBtn 
                label={theme === 'dark' ? 'Light' : 'Dark'} 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                 <motion.div initial={false} animate={{ rotate: theme === 'dark' ? 180 : 0 }} transition={{type:'spring'}}>
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                 </motion.div>
              </IconCircleBtn>
            </div>
          </div>

        </div>
      </motion.footer>

      {/* MOBILE SHEET */}
      <BottomSheet open={activeMenu === 'mobile_explore'} onClose={closeAll} title="Navegación & Ajustes">
        <div className="space-y-6">
           {/* Full Grid Apps */}
           <div>
              <h4 className="text-xs font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase mb-3 ml-1">Aplicaciones</h4>
              <div className="grid grid-cols-4 gap-4">
                {buttons.map(item => {
                  const Icon = Icons[item.icon] || Icons.FaCircle;
                  return (
                    <Link key={item.fullPath} to={item.fullPath} onClick={closeAll} className="flex flex-col items-center gap-2 group">
                       <div className="h-14 w-14 rounded-2xl bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center text-light-text-primary dark:text-dark-text-primary group-hover:bg-light-accent group-hover:text-white transition-colors shadow-sm border border-light-border dark:border-dark-border">
                          <Icon size={24} />
                       </div>
                       <span className="text-xs font-medium text-center truncate w-full">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
           </div>
           
           {/* System Tools Mobile */}
           <div>
              <h4 className="text-xs font-bold text-light-text-tertiary dark:text-dark-text-tertiary uppercase mb-3 ml-1">Sistema</h4>
              <div className="flex gap-4">
                 <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 h-12 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center gap-2 text-sm font-semibold">
                    {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
                 </button>
                 <button onClick={() => {changeLanguage(language === 'es' ? 'en' : 'es'); closeAll()}} className="flex-1 h-12 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center gap-2 text-sm font-semibold">
                    <Globe size={18}/>
                    {language.toUpperCase()}
                 </button>
              </div>
           </div>
        </div>
      </BottomSheet>
    </>
  );
};

export default Footer;