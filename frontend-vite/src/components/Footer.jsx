import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import * as Icons from 'react-icons/fa';
import { Sun, Moon, Globe, ChevronDown, Settings, Ellipsis } from 'lucide-react';

import PiccolaFavicon from './common/PiccolaFavicon';
import { getFooterConfig } from '../pages/pagesConfig';

/**
 * Footer — compacto, profesional, con botones de icono + tooltips.
 * - Chat siempre visible si existe.
 * - Menú "Explore" como grid icon-only cuando hay overflow.
 * - Toggle Light/Dark con un switch de un toque.
 * - Selector de idioma en popover compacto.
 * - PWA mobile first (altura fija, safe-area, hit targets >= 40px).
 */

const MOBILE_LIMIT = 2; // chat + 2
const DESKTOP_LIMIT = 5; // chat + 4

const IconCircleBtn = ({ as: As = 'button', to, href, onClick, children, label, className = '', title, ...rest }) => {
  const base = (
    <div
      className={`group relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary border border-light-border dark:border-dark-border hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 ${className}`}
      title={title || label}
      aria-label={label}
      {...rest}
    >
      {children}
      {/* Tooltip */}
      <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="px-2 py-1 rounded bg-[#111]/90 text-white text-[10px] leading-none whitespace-nowrap shadow-md">
          {label}
        </div>
      </div>
    </div>
  );

  if (href) return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>{base}</a>
  );
  if (to) return (
    <Link to={to} onClick={onClick}>{base}</Link>
  );
  return (
    <button type="button" onClick={onClick} className="focus:outline-none">{base}</button>
  );
};

