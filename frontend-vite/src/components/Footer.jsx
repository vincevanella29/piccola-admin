import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getFooterConfig } from '../pages/pagesConfig';
import PiccolaFavicon from './common/PiccolaFavicon';
import { MessageCircle, ChevronDown, Settings } from 'lucide-react';
import { FaDiscord, FaTwitter, FaGithub, FaLinkedin, FaInstagram } from 'react-icons/fa';
import * as Icons from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const Footer = ({ isAuthenticated, changeLanguage, roleLevel, theme, setTheme, language, t }) => {
  const [isMenuSelectorOpen, setIsMenuSelectorOpen] = useState(false);
  const [isConfigSelectorOpen, setIsConfigSelectorOpen] = useState(false);
  const footerConfig = getFooterConfig(roleLevel, t);

  // Límites de botones visibles
  const MOBILE_BUTTON_LIMIT = 2;
  const DESKTOP_BUTTON_LIMIT = 4;

  // Obtener todos los ítems de botones
  const buttonItems = footerConfig
    .flatMap((category) => category.items)
    .sort((a, b) => (a.order || Infinity) - (b.order || Infinity));

  // Botones visibles en móvil y desktop
  const mobileVisibleButtons = buttonItems.slice(0, MOBILE_BUTTON_LIMIT);
  const desktopVisibleButtons = buttonItems.slice(0, DESKTOP_BUTTON_LIMIT);

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    setIsMenuSelectorOpen(false);
    setIsConfigSelectorOpen(false);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    setIsMenuSelectorOpen(false);
    setIsConfigSelectorOpen(false);
  };

  return (
    <motion.footer
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 32 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed bottom-0 left-0 right-0 h-16 bg-light-surface dark:bg-dark-surface border-t border-light-border dark:border-dark-border z-50 pb-[env(safe-area-inset-bottom,16px)]"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2 h-full">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0 z-50">
          <PiccolaFavicon className="w-6 h-6" />
        </Link>

        {/* Centro: Botones y Selector */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          {/* Desktop: Hasta 4 botones */}
          <div className="hidden sm:flex items-center gap-2">
            {buttonItems.length <= DESKTOP_BUTTON_LIMIT ? (
              buttonItems.map((item) => {
                const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                return item.isExternal ? (
                  <a
                    key={item.fullPath}
                    href={item.fullPath}
                    target={item.newTab ? '_blank' : '_self'}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    className="px-3 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-sm rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 flex items-center gap-1.5 transform hover:scale-105 shrink-0"
                    title={item.description}
                  >
                    <IconComponent className={`text-${theme === 'dark' ? 'light-accent' : 'dark-accent'}`} size={12} />
                    <span className="truncate">{item.label}</span>
                  </a>
                ) : (
                  <Link
                    key={item.fullPath}
                    to={item.fullPath}
                    className="px-3 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-sm rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 flex items-center gap-1.5 transform hover:scale-105 shrink-0"
                    title={item.description}
                  >
                    <IconComponent className={`text-${theme === 'dark' ? 'light-accent' : 'dark-accent'}`} size={12} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })
            ) : (
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setIsMenuSelectorOpen((prev) => !prev);
                    setIsConfigSelectorOpen(false);
                  }}
                  className="px-3 py-1.5 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-sm rounded-lg hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 flex items-center gap-1 transform hover:scale-105"
                >
                  {t('footer.explore')}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isMenuSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isMenuSelectorOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50">
                    {buttonItems.map((item) => {
                      const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                      return item.isExternal ? (
                        <a
                          key={item.fullPath}
                          href={item.fullPath}
                          target={item.newTab ? '_blank' : '_self'}
                          rel={item.newTab ? 'noopener noreferrer' : undefined}
                          className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                          onClick={() => {
                            setIsMenuSelectorOpen(false);
                            setIsConfigSelectorOpen(false);
                          }}
                        >
                          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                          <span className="truncate">{item.label}</span>
                        </a>
                      ) : (
                        <Link
                          key={item.fullPath}
                          to={item.fullPath}
                          className="block px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover hover:text-light-text-primary dark:hover:text-dark-text-primary text-sm transition-colors duration-200 flex items-center gap-2"
                          onClick={() => {
                            setIsMenuSelectorOpen(false);
                            setIsConfigSelectorOpen(false);
                          }}
                        >
                          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Móvil: Hasta 2 botones */}
          <div className="flex sm:hidden items-center gap-1">
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setIsMenuSelectorOpen((prev) => !prev);
                  setIsConfigSelectorOpen(false);
                }}
                className="px-2 py-1 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-xs rounded-md hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 flex items-center gap-1 transform hover:scale-105"
              >
                {t('footer.explore')}
                <ChevronDown className={`w-4 h-4 transition-transform ${isMenuSelectorOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isMenuSelectorOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-10 left-0 w-48 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50"
                  >
                    {buttonItems.map((item) => {
                      const IconComponent = Icons[item.icon] || Icons.FaFileAlt;
                      return item.isExternal ? (
                        <a
                          key={item.fullPath}
                          href={item.fullPath}
                          target={item.newTab ? '_blank' : '_self'}
                          rel={item.newTab ? 'noopener noreferrer' : undefined}
                          className="flex items-center gap-2 px-4 py-2 text-light-text-primary dark:text-dark-text-primary text-sm hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover rounded transition-all"
                          title={item.description}
                          onClick={() => setIsMenuSelectorOpen(false)}
                        >
                          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                          <span>{item.label}</span>
                        </a>
                      ) : (
                        <Link
                          key={item.fullPath}
                          to={item.fullPath}
                          className="flex items-center gap-2 px-4 py-2 text-light-text-primary dark:text-dark-text-primary text-sm hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover rounded transition-all"
                          title={item.description}
                          onClick={() => setIsMenuSelectorOpen(false)}
                        >
                          <IconComponent className="text-light-accent dark:text-dark-accent" size={14} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Derecha: Redes Sociales y Configuración */}
        <div className="flex items-center gap-2 shrink-0 z-50">
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://x.com/LaPiccolaChile"
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-twitter dark:hover:text-dark-social-twitter transition-colors duration-200"
            >
              <FaTwitter size={16} />
            </a>
            <a
              href="https://discord.gg/SyCcpcEUxM"
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-discord dark:hover:text-dark-social-discord transition-colors duration-200"
            >
              <MessageCircle size={16} />
            </a>
            <a
              href="https://www.instagram.com/lapiccolaitaliaoficial/"
              className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-social-instagram dark:hover:text-dark-social-instagram transition-colors duration-200"
            >
              <FaInstagram size={16} />
            </a>
          </div>
          {/* Configuración en Desktop */}
          <div className="hidden md:flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-2 py-1 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-xs rounded-lg focus:outline-none hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
            >
              <option value="es">{t('footer.language_es')}</option>
              <option value="en">{t('footer.language_en')}</option>
              <option value="it">{t('footer.language_it')}</option>
              <option value="pt">{t('footer.language_pt')}</option>
            </select>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="px-2 py-1 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-xs rounded-lg focus:outline-none hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
            >
              <option value="dark">{t('footer.theme_dark')}</option>
              <option value="light">{t('footer.theme_light')}</option>
            </select>
          </div>
          {/* Botón de Configuración en Móvil */}
          <button
            onClick={() => {
              setIsMenuSelectorOpen(false);
              setIsConfigSelectorOpen((prev) => !prev);
            }}
            className="flex md:hidden items-center px-2 py-1 bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary text-xs rounded-md hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200 transform hover:scale-105 z-50"
          >
            <Settings size={16} />
          </button>
          <AnimatePresence>
            {isConfigSelectorOpen && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="absolute bottom-20 right-4 w-48 bg-light-surface-secondary dark:bg-dark-surface-secondary rounded-lg shadow-lg py-2 z-50 sm:hidden"
              >
                <div className="px-4 py-2">
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary text-sm rounded-lg focus:outline-none hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
                  >
                    <option value="es">{t('footer.language_es')}</option>
                    <option value="en">{t('footer.language_en')}</option>
                    <option value="it">{t('footer.language_it')}</option>
                    <option value="pt">{t('footer.language_pt')}</option>
                  </select>
                </div>
                <div className="px-4 py-2">
                  <select
                    value={theme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-light-surface-tertiary dark:bg-dark-surface-tertiary text-light-text-primary dark:text-dark-text-primary text-sm rounded-lg focus:outline-none hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover transition-all duration-200"
                  >
                    <option value="dark">{t('footer.theme_dark')}</option>
                    <option value="light">{t('footer.theme_light')}</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;