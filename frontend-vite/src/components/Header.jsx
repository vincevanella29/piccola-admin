import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'react-icons/fa';
import {
  Menu, X, Search, User, Wallet, LogOut, Copy, Share2, Eye, ChevronDown, Sparkles, UserCircle2
} from 'lucide-react';
import QRCode from 'react-qr-code';

// Importa tus componentes e íconos (ajusta las rutas si es necesario)
import PiccolaIcon from './common/PiccolaIcon';
// Si usas VanellixIcon, impórtalo, si no usa PiccolaIcon
// import VanellixIcon from './common/VanellixIcon.jsx'; 
import { getHeaderConfig, getWalletMenuConfig, getSearchConfig } from '../pages/pagesConfig';
import { useWalletBalances } from '../hooks/useWalletBalances.jsx';

// --- ESTILOS GLASSMORPHISM ---
const DOCK_GLASS = "backdrop-blur-xl bg-light-surface/85 dark:bg-dark-surface/85 border border-light-border/50 dark:border-dark-border/50 shadow-modal";
const DROPDOWN_GLASS = "backdrop-blur-xl bg-light-surface/95 dark:bg-dark-surface/95 border border-light-border dark:border-dark-border shadow-neon";

// --- UTILS ---
const haptics = (ms = 10) => { try { window?.navigator?.vibrate?.(ms); } catch (_) {} };

const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary uppercase tracking-wide">
    {children}
  </span>
);

const Avatar = ({ url, size = 32 }) => (
  url ? (
    <img src={url} alt="profile" className="rounded-full object-cover border border-light-border/50 dark:border-dark-border/50" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-light-border dark:border-dark-border flex items-center justify-center" style={{ width: size, height: size }}>
      <UserCircle2 className="text-light-text-tertiary dark:text-dark-text-tertiary" size={Math.max(14, size - 10)} />
    </div>
  )
);