const Popover = ({ open, onClose, className = '', children }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18 }}
        className={`absolute bottom-14 right-0 z-[60] rounded-xl border border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary shadow-xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

const GridMenu = ({ items, onClose }) => {
  // Icon-only grid (Explore)
  return (
    <div className="p-2 w-64">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
          const El = item.isExternal ? 'a' : Link;
          const elProps = item.isExternal
            ? { href: item.fullPath, target: item.newTab ? '_blank' : '_self', rel: item.newTab ? 'noopener noreferrer' : undefined }
            : { to: item.fullPath };
          return (
            <El
              key={item.fullPath}
              {...elProps}
              onClick={() => onClose?.()}
              className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition"
              title={item.description || item.label}
              aria-label={item.label}
            >
              <div className="h-10 w-10 rounded-full border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center">
                <IconComponent className="text-light-accent dark:text-dark-accent" size={16} />
              </div>
              <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate w-full text-center">{item.label}</span>
            </El>
          );
        })}
      </div>
    </div>
  );
};

// --- Mobile Bottom Sheet (hermoso nivel top) ---
const useLockBodyScroll = (locked) => {
  React.useEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [locked]);
};

const BottomSheet = ({ open, onClose, title, children, footer }) => {
  useLockBodyScroll(open);
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[70] backdrop-blur-[2px] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-[75] rounded-t-2xl border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-center pt-2">
              <div className="h-1 w-12 rounded-full bg-light-border dark:bg-dark-border" />
            </div>
            <div className="px-4 pb-[calc(env(safe-area-inset-bottom,12px)+8px)]">
              <div className="flex items-center justify-between py-2">
                <h3 className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary">{title}</h3>
                <button
                  onClick={onClose}
                  className="px-2 py-1 text-xs rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary"
                >
                  Close
                </button>
              </div>
              {children}
              {footer && (
                <div className="mt-2">{footer}</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const MobileExplore = ({ categories, allowedFullPaths, onClose, onSearchChange, t }) => {
  const [query, setQuery] = useState('');
  const [openCat, setOpenCat] = useState(null);

  const allowedSet = React.useMemo(() => new Set(allowedFullPaths || []), [allowedFullPaths]);

  const filteredCategories = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (categories || []).map((cat) => {
      const itemsBase = cat.items || [];
      const visible = allowedSet.size
        ? itemsBase.filter((it) => allowedSet.has(it.fullPath))
        : itemsBase;
      const items = q
        ? visible.filter((it) => (it.label || '').toLowerCase().includes(q))
        : visible;
      return { category: cat.category, items };
    }).filter((c) => c.items.length > 0);
  }, [categories, allowedSet, query]);

  return (
    <div className="pt-1 pb-2">
      <div className="relative mb-2">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearchChange?.(e.target.value); }}
          placeholder="Buscar…"
          className="w-full h-10 rounded-xl px-3 border border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary focus:outline-none"
        />
      </div>
      <div className="max-h-[48vh] overflow-auto pr-1">
        {filteredCategories.map((cat) => (
          <div key={cat.category} className="mb-1 rounded-xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface-tertiary/40 dark:bg-dark-surface-tertiary/40">
            <button
              className="w-full flex items-center justify-between px-3 py-2"
              onClick={() => setOpenCat((prev) => prev === cat.category ? null : cat.category)}
            >
              <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary truncate">{t ? t(cat.category) : cat.category}</span>
              <ChevronDown size={16} className={`transition-transform ${openCat === cat.category ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {openCat === cat.category && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="px-2 pb-2"
                >
                  <div className="grid grid-cols-4 gap-2">
                    {cat.items.map((item) => {
                      const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                      const El = item.isExternal ? 'a' : Link;
                      const elProps = item.isExternal
                        ? { href: item.fullPath, target: item.newTab ? '_blank' : '_self', rel: item.newTab ? 'noopener noreferrer' : undefined }
                        : { to: item.fullPath };
                      return (
                        <El
                          key={item.fullPath}
                          {...elProps}
                          onClick={onClose}
                          className="group flex flex-col items-center gap-1 p-2 rounded-xl border border-transparent hover:border-light-border dark:hover:border-dark-border hover:bg-light-accent-hover/60 dark:hover:bg-dark-accent-hover/50 transition"
                          title={item.description || item.label}
                          aria-label={item.label}
                        >
                          <div className="h-12 w-12 rounded-2xl bg-light-surface-tertiary dark:bg-dark-surface-tertiary border border-light-border dark:border-dark-border flex items-center justify-center shadow-sm">
                            <IconComponent className="text-light-accent dark:text-dark-accent" size={18} />
                          </div>
                          <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary truncate w-full text-center">{item.label}</span>
                        </El>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

const Footer = ({ isAuthenticated, changeLanguage, roleLevel, theme, setTheme, language, t }) => {
  const { i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const footerConfig = useMemo(() => getFooterConfig(roleLevel, t), [roleLevel, t]);

  const buttons = useMemo(() => (
    footerConfig.flatMap((c) => c.items).sort((a, b) => (a.order || 1e9) - (b.order || 1e9))
  ), [footerConfig]);

  // Chat prioritized
  const chatItem = buttons.find((it) => it?.fullPath === '/app/chat' || it?.icon === 'FaComments' || /chat/i.test(it?.label || ''));
  const other = chatItem ? buttons.filter((it) => it !== chatItem) : buttons;

  const desktopVisible = (other.length + (chatItem ? 1 : 0) <= DESKTOP_LIMIT)
    ? buttons.slice(0, DESKTOP_LIMIT)
    : [chatItem, ...other.slice(0, DESKTOP_LIMIT - 1)].filter(Boolean);

  const mobileVisible = (other.length + (chatItem ? 1 : 0) <= MOBILE_LIMIT)
    ? buttons.slice(0, MOBILE_LIMIT)
    : [chatItem, ...other.slice(0, MOBILE_LIMIT - 1)].filter(Boolean);

  const overflowDesktop = buttons.filter((b) => !desktopVisible.includes(b));
  const overflowMobile = buttons.filter((b) => !mobileVisible.includes(b));

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const LangOption = ({ value, label }) => (
    <button
      className={`px-3 py-2 text-sm rounded-lg w-full text-left hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover ${language === value ? 'text-light-text-primary dark:text-dark-text-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}
      onClick={() => { changeLanguage(value); setLangOpen(false); setCfgOpen(false); }}
    >{label}</button>
  );

  const IconBtnFromItem = (item) => {
    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
    const common = {
      label: item.label,
      title: item.description || item.label,
      className: 'shrink-0',
    };
    if (item.isExternal) {
      return (
        <IconCircleBtn key={item.fullPath} href={item.fullPath} {...common}>
          <IconComponent className="text-light-accent dark:text-dark-accent" size={16} />
        </IconCircleBtn>
      );
    }
    return (
      <IconCircleBtn key={item.fullPath} to={item.fullPath} {...common}>
        <IconComponent className="text-light-accent dark:text-dark-accent" size={16} />
      </IconCircleBtn>
    );
  };

  return (
    <motion.footer
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 28 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed bottom-0 left-0 right-0 bg-light-surface dark:bg-dark-surface border-t border-light-border dark:border-dark-border z-50 pb-[env(safe-area-inset-bottom,12px)]"
    >
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Izquierda: Logo */}
        <div className="flex items-center gap-2">
          <Link to="/" aria-label="Home" className="shrink-0">
            <PiccolaFavicon className="w-7 h-7" />
          </Link>
        </div>

        {/* Centro: Botones (icon-only) */}
        <div className="flex-1 flex items-center justify-center">
          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-1">
            {desktopVisible.map(IconBtnFromItem)}
            {overflowDesktop.length > 0 && (
              <div className="relative">
                <IconCircleBtn label={t('footer.explore')} onClick={() => { setMenuOpen((v) => !v); setCfgOpen(false); setLangOpen(false); }}>
                  <Ellipsis size={16} />
                </IconCircleBtn>
                <Popover open={menuOpen}>
                  <GridMenu items={overflowDesktop} onClose={() => setMenuOpen(false)} />
                </Popover>
              </div>
            )}
          </div>

          {/* Mobile */}
          <div className="flex sm:hidden items-center gap-1">
            {mobileVisible.map(IconBtnFromItem)}
            <div className="relative">
              <IconCircleBtn label={t('footer.explore')} onClick={() => { setMenuOpen(true); setCfgOpen(false); setLangOpen(false); }}>
                <Ellipsis size={16} />
              </IconCircleBtn>
            </div>
          </div>
        </div>

        {/* Mobile BottomSheet Explore */}
        <BottomSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={t('footer.explore') || 'Explore'}
        >
          <MobileExplore
            categories={footerConfig}
            allowedFullPaths={(overflowMobile.length ? overflowMobile : buttons).map((b) => b.fullPath)}
            onClose={() => setMenuOpen(false)}
            t={t}
          />
        </BottomSheet>

        {/* Derecha: Social + Config */}
        <div className="flex items-center gap-2">
          {/* Socials submenu */}
          <div className="relative">
            <IconCircleBtn
              label={t('footer.socials') || 'Socials'}
              onClick={() => { setSocialOpen((v) => !v); setMenuOpen(false); setCfgOpen(false); setLangOpen(false); }}
            >
              <Icons.FaShareAlt size={16} />
            </IconCircleBtn>
            <Popover open={socialOpen}>
              <div className="p-2 w-64">
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href="https://x.com/LaPiccolaChile"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSocialOpen(false)}
                    className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition"
                    aria-label="X / Twitter"
                  >
                    <div className="h-10 w-10 rounded-full border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center">
                      <Icons.FaTwitter className="text-light-accent dark:text-dark-accent" size={16} />
                    </div>
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Twitter</span>
                  </a>
                  <a
                    href="https://discord.gg/SyCcpcEUxM"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSocialOpen(false)}
                    className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition"
                    aria-label="Discord"
                  >
                    <div className="h-10 w-10 rounded-full border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center">
                      <Icons.FaDiscord className="text-light-accent dark:text-dark-accent" size={16} />
                    </div>
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Discord</span>
                  </a>
                  <a
                    href="https://www.instagram.com/lapiccolaitaliaoficial/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setSocialOpen(false)}
                    className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition"
                    aria-label="Instagram"
                  >
                    <div className="h-10 w-10 rounded-full border border-light-border dark:border-dark-border bg-light-surface-tertiary dark:bg-dark-surface-tertiary flex items-center justify-center">
                      <Icons.FaInstagram className="text-light-accent dark:text-dark-accent" size={16} />
                    </div>
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">Instagram</span>
                  </a>
                </div>
              </div>
            </Popover>
          </div>

          {/* Language popover (desktop+mobile) */}
          <div className="relative">
            <IconCircleBtn label={t('footer.language') || 'Language'} onClick={() => { setLangOpen((v) => !v); setMenuOpen(false); setCfgOpen(false); setSocialOpen(false); }}>
              <Globe size={16} />
            </IconCircleBtn>
            <Popover open={langOpen}>
              <div className="p-2 w-44">
                <LangOption value="es" label={t('footer.language_es')} />
                <LangOption value="en" label={t('footer.language_en')} />
                <LangOption value="it" label={t('footer.language_it')} />
                <LangOption value="pt" label={t('footer.language_pt')} />
              </div>
            </Popover>
          </div>

          {/* Theme toggle (one-tap) */}
          <IconCircleBtn
            label={theme === 'dark' ? (t('footer.theme_light') || 'Light') : (t('footer.theme_dark') || 'Dark')}
            onClick={handleToggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconCircleBtn>

          {/* Extra config (if needed) */}
          <div className="relative hidden md:block">
            <IconCircleBtn label={t('footer.settings') || 'Settings'} onClick={() => { setCfgOpen((v) => !v); setMenuOpen(false); setLangOpen(false); setSocialOpen(false); }}>
              <Settings size={16} />
            </IconCircleBtn>
            <Popover open={cfgOpen}>
              <div className="p-3 w-56">
                <div className="text-xs font-semibold mb-2 text-light-text-secondary dark:text-dark-text-secondary">{t('footer.quick_actions') || 'Quick actions'}</div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{t('footer.theme') || 'Theme'}</span>
                  <button
                    onClick={handleToggleTheme}
                    className="px-3 py-1 rounded-full border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-sm"
                  >
                    {theme === 'dark' ? (t('footer.theme_light') || 'Light') : (t('footer.theme_dark') || 'Dark')}
                  </button>
                </div>
                <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary">{t('footer.pwa_hint') || 'Optimized for PWA mobile footer.'}</div>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
