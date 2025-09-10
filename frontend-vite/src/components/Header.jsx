import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { getHeaderConfig, getWalletMenuConfig, getSearchConfig } from '../pages/pagesConfig';
import PiccolaIcon from './common/PiccolaIcon';
import { Menu, X, Wallet, ChevronDown, Search, Eye, Cake } from 'lucide-react';
import * as Icons from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const HeaderNav = ({ headerConfig }) => (
  <nav className="hidden lg:flex items-center gap-6">
    {headerConfig.map((item) => {
      const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
      const commonClasses = ({ isActive }) =>
        `flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors duration-200 text-sm font-medium ${
          isActive ? 'text-light-text-primary dark:text-dark-text-primary font-semibold' : ''
        }`;

      return item.isExternal ? (
        <a
          key={item.fullPath}
          href={item.fullPath}
          target={item.newTab ? '_blank' : '_self'}
          rel={item.newTab ? 'noopener noreferrer' : undefined}
          className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors duration-200 text-sm font-medium"
          title={item.description}
        >
          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
          {item.label}
        </a>
      ) : (
        <NavLink
          key={item.fullPath}
          to={item.fullPath}
          className={commonClasses}
          title={item.description}
        >
          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
          {item.label}
        </NavLink>
      );
    })}
  </nav>
);

const Header = ({ toggleSidebar, isSidebarOpen, account, disconnectWallet, isConnecting, appState, openWalletModal }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const headerConfig = getHeaderConfig(appState.roleLevel, t);
  const walletMenuConfig = getWalletMenuConfig(appState.roleLevel, t);
  const searchConfig = getSearchConfig(appState.roleLevel, t);
  const profile = appState?.profile;

  const handleLogin = () => {
    appState?.connectWallet?.(appState);
  };

  const handleLogout = async () => {
    await disconnectWallet(appState);
    navigate('/');
    setIsWalletMenuOpen(false);
  };

  const handleViewWallet = () => {
    if (!appState?.account) {
      // Usuario autenticado PERO sin wallet: crear on-demand y luego abrir modal
      appState?.createWalletOnDemand?.().then(() => {
        if (appState?.account) openWalletModal();
      });
      setIsWalletMenuOpen(false);
      return;
    }
    openWalletModal();
    setIsWalletMenuOpen(false);
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    if (query.length > 0) {
      const results = searchConfig.filter(
        (item) => item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const isBirthday = () => {
    if (!profile?.birthdate) return false;
    const today = new Date();
    const birth = new Date(profile.birthdate);
    return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-light-surface dark:bg-dark-surface shadow-lg z-50 flex items-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 w-full"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors duration-200 transform hover:scale-105 lg:hidden"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <Link to="/" className="flex items-center gap-2">
            <PiccolaIcon className="h-12" />
          </Link>
        </div>

        <div className="relative flex-1 max-w-md hidden sm:block">
          <div className="flex items-center bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg px-3 py-2">
            <Search className="text-light-text-secondary dark:text-dark-text-secondary mr-2" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder={t('header.search_placeholder')}
              className="bg-transparent text-light-text-primary dark:text-dark-text-primary text-sm w-full focus:outline-none placeholder-dark-text-secondary dark:placeholder-light-text-secondary"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-2 w-full bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50 max-h-96 overflow-y-auto">
              {searchResults.map((item) => {
                const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                return item.isExternal ? (
                  <a
                    key={item.fullPath}
                    href={item.fullPath}
                    target={item.newTab ? '_blank' : '_self'}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                  >
                    <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <NavLink
                    key={item.fullPath}
                    to={item.fullPath}
                    className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                  >
                    <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <HeaderNav headerConfig={headerConfig} />

          {!appState?.isWalletDataReady ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg animate-pulse min-w-[120px] h-10">
              <span className="w-5 h-5 rounded-full bg-light-border dark:bg-dark-border" />
              <span className="w-20 h-4 rounded bg-light-border dark:bg-dark-border" />
            </div>
          ) : account ? (
            <div className="relative">
              <button
                onClick={() => setIsWalletMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-sm font-medium rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-colors duration-200 transform hover:scale-105"
              >
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Wallet size={18} />
                )}
                <span>
                  {profile?.name || `${account.slice(0, 3)}...${account.slice(-3)}`}
                  {isBirthday() && ' 🎂'}
                </span>
                <ChevronDown size={18} />
              </button>
              {isWalletMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50">
                  {/* View Wallet */}
                  <button
                    onClick={handleViewWallet}
                    className="w-full text-left px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                  >
                    <Eye className="text-light-accent dark:text-dark-accent" size={14} />
                    {t('header.view_wallet')}
                  </button>
                  {walletMenuConfig.map((item) => {
                    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                    return item.isExternal ? (
                      <a
                        key={item.fullPath}
                        href={item.fullPath}
                        target={item.newTab ? '_blank' : '_self'}
                        rel={item.newTab ? 'noopener noreferrer' : undefined}
                        className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                        onClick={() => setIsWalletMenuOpen(false)}
                      >
                        <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                        {item.label}
                      </a>
                    ) : (
                      <NavLink
                        key={item.fullPath}
                        to={item.fullPath}
                        className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                        onClick={() => setIsWalletMenuOpen(false)}
                      >
                        <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                  {/* Ocultamos 'View Wallet' según solicitud; mantenemos items de pagesConfig y 'Disconnect' */}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-light-error dark:text-dark-error hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-sm transition-colors duration-200"
                  >
                    {t('header.disconnect')}
                  </button>
                </div>
              )}
            </div>
          ) : appState?.isAuthenticated ? (
            // Autenticado sin wallet → mostrar menú con "Create wallet" verde y Logout
            <div className="relative">
              <button
                onClick={() => setIsWalletMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-4 py-2 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-sm font-medium rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-colors duration-200 transform hover:scale-105"
              >
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Wallet size={18} />
                )}
                <span>
                  {profile?.name || t('header.no_wallet')}
                </span>
                <ChevronDown size={18} />
              </button>
              {isWalletMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50">
                  {/* Create Wallet */}
                  <button
                    onClick={handleViewWallet}
                    className="w-full text-left px-4 py-2 text-green-600 dark:text-green-400 hover:bg-green-600/10 dark:hover:bg-green-400/10 text-sm transition-colors duration-200 flex items-center gap-2"
                  >
                    <Eye className="text-green-600 dark:text-green-400" size={14} />
                    {t('header.create_wallet')}
                  </button>
                  {walletMenuConfig.map((item) => {
                    const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                    return item.isExternal ? (
                      <a
                        key={item.fullPath}
                        href={item.fullPath}
                        target={item.newTab ? '_blank' : '_self'}
                        rel={item.newTab ? 'noopener noreferrer' : undefined}
                        className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                        onClick={() => setIsWalletMenuOpen(false)}
                      >
                        <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                        {item.label}
                      </a>
                    ) : (
                      <NavLink
                        key={item.fullPath}
                        to={item.fullPath}
                        className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                        onClick={() => setIsWalletMenuOpen(false)}
                      >
                        <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-light-error dark:text-dark-error hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-sm transition-colors duration-200"
                  >
                    {t('header.disconnect')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // No autenticado → botón de conectar
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 bg-light-accent dark:bg-dark-accent text-light-text-primary dark:text-dark-text-primary text-sm font-medium rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-colors duration-200 disabled:opacity-50 transform hover:scale-105"
                disabled={isConnecting}
              >
                <Wallet size={18} />
                {isConnecting ? t('header.connecting') : t('header.connect_wallet')}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </header>
  );
};

export default Header;