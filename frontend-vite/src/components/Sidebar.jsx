import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import * as Icons from 'react-icons/fa';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getSidebarConfig } from '../pages/pagesConfig';
import ActionButtons from './common/ActionButtons';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = memo(({ isSidebarOpen, toggleSidebar, isAuthenticated, appState, onSidebarHoverChange, onSidebarWidthChange }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const pagesConfig = useMemo(() => getSidebarConfig(appState.roleLevel, t), [appState.roleLevel, t]);

  // Animation variants for staggered fade-in
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.10, delayChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 24 } },
  };

  // Loading shimmer component
  const SidebarLoading = () => (
    <motion.div
      className="flex flex-col gap-4 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          className="h-8 bg-light-border dark:bg-dark-border rounded-lg animate-pulse w-full"
          style={{ opacity: 0.5 + 0.1 * i }}
        />
      ))}
    </motion.div>
  );

  const handleHover = (hovered) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(hovered);
      if (onSidebarHoverChange) onSidebarHoverChange(hovered);
    }, 100);
  };

  // Sincroniza el estado de hover al montar/desmontar
  useEffect(() => {
    if (onSidebarHoverChange) onSidebarHoverChange(isHovered);
    if (onSidebarWidthChange) {
      const width = isHovered || isSidebarOpen ? 256 : 64;
      onSidebarWidthChange(width);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered, isSidebarOpen]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const renderMenu = () => {
    return pagesConfig.map((category) => {
      const isExpanded = expandedCategories[category.category] || false;
      const hasItems = category.items?.length > 0;
      const IconComponent = Icons[category.icon] || Icons.FaFolder;

      return (
        <div key={category.category}>
          <div
            className={`flex items-center cursor-pointer transition-all duration-200 rounded-lg
              ${isHovered || isSidebarOpen ? 'gap-2 px-4 justify-start' : 'px-0 justify-center'}
              text-light-text-secondary dark:text-dark-text-secondary
              hover:text-light-text-primary dark:hover:text-dark-text-primary
              hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover
              py-3 px-4 sm:py-2
            `}
            onClick={() => toggleCategory(category.category)}
          >
            <IconComponent
              className="flex-shrink-0 text-light-accent dark:text-dark-accent transform hover:scale-110 transition-transform duration-200"
              size={24}
            />
            <span
              className={`truncate text-sm font-medium uppercase tracking-wide ${
                isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
              } transition-opacity duration-200`}
            >
              {category.categoryLabel}
            </span>
            {hasItems && (isHovered || isSidebarOpen) && (
              <span className="ml-auto">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-light-text-secondary dark:text-dark-text-secondary" />
                )}
              </span>
            )}
          </div>

          {hasItems && isExpanded && (isHovered || isSidebarOpen) && (
            <div className={`space-y-1 ${isHovered || isSidebarOpen ? 'pl-5' : 'pl-0'}`}>
              {category.items.map((item) => {
                const ItemIcon = Icons[item.icon] || Icons.FaFileAlt;
                const isActive = location.pathname === item.fullPath;

                return item.isExternal ? (
                  <div key={item.fullPath}>
                    <a
                      href={item.fullPath}
                      target={item.newTab ? '_blank' : '_self'}
                      rel={item.newTab ? 'noopener noreferrer' : undefined}
                      className={`flex items-center ${isHovered || isSidebarOpen ? 'gap-2 justify-start px-4' : 'justify-center px-0'} py-2 transition-all duration-200 rounded-md ${
                        isActive
                          ? 'text-light-accent dark:text-dark-accent bg-light-surface-secondary dark:bg-dark-surface-secondary'
                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover'
                      }`}
                      title={item.description}
                    >
                      <ItemIcon
                        className="flex-shrink-0 transform hover:scale-110 transition-transform duration-200"
                        size={18}
                      />
                      <span
                        className={`truncate text-sm ${
                          isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
                        } transition-opacity duration-200`}
                      >
                        {item.label}
                      </span>
                    </a>
                  </div>
                ) : (
                  <div key={item.fullPath}>
                    <NavLink
                      to={item.fullPath}
                      className={`flex items-center ${isHovered || isSidebarOpen ? 'gap-2 justify-start px-4' : 'justify-center px-0'} py-2 transition-all duration-200 rounded-md ${
                        isActive
                          ? 'text-light-accent dark:text-dark-accent bg-light-surface-secondary dark:bg-dark-surface-secondary'
                          : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover'
                      }`}
                      title={item.description}
                    >
                      <ItemIcon
                        className="flex-shrink-0 transform hover:scale-110 transition-transform duration-200"
                        size={18}
                      />
                      <span
                        className={`truncate text-sm ${
                          isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
                        } transition-opacity duration-200`}
                      >
                        {item.label}
                      </span>
                    </NavLink>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <motion.aside
        className={`bg-light-surface dark:bg-dark-surface border-r border-light-border dark:border-dark-border z-60 hidden lg:flex flex-col`}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        animate={{ width: isHovered ? 256 : 64 }}
        transition={{ duration: 0.35, ease: 'easeInOut' }}
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          bottom: 64,
          width: isHovered ? 256 : 64,
          overflow: 'hidden',
        }}
      >
        {!appState?.isWalletDataReady ? (
          <SidebarLoading />
        ) : (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: isHovered ? 0.1 : 0 }}
            className="p-4 space-y-4 h-full flex flex-col overflow-y-auto"
          >
            <motion.nav
              className="flex-1 space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {pagesConfig.length > 0 ? (
                pagesConfig.map((category, catIdx) => (
                  <motion.div key={category.category} variants={itemVariants}>
                    <div className="mb-1">
                      {/* Category with fade-in and divider */}
                      <div
                        className={`flex items-center cursor-pointer transition-all duration-200 rounded-xl
                          ${isHovered || isSidebarOpen ? 'gap-3 px-4 py-2 justify-start' : 'px-0 py-2 justify-center'}
                          text-light-text-secondary dark:text-dark-text-secondary
                          hover:text-light-text-primary dark:hover:text-dark-text-primary
                          hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover
                        `}
                        onClick={() => toggleCategory(category.category)}
                      >
                        <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35 }}>
                          {React.createElement(Icons[category.icon] || Icons.FaFolder, {
                            className: 'flex-shrink-0 text-light-accent dark:text-dark-accent',
                            size: 28
                          })}
                        </motion.span>
                        <span
                          className={`truncate text-base font-semibold uppercase tracking-wide ${
                            isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
                          } transition-opacity duration-200`}
                        >
                          {category.categoryLabel}
                        </span>
                        {category.items?.length > 0 && (isHovered || isSidebarOpen) && (
                          <span className="ml-auto">
                            {expandedCategories[category.category] ? (
                              <ChevronDown className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-light-text-secondary dark:text-dark-text-secondary" />
                            )}
                          </span>
                        )}
                      </div>
                      {/* Items with staggered animation */}
                      {category.items?.length > 0 && expandedCategories[category.category] && (isHovered || isSidebarOpen) && (
                        <motion.div className={`space-y-1 pl-4`} variants={containerVariants}>
                          {category.items.map((item, itemIdx) => (
                            <motion.div key={item.fullPath} variants={itemVariants}>
                              {item.isExternal ? (
                                <a
                                  href={item.fullPath}
                                  target={item.newTab ? '_blank' : '_self'}
                                  rel={item.newTab ? 'noopener noreferrer' : undefined}
                                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                                    location.pathname === item.fullPath
                                      ? 'text-light-accent dark:text-dark-accent bg-light-surface-secondary dark:bg-dark-surface-secondary shadow'
                                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover'
                                  }`}
                                  title={item.description}
                                >
                                  {React.createElement(Icons[item.icon] || Icons.FaFileAlt, {
                                    className: 'flex-shrink-0',
                                    size: 22
                                  })}
                                  <span
                                    className={`truncate text-sm ${
                                      isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
                                    } transition-opacity duration-200`}
                                  >
                                    {item.label}
                                  </span>
                                </a>
                              ) : (
                                <NavLink
                                  to={item.fullPath}
                                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 ${
                                    location.pathname === item.fullPath
                                      ? 'text-light-accent dark:text-dark-accent bg-light-surface-secondary dark:bg-dark-surface-secondary shadow'
                                      : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover'
                                  }`}
                                  title={item.description}
                                >
                                  {React.createElement(Icons[item.icon] || Icons.FaFileAlt, {
                                    className: 'flex-shrink-0',
                                    size: 22
                                  })}
                                  <span
                                    className={`truncate text-sm ${
                                      isHovered || isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'
                                    } transition-opacity duration-200`}
                                  >
                                    {item.label}
                                  </span>
                                </NavLink>
                              )}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                    {/* Divider between categories except last */}
                    {catIdx < pagesConfig.length - 1 && (
                      <div className="border-t border-light-border dark:border-dark-border my-2 mx-2 opacity-60" />
                    )}
                  </motion.div>
                ))
              ) : (
                <p
                  className={`text-light-text-secondary dark:text-dark-text-secondary px-3 py-1 text-sm
                    ${isHovered ? 'opacity-100' : 'opacity-0 w-0'}
                    transition-opacity duration-200`}
                >
                  {t('sidebar.no_routes')}
                </p>
              )}
            </motion.nav>
            <ActionButtons appState={appState} isSidebarHovered={isHovered} isSidebarOpen={isSidebarOpen} />
          </motion.div>
        )}
      </motion.aside>

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Overlay animado */}
            <motion.div
              key="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed top-16 left-0 right-0 bottom-0 z-50 lg:hidden bg-black/60"
              onClick={toggleSidebar}
              aria-label="Close sidebar"
            />
            {/* Sidebar móvil animado */}
            <motion.div
              key="sidebar-mobile"
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="fixed top-16 left-0 bottom-16 w-64 bg-light-surface dark:bg-dark-surface z-[80] rounded-r-lg shadow-lg flex flex-col"
              style={{ overflow: 'hidden' }}
            >
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="p-4 space-y-4 h-full overflow-y-auto flex flex-col"
              >
                <nav className="space-y-4">{renderMenu()}</nav>
                <ActionButtons appState={appState} isSidebarHovered={false} isSidebarOpen={true} />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default Sidebar;