// --- TOAST MINIMALISTA ---
const Toast = ({ open, onClose, children }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed top-24 inset-x-0 z-[95] flex justify-center px-3 pointer-events-none"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-light-border dark:border-dark-border bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-md shadow-2xl px-4 py-3 flex items-center gap-3">
          <div className="p-2 rounded-full bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent">
             <Sparkles size={16} />
          </div>
          <div className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary flex-1">{children}</div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-light-text-secondary">✕</button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// --- COMMAND / SEARCH OVERLAY ---
const CommandOverlay = ({ open, onClose, searchConfig, onNavigate }) => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    } else {
      setQ(''); // Clear on close
    }
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return searchConfig.slice(0, 8);
    return searchConfig
      .filter((it) => (it.label + ' ' + (it.description || '')).toLowerCase().includes(s))
      .slice(0, 12);
  }, [q, searchConfig]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-[4px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          />
          <motion.div
            className="fixed top-[15vh] inset-x-4 z-[85] w-full max-w-lg mx-auto rounded-3xl border border-light-border dark:border-dark-border bg-light-surface/80 dark:bg-dark-surface/80 backdrop-blur-xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-4 border-b border-light-border/50 dark:border-dark-border/50">
              <Search size={20} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('header.search_placeholder', 'Buscar...')}
                className="flex-1 bg-transparent outline-none text-base text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary font-medium"
              />
              <Chip>ESC</Chip>
            </div>
            <div className="p-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
              {results.length === 0 ? (
                <div className="p-8 text-center text-light-text-secondary dark:text-dark-text-secondary text-sm font-medium">
                  {t('search.no_results', 'No hay resultados')}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {results.map((item) => {
                    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                    const onClick = () => {
                      onClose();
                      haptics(15);
                      if (item.isExternal) {
                        window.open(item.fullPath, item.newTab ? '_blank' : '_self');
                      } else {
                        onNavigate(item.fullPath);
                      }
                    };
                    return (
                      <button
                        key={item.fullPath}
                        onClick={onClick}
                        className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors text-left w-full"
                      >
                        <div className="h-10 w-10 rounded-xl bg-light-surface-secondary dark:bg-dark-surface-secondary flex items-center justify-center group-hover:bg-light-accent group-hover:text-white dark:group-hover:bg-dark-accent dark:group-hover:text-white transition-colors text-light-text-secondary dark:text-dark-text-secondary">
                          <IconComponent size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{item.label}</div>
                          <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary truncate">{item.description}</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 text-light-text-tertiary transition-opacity">
                           <Icons.FaChevronRight size={12} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- WALLET SHEET (Estilo Glass) ---
const WalletSheet = ({ open, onClose, account, profile, onViewWallet, onDisconnect, menuItems = [], t, chainId, isAuthenticated }) => {
  // Hook de balances
  const { tokens = [], loading: balancesLoading } = useWalletBalances(account, open, chainId) || {};
  const native = Array.isArray(tokens) ? tokens.find((t) => t?.isNative) : null;
  const nativeBalance = typeof native?.balance === 'number' ? native.balance : null;
  const nativeSymbol = native?.symbol || (chainId ? 'ETH' : '');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div 
             className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm" 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
             onClick={onClose} 
          />
          <motion.div
            className={`fixed inset-x-0 bottom-6 md:bottom-24 z-[90] w-[95vw] max-w-md mx-auto rounded-[32px] ${DROPDOWN_GLASS} overflow-hidden`}
            initial={{ y: '120%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '120%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Sheet Handle */}
            <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
               <div className="w-12 h-1.5 rounded-full bg-light-border/50 dark:bg-dark-border/50" />
            </div>

            <div className="px-5 pb-6 pt-2">
              {/* Header Profile */}
              <div className="flex items-center gap-4 mb-6">
                <div className="p-1 rounded-full border border-light-accent/30 dark:border-dark-accent/30">
                   <Avatar url={profile?.profile_image_url} size={56} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                    {profile?.name || (account ? 'Usuario' : t('header.no_wallet'))}
                  </div>
                  {account && (
                    <button onClick={() => { navigator.clipboard?.writeText(account); haptics(); }} className="flex items-center gap-1.5 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-accent transition-colors">
                      <span className="font-mono bg-light-surface-secondary dark:bg-dark-surface-secondary px-2 py-0.5 rounded-md">{account.slice(0,6)}...{account.slice(-4)}</span>
                      <Copy size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button onClick={() => { onViewWallet(); haptics(); }} className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent transition-all">
                  <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20"><Eye size={20} /></div>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{t('header.view_wallet', 'Ver')}</span>
                </button>
                <button 
                   disabled={!account}
                   onClick={() => { navigator.clipboard?.writeText(account); haptics(); }} 
                   className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent transition-all disabled:opacity-50"
                >
                  <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20"><Copy size={20} /></div>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{t('wallet.copy_address', 'Copiar')}</span>
                </button>
                <button 
                   disabled={!account}
                   onClick={() => { if(navigator.share) navigator.share({text: account}); haptics(); }}
                   className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 hover:bg-light-accent hover:text-white dark:hover:bg-dark-accent transition-all disabled:opacity-50"
                >
                  <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20"><Share2 size={20} /></div>
                  <span className="text-[10px] font-bold uppercase tracking-wide">{t('wallet.share', 'Share')}</span>
                </button>
              </div>

              {/* QR Card */}
              {account && (
                <div className="mb-5 p-4 rounded-3xl bg-light-surface-secondary/30 dark:bg-black/20 border border-light-border/50 dark:border-dark-border/50 flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
                    <QRCode value={account} size={70} level="M" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-medium uppercase tracking-wide mb-1">Balance</div>
                     <div className="text-xl font-bold text-light-text-primary dark:text-dark-text-primary truncate">
                        {balancesLoading ? '...' : `${parseFloat(nativeBalance || 0).toFixed(4)} ${nativeSymbol}`}
                     </div>
                     <div className="text-[10px] text-light-text-secondary mt-1 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/> Chain ID: {chainId || 'N/A'}
                     </div>
                  </div>
                </div>
              )}

              {/* Menu Items */}
              <div className="space-y-1">
                 {menuItems.map((item) => {
                    const Icon = Icons[item.icon] || Icons.FaCircle;
                    const click = () => {
                       haptics();
                       if (item.isExternal) window.open(item.fullPath, item.newTab ? '_blank' : '_self');
                       else { onClose(); item.__navigate?.(item.fullPath); }
                    };
                    return (
                       <button key={item.fullPath} onClick={click} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors">
                          <Icon size={16} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <Icons.FaChevronRight size={10} className="opacity-50" />
                       </button>
                    )
                 })}
                 
                 <div className="h-[1px] bg-light-border/50 dark:bg-dark-border/50 my-2 mx-2" />
                 
                 {isAuthenticated ? (
                    <button onClick={() => { onDisconnect(); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-light-error dark:text-dark-error hover:bg-light-error/10 dark:hover:bg-dark-error/10 transition-colors">
                       <LogOut size={18} />
                       <span>{t('header.disconnect', 'Desconectar')}</span>
                    </button>
                 ) : (
                    <button onClick={() => { onViewWallet(); }} className="w-full py-3 rounded-xl bg-light-accent dark:bg-dark-accent text-white font-bold shadow-lg shadow-light-accent/30 dark:shadow-dark-accent/30">
                       {t('header.create_wallet', 'Conectar Wallet')}
                    </button>
                 )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- COMPONENTE PRINCIPAL ---

const Header = ({ toggleSidebar, isSidebarOpen, account, disconnectWallet, isConnecting, appState, openWalletModal }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [walletOpen, setWalletOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  // Configuración
  const headerConfig = useMemo(() => getHeaderConfig(appState.roleLevel, t), [appState.roleLevel, t]);
  const walletMenuConfig = useMemo(() => getWalletMenuConfig(appState.roleLevel, t), [appState.roleLevel, t]);
  const searchConfig = useMemo(() => getSearchConfig(appState.roleLevel, t), [appState.roleLevel, t]);
  const profile = appState?.profile;
  
  // Kiosk Logic (para ocultar boton sidebar si es desktop)
  const isHorizontal = appState?.media?.orientationLogical === 'horizontal';
  const isKiosk = !!appState?.media?.isKiosk;
  const forceDesktopSidebar = isKiosk && isHorizontal;

  // Handlers
  const handleLogin = () => { appState?.connectWallet?.(appState); };
  const onViewWallet = async () => {
    setWalletOpen(false);
    if (!appState?.account) {
      try { await appState?.createWalletOnDemand?.(); } 
      finally { if (appState?.account) openWalletModal(); }
      return;
    }
    openWalletModal();
  };

  // Cumpleaños Logic
  const isBirthday = () => {
    if (!profile?.birthdate) return false;
    const today = new Date();
    const b = new Date(profile.birthdate);
    return today.getMonth() === b.getMonth() && today.getDate() === b.getDate();
  };
  
  // Toast Birthday Effect
  useEffect(() => {
    if (isBirthday()) {
      const key = `piccola:bday:${new Date().getFullYear()}`;
      if (!localStorage.getItem(key)) {
        setToastOpen(true);
        localStorage.setItem(key, 'shown');
      }
    }
  }, [profile]);

  // Shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen(prev => !prev); }
      if (e.key === 'Escape') { setCmdOpen(false); setWalletOpen(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigateTo = (path) => navigate(path);
  const walletItemsWithNav = walletMenuConfig.map((it) => ({ ...it, __navigate: navigateTo }));

  return (
    <>
      {/* --- HEADER FIXED CONTAINER (sin fondo propio, deja ver el del wrapper) --- */}
      <header className="fixed top-0 left-0 right-0 h-24 z-[50] pointer-events-none flex justify-center px-4">
        
        <Toast open={toastOpen} onClose={() => setToastOpen(false)}>
           🎉 ¡Feliz cumpleaños{profile?.name ? `, ${profile.name}` : ''}!
        </Toast>

        {/* --- DOCK FLOTANTE REAL --- */}
        <motion.div 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 25 }}
          className={`pointer-events-auto mt-4 w-full max-w-7xl h-16 rounded-2xl flex items-center justify-between px-4 sm:px-6 ${DOCK_GLASS}`}
        >
          
          {/* LEFT: Menu & Brand */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { toggleSidebar(); haptics(); }}
              className={`${forceDesktopSidebar ? 'hidden' : 'lg:hidden'} p-2 rounded-xl text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-all active:scale-95`}
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <Link to="/" className="flex items-center gap-3 group" onClick={() => haptics()}>
               {/* Reemplaza PiccolaIcon por tu SVG o componente */}
               <PiccolaIcon className="h-8 w-auto drop-shadow-md group-hover:scale-105 transition-transform" />
               <div className="hidden md:flex flex-col leading-none">
                   {/* Opcional: Nombre de la app o versión */}
               </div>
            </Link>
          </div>

          {/* CENTER: Navigation Pills (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
             {headerConfig.map((item) => {
               const Icon = Icons[item.icon] || Icons.FaCircle;
               return (
                 <NavLink
                   key={item.fullPath}
                   to={item.fullPath}
                   className={({ isActive }) => `
                     relative px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all duration-300 flex items-center gap-2
                     ${isActive 
                       ? 'text-light-text-primary dark:text-dark-text-primary bg-light-surface-secondary dark:bg-white/10 shadow-sm scale-105' 
                       : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-surface-secondary/50 dark:hover:bg-white/5'}
                   `}
                 >
                   <Icon size={12} />
                   {item.label}
                 </NavLink>
               );
             })}
          </nav>

          {/* RIGHT: Search & Wallet/Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
             
             {/* Search Trigger */}
             <button 
                onClick={() => { setCmdOpen(true); haptics(); }}
                className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary transition-all hover:text-light-accent dark:hover:text-dark-accent"
                title="Buscar (Ctrl+K)"
             >
                <Search size={20} />
             </button>

             <div className="w-[1px] h-6 bg-light-border dark:bg-dark-border mx-1 hidden sm:block opacity-50" />

             {/* Wallet / Profile Button */}
             {!appState?.isWalletDataReady ? (
               <div className="h-9 w-24 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-full animate-pulse" />
             ) : appState?.isAuthenticated ? (
                <button 
                  onClick={() => { setWalletOpen(true); haptics(); }}
                  className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all duration-300 group
                    ${walletOpen 
                      ? 'bg-light-accent/10 border-light-accent dark:bg-dark-accent/10 dark:border-dark-accent' 
                      : 'bg-transparent border-transparent hover:bg-light-surface-secondary dark:hover:bg-dark-surface-secondary'}
                  `}
                >
                   <Avatar url={profile?.profile_image_url} size={32} />
                   <div className="hidden sm:block text-left">
                      <div className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary truncate max-w-[100px]">
                         {profile?.name || account?.slice(0,8) || 'Usuario'}
                      </div>
                      {isBirthday() && <div className="text-[9px] text-light-accent dark:text-dark-accent leading-none">🎂 Cumpleaños</div>}
                   </div>
                   <ChevronDown size={14} className="text-light-text-tertiary group-hover:text-light-text-primary dark:group-hover:text-dark-text-primary transition-colors" />
                </button>
             ) : (
                <button 
                   onClick={() => { handleLogin(); haptics(); }} 
                   disabled={isConnecting}
                   className="flex items-center gap-2 px-4 py-2 rounded-full bg-light-accent dark:bg-dark-accent text-white font-bold text-xs shadow-lg shadow-light-accent/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                >
                   {isConnecting ? <Icons.FaSpinner className="animate-spin" /> : <Wallet size={16} />}
                   <span>{isConnecting ? 'Conectando...' : t('header.connect_wallet', 'Wallet')}</span>
                </button>
             )}

          </div>
          
        </motion.div>
      </header>

      {/* Overlays */}
      <CommandOverlay 
        open={cmdOpen} 
        onClose={() => setCmdOpen(false)} 
        searchConfig={searchConfig} 
        onNavigate={navigateTo} 
      />
      
      <WalletSheet
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        account={account}
        profile={profile}
        onViewWallet={onViewWallet}
        onDisconnect={() => disconnectWallet(appState)}
        menuItems={walletItemsWithNav}
        t={t}
        chainId={appState?.chainId}
        isAuthenticated={appState?.isAuthenticated}
      />
    </>
  );
};

export default Header;