import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'react-icons/fa';
import {
  Menu, X, Wallet, ChevronDown, Search, Eye, LogOut,
  UserCircle2, Copy, Sparkles, Share2
} from 'lucide-react';

import PiccolaIcon from './common/PiccolaIcon';
import { getHeaderConfig, getWalletMenuConfig, getSearchConfig } from '../pages/pagesConfig';
import QRCode from 'react-qr-code';
import { useWalletBalances } from '../hooks/useWalletBalances.jsx';

// ---- Utils
const haptics = (ms = 10) => { try { window?.navigator?.vibrate?.(ms); } catch(_) {} };

const Avatar = ({ url, size = 32 }) => (
  url ? (
    <img src={url} alt="profile" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center" style={{ width: size, height: size }}>
      <UserCircle2 className="text-light-text-secondary dark:text-dark-text-secondary" size={Math.max(18, size - 12)} />
    </div>
  )
);

const Chip = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-[11px] border border-light-border dark:border-dark-border bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
    {children}
  </span>
);

// ---- Toast minimal
const Toast = ({ open, onClose, children }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed top-3 inset-x-0 z-[95] flex justify-center px-3"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -24, opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="max-w-md w-full rounded-xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-xl px-4 py-3 flex items-center gap-2">
          <Sparkles size={16} className="text-light-accent dark:text-dark-accent" />
          <div className="text-sm text-light-text-primary dark:text-dark-text-primary">{children}</div>
          <button onClick={onClose} className="ml-auto text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary">✕</button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---- Command/Search Overlay (centrado en móvil)
const CommandOverlay = ({ open, onClose, searchConfig, onNavigate }) => {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 60); } }, [open]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return searchConfig.slice(0, 12);
    return searchConfig.filter((it) => (it.label + ' ' + (it.description||'')).toLowerCase().includes(s)).slice(0, 24);
  }, [q, searchConfig]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed top-[8vh] inset-x-3 z-[85] w-auto max-w-xl mx-auto rounded-2xl border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-2xl"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-light-border dark:border-dark-border">
              <Search size={18} className="text-light-text-tertiary dark:text-dark-text-tertiary" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('header.search_placeholder')}
                className="flex-1 h-9 bg-transparent outline-none text-sm text-light-text-primary dark:text-dark-text-primary placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary"
              />
              <Chip>{t('common.esc') || 'ESC'}</Chip>
            </div>
            <div className="p-2 max-h-[60vh] overflow-auto">
              {results.length === 0 ? (
                <div className="p-6 text-center text-light-text-secondary dark:text-dark-text-secondary text-sm">{t('search.no_results') || 'No results'}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {results.map((item) => {
                    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                    const onClick = () => {
                      onClose();
                      haptics(15);
                      if (item.isExternal) {
                        window.open(item.fullPath, item.newTab ? '_blank' : '_self');
                      } else { onNavigate(item.fullPath); }
                    };
                    return (
                      <button
                        key={item.fullPath}
                        onClick={onClick}
                        className="flex items-center gap-2 p-2 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-left"
                        title={item.description}
                      >
                        <div className="h-9 w-9 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border flex items-center justify-center">
                          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-light-text-primary dark:text-dark-text-primary truncate">{item.label}</div>
                          <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary truncate">{item.description}</div>
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

// ---- Wallet Bottom Sheet (pro)
const WalletSheet = ({ open, onClose, account, profile, onViewWallet, onDisconnect, menuItems = [], t, chainId, isAuthenticated, isOpenBalances = true }) => {
  // Reutiliza hooks reales: solo cuando hay wallet y el sheet está abierto
  const { tokens = [], loading: balancesLoading } = useWalletBalances(account, open && isOpenBalances, chainId) || {};
  const native = Array.isArray(tokens) ? tokens.find((t) => t?.isNative) : null;
  const nativeBalance = typeof native?.balance === 'number' ? native.balance : null;
  const nativeSymbol = native?.symbol || (chainId ? 'NATIVE' : undefined);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-0 bottom-[var(--app-footer-h,40px)] z-[90] rounded-t-2xl border-t border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-center pt-2"><div className="h-1 w-12 rounded-full bg-light-border dark:bg-dark-border" /></div>
            <div className="px-4 pb-[calc(env(safe-area-inset-bottom,12px)+8px+var(--app-footer-h,40px))]">
              <div className="flex items-center gap-3 py-3">
                <Avatar url={profile?.profile_image_url} size={44} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{profile?.name || (account ? account : t('header.no_wallet'))}</div>
                  {account && (
                    <div className="flex items-center gap-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                      <Chip>{account.slice(0,6)}…{account.slice(-4)}</Chip>
                      <button onClick={() => { navigator.clipboard?.writeText(account); haptics(); }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover"><Copy size={12} />Copy</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones útiles solamente */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button onClick={() => { onViewWallet(); haptics(); }} className="p-3 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover flex flex-col items-center gap-2">
                  <Eye size={18} className="text-light-accent dark:text-dark-accent" />
                  <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('header.view_wallet')}</span>
                </button>
                {account ? (
                  <button onClick={() => { navigator.clipboard?.writeText(account); haptics(12); }} className="p-3 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover flex flex-col items-center gap-2">
                    <Copy size={18} className="text-light-accent dark:text-dark-accent" />
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('wallet.copy_address') || 'Copy'}</span>
                  </button>
                ) : (
                  <button disabled className="p-3 rounded-xl border border-light-border dark:border-dark-border opacity-50 cursor-not-allowed flex flex-col items-center gap-2">
                    <Copy size={18} />
                    <span className="text-[11px]">{t('wallet.copy_address') || 'Copy'}</span>
                  </button>
                )}
                {account ? (
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: 'Wallet', text: account }).catch(() => {});
                      } else {
                        navigator.clipboard?.writeText(account);
                      }
                      haptics(12);
                    }}
                    className="p-3 rounded-xl border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover flex flex-col items-center gap-2"
                  >
                    <Share2 size={18} className="text-light-accent dark:text-dark-accent" />
                    <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{t('wallet.share') || 'Share'}</span>
                  </button>
                ) : (
                  <button disabled className="p-3 rounded-xl border border-light-border dark:border-dark-border opacity-50 cursor-not-allowed flex flex-col items-center gap-2">
                    <Share2 size={18} />
                    <span className="text-[11px]">{t('wallet.share') || 'Share'}</span>
                  </button>
                )}
              </div>

              {/* QR Card (solo si hay wallet) */}
              {account && (
                <div className="mb-3 px-3 py-3 rounded-xl border border-light-border dark:border-dark-border bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 flex items-center gap-3">
                  <div className="shrink-0 rounded-xl overflow-hidden border border-light-border dark:border-dark-border bg-white p-2">
                    <QRCode value={account} size={120} includeMargin={false} level="M" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{t('header.wallet_address') || 'Wallet address'}</div>
                    <div className="text-sm font-semibold text-light-text-primary dark:text-dark-text-primary truncate">{account}</div>
                    {chainId && (
                      <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">Chain ID: {chainId}</div>
                    )}
                    {nativeSymbol && (
                      <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary mt-0.5">
                        {balancesLoading ? '—' : `${nativeBalance ?? 0} ${nativeSymbol}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="divide-y divide-light-border dark:divide-dark-border rounded-xl border border-light-border dark:border-dark-border overflow-hidden">
                {[...menuItems].map((item) => {
                  const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                  const click = () => {
                    haptics(15);
                    if (item.isExternal) {
                      window.open(item.fullPath, item.newTab ? '_blank' : '_self');
                    } else {
                      onClose();
                      item.__navigate?.(item.fullPath);
                    }
                  };
                  return (
                    <button key={item.fullPath} onClick={click} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover">
                      <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                {isAuthenticated ? (
                  <button onClick={() => { onDisconnect(); haptics(20); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-light-error dark:text-dark-error hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover">
                    <LogOut size={16} /> {t('header.disconnect')}
                  </button>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{t('header.no_wallet')}</span>
                    <button onClick={() => { onViewWallet(); haptics(15); }} className="px-3 py-1 rounded-full border border-light-border dark:border-dark-border hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-light-text-primary dark:text-dark-text-primary">{t('header.create_wallet')}</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center py-3 text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary">
                <Sparkles size={12} className="mr-1" /> PWA mobile ready
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ---- Header (desktop + mobile pro)
const Header = ({ toggleSidebar, isSidebarOpen, account, disconnectWallet, isConnecting, appState, openWalletModal }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [walletOpen, setWalletOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const headerConfig = getHeaderConfig(appState.roleLevel, t);
  const walletMenuConfig = getWalletMenuConfig(appState.roleLevel, t);
  const searchConfig = getSearchConfig(appState.roleLevel, t);
  const profile = appState?.profile;

  const handleLogin = () => { appState?.connectWallet?.(appState); };
  const onViewWallet = async () => {
    // cierra sheet antes de abrir modal de wallet
    setWalletOpen(false);
    if (!appState?.account) {
      try {
        await appState?.createWalletOnDemand?.();
      } finally {
        if (appState?.account) openWalletModal();
      }
      return;
    }
    openWalletModal();
  };

  // Helpers de cumpleaños
  const isBirthday = () => {
    if (!profile?.birthdate) return false;
    const today = new Date();
    const b = new Date(profile.birthdate);
    return today.getMonth() === b.getMonth() && today.getDate() === b.getDate();
  };
  const daysUntilBirthday = () => {
    if (!profile?.birthdate) return null;
    const today = new Date();
    const b = new Date(profile.birthdate);
    const year = today.getFullYear();
    const next = new Date(year, b.getMonth(), b.getDate());
    if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      next.setFullYear(year + 1);
    }
    const ms = next - today;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  // Toast de cumple (una vez al día)
  useEffect(() => {
    if (!profile?.birthdate) return;
    if (!isBirthday()) return;
    const todayISO = new Date().toISOString().slice(0, 10);
    const key = `piccola:bday-toast:${todayISO}:${profile?.id || account || 'user'}`;
    try {
      const already = localStorage.getItem(key);
      if (!already) {
        setToastOpen(true);
        localStorage.setItem(key, '1');
      }
    } catch (_) {}
  }, [profile?.birthdate, profile?.id, account]);

  // Allow Cmd+K to open search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((v) => !v); }
      if (e.key === 'Escape') { setCmdOpen(false); setWalletOpen(false); setToastOpen(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigateTo = (path) => navigate(path);
  const walletItemsWithNav = walletMenuConfig.map((it) => ({ ...it, __navigate: navigateTo }));

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-light-surface dark:bg-dark-surface border-b border-light-border dark:border-dark-border z-50 flex items-center">
      {/* Toast cumple */}
      <Toast open={toastOpen} onClose={() => setToastOpen(false)}>
        {`🎉 ¡Feliz cumple${profile?.name ? ', ' + profile.name : ''}! Que sea un día filete.`}
      </Toast>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 w-full">
        {/* Left */}
        <div className="flex items-center gap-2">
          <button onClick={() => { toggleSidebar(); haptics(10); }} className="lg:hidden text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary">
            {isSidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <PiccolaIcon className="h-12" />
          </Link>
        </div>

        {/* Center: desktop nav + mobile search button */}
        <div className="flex-1 flex items-center justify-center">
          <nav className="hidden lg:flex items-center gap-6">
            {headerConfig.map((item) => {
              const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
              return item.isExternal ? (
                <a key={item.fullPath} href={item.fullPath} target={item.newTab ? '_blank' : '_self'} rel={item.newTab ? 'noopener noreferrer' : undefined} className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm">
                  <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />{item.label}
                </a>
              ) : (
                <NavLink key={item.fullPath} to={item.fullPath} className={({ isActive }) => `flex items-center gap-2 text-sm ${isActive ? 'text-light-text-primary dark:text-dark-text-primary font-semibold' : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'}`}>
                  <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />{item.label}
                </NavLink>
              );
            })}
          </nav>
          <button onClick={() => { setCmdOpen(true); haptics(10); }} className="lg:hidden inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-secondary dark:text-dark-text-secondary">
            <Search size={16} /><span className="text-xs">Search</span>
          </button>
        </div>

        {/* Right: wallet */}
        <div className="flex items-center gap-2">
          {!appState?.isWalletDataReady ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg animate-pulse min-w-[120px] h-10">
              <span className="w-5 h-5 rounded-full bg-light-border dark:bg-dark-border" />
              <span className="w-20 h-4 rounded bg-light-border dark:bg-dark-border" />
            </div>
          ) : appState?.isAuthenticated ? (
            account ? (
              <button onClick={() => { setWalletOpen(true); haptics(10); }} className="flex items-center gap-2 px-3 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover">
                <Avatar url={profile?.profile_image_url} size={28} />
                <span className="hidden sm:block text-sm text-light-text-primary dark:text-dark-text-primary max-w-[220px] truncate flex items-center gap-1">
                  {profile?.name || (account ? account.slice(0,6)+'…'+account.slice(-4) : t('header.no_wallet'))}
                  {(() => {
                    if (isBirthday()) return (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border">🎂 {t('header.today') || 'hoy'}</span>
                    );
                    const d = daysUntilBirthday();
                    return (typeof d === 'number' && d > 0 && d <= 30) ? (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-light-surface-secondary dark:bg-dark-surface-secondary border border-light-border dark:border-dark-border">
                        🎂 {t('header.in_days', { count: d }) || `en ${d} días`}
                      </span>
                    ) : null;
                  })()}
                </span>
                <ChevronDown size={16} className="text-light-text-secondary dark:text-dark-text-secondary" />
              </button>
            ) : (
              <button onClick={() => { setWalletOpen(true); haptics(10); }} className="flex items-center gap-2 px-3 py-2 bg-light-accent dark:bg-dark-accent text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover">
                <Wallet size={16} />
                <span className="text-sm">{t('header.create_wallet')}</span>
              </button>
            )
          ) : (
            <button onClick={() => { haptics(10); handleLogin(); }} disabled={isConnecting} className="flex items-center gap-2 px-3 py-2 bg-light-accent dark:bg-dark-accent text-light-text-primary dark:text-dark-text-primary rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover disabled:opacity-50">
              <Wallet size={16} />
              <span className="text-sm">{isConnecting ? t('header.connecting') : t('header.connect_wallet')}</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Overlays */}
      <CommandOverlay open={cmdOpen} onClose={() => setCmdOpen(false)} searchConfig={getSearchConfig(appState.roleLevel, t)} onNavigate={navigateTo} />
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
    </header>
  );
};

export default Header;
