// src/pages/community/components/UserModal.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCopy, FaExternalLinkAlt, FaTimes, FaTwitter, FaDiscord, FaInstagram, FaBirthdayCake, FaHeart, FaMapMarkerAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';

const UserModal = ({ user, onClose, t, appState, mediaMap, allProducts, locations }) => {
  const { t: translate } = useTranslation();
  const displayName = user.profile?.name && user.profile.public_name ? user.profile.name : 'Anonymous';
  const image = user.profile?.profile_image_url;
  const bio = user.profile?.bio;
  const twitter = user.profile?.twitter;
  const discord = user.profile?.discord;
  const instagram = user.profile?.instagram;
  const birthdate = user.profile?.public_birthdate ? user.profile?.birthdate : null;
  const likedProducts = user.profile?.liked_products || {};
  const favoriteLocation = user.profile?.favorite_location;
  const [openSections, setOpenSections] = useState({ balances: false, burns: false, liked: false });
  const [copied, setCopied] = useState(false);
  const [tokenSymbols, setTokenSymbols] = useState({});
  const [showLocationModal, setShowLocationModal] = useState(false);

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(user.wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const explorerUrl = `${appState.blockExplorer}/address/${user.wallet}`;

  useEffect(() => {
    const fetchSymbols = async () => {
      const uniqueTokens = new Set([...Object.keys(user.balances), ...Object.keys(user.burns)]);
      const erc20Abi = ["function symbol() view returns (string)"];
      const symbols = {};

      const promises = Array.from(uniqueTokens).map(async (token) => {
        if (token.toLowerCase() === '0x0000000000000000000000000000000000001010') {
          symbols[token] = 'MATIC';
          return;
        }
        if (token.toLowerCase() === '0x655d966ebc02ff37bf19c8c0a15f30e108c87960') {
          symbols[token] = 'USDC';
          return;
        }
        try {
          const contract = new ethers.Contract(token, erc20Abi, appState.provider);
          const sym = await contract.symbol();
          symbols[token] = sym;
        } catch (err) {
          symbols[token] = 'UNKNOWN';
        }
      });

      await Promise.all(promises);
      setTokenSymbols(symbols);
    };

    fetchSymbols();
  }, [user, appState.provider]);

  const getTokenSymbol = (token, data) => {
    if (tokenSymbols[token]) return tokenSymbols[token];
    return data.type.toUpperCase();
  };

  const likedItems = Object.entries(likedProducts)
    .filter(([_, liked]) => liked)
    .map(([id]) => allProducts.find(p => String(p._id) === id || String(p.id) === id))
    .filter(Boolean);

    const favoriteLocationData = locations.find(l => l._id === favoriteLocation);

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-gradient-to-b from-light-surface to-light-background dark:from-dark-surface dark:to-dark-background rounded-2xl shadow-[0_0_20px_rgba(0,255,0,0.2)] max-w-md w-full m-4 max-h-[80vh] overflow-hidden relative border border-matrix-green/30 flex flex-col"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 50 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-light-surface to-light-background/95 dark:from-dark-surface dark:to-dark-background/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-matrix-green/20 shadow-sm">
          <h2 className="text-2xl font-bold text-matrix-green font-futurist">{displayName}</h2>
          <button onClick={onClose} className="text-matrix-green hover:text-matrix-green-light transition-transform hover:scale-110">
            <FaTimes size={24} />
          </button>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col items-center gap-4 mb-6">
            <motion.div 
              className="w-24 h-24 rounded-full overflow-hidden border-4 border-matrix-green shadow-[0_0_15px_rgba(0,255,0,0.3)]"
              initial={{ rotate: -10, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {image ? (
                <img src={image} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-matrix-green/20 flex items-center justify-center text-matrix-green text-4xl">
                  ?
                </div>
              )}
            </motion.div>
            <motion.div 
              className="flex items-center gap-3 bg-matrix-green/10 px-4 py-2 rounded-full"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="truncate max-w-[180px] text-sm">{user.wallet}</span>
              <button onClick={copyWallet} className="text-matrix-green hover:text-matrix-green-light transition hover:scale-110" title={t('copy')}>
                <FaCopy size={16} />
              </button>
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-matrix-green hover:text-matrix-green-light transition hover:scale-110" title={t('view_on_explorer')}>
                <FaExternalLinkAlt size={16} />
              </a>
              <AnimatePresence>
                {copied && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="text-xs text-matrix-green bg-matrix-green/20 px-2 py-1 rounded"
                  >
                    Copied!
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
            <motion.p 
              className="text-sm bg-matrix-green/10 px-4 py-2 rounded-full"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {t('community_rank.completion')}: <span className="font-bold">{user.completion_percentage.toFixed(2)}%</span>
            </motion.p>
          </div>

          {/* Bio */}
          {bio && (
            <motion.div 
              className="mb-6 text-center bg-matrix-green/5 p-4 rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-sm italic text-gray-300">{bio}</p>
            </motion.div>
          )}

          {/* Social Links, Birthdate */}
          <motion.div 
            className="flex justify-center gap-6 mb-6 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {twitter && (
              <a href={twitter} target="_blank" rel="noopener noreferrer" className="text-matrix-green hover:text-matrix-green-light transition hover:scale-110 bg-matrix-green/10 p-2 rounded-full">
                <FaTwitter size={20} />
              </a>
            )}
            {discord && (
              <a href={discord} target="_blank" rel="noopener noreferrer" className="text-matrix-green hover:text-matrix-green-light transition hover:scale-110 bg-matrix-green/10 p-2 rounded-full">
                <FaDiscord size={20} />
              </a>
            )}
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-matrix-green hover:text-matrix-green-light transition hover:scale-110 bg-matrix-green/10 p-2 rounded-full">
                <FaInstagram size={20} />
              </a>
            )}
            {birthdate && (
              <div className="flex items-center gap-2 text-matrix-green bg-matrix-green/10 p-2 rounded-full">
                <FaBirthdayCake size={20} />
                <span className="text-sm">{birthdate}</span>
              </div>
            )}
          </motion.div>

          {/* Favorite Location */}
          {favoriteLocationData && (
            <div className="mb-4">
              <button
                className="w-full flex justify-between items-center py-2 px-3 text-matrix-green font-medium hover:bg-matrix-green/5 transition text-sm"
                onClick={() => setShowLocationModal(true)}
              >
                {translate('community_rank.favorite_location')}
                <FaChevronDown size={16} className="text-matrix-green" />
              </button>
            </div>
          )}

          {/* Liked Products Section */}
          {likedItems.length > 0 && (
            <div className="mb-4">
              <button
                className="w-full flex justify-between items-center py-2 px-3 text-matrix-green font-medium hover:bg-matrix-green/5 transition text-sm"
                onClick={() => toggleSection('liked')}
              >
                {t('community_rank.liked_products')} ({likedItems.length})
                <motion.div animate={{ rotate: openSections.liked ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <FaChevronDown size={16} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openSections.liked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3"
                  >
                    {likedItems.map((product, index) => {
                      const imgUrl = product.media_url || (product.media_id && mediaMap[String(product.media_id)]) || '/fallback-image.png';
                      return (
                        <motion.div 
                          key={product._id || product.id} 
                          className="relative group"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <img src={imgUrl} alt={product.nombre || product.name} className="w-full h-24 object-cover rounded" onError={(e) => e.target.src = '/fallback-token.png'} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs p-2 text-center">
                            {product.nombre || product.name}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="space-y-2">
            {/* Balances Section */}
            <div>
              <button
                className="w-full flex justify-between items-center py-2 px-3 text-matrix-green font-medium hover:bg-matrix-green/5 transition text-sm"
                onClick={() => toggleSection('balances')}
              >
                {t('community_rank.balances')}
                <motion.div animate={{ rotate: openSections.balances ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <FaChevronDown size={16} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openSections.balances && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1 p-2 text-sm"
                  >
                    {Object.entries(user.balances).map(([token, data], index) => (
                      <motion.div 
                        key={token} 
                        className="flex items-center gap-2"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <img src={data.imagePath} alt={getTokenSymbol(token, data)} className="w-5 h-5 rounded-full object-cover" onError={(e) => e.target.src = '/fallback-token.png'} />
                        <span className="flex-1">{getTokenSymbol(token, data)}</span>
                        <span>{Number(data.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Burns Section */}
            <div>
              <button
                className="w-full flex justify-between items-center py-2 px-3 text-matrix-green font-medium hover:bg-matrix-green/5 transition text-sm"
                onClick={() => toggleSection('burns')}
              >
                {t('community_rank.burns')}
                <motion.div animate={{ rotate: openSections.burns ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <FaChevronDown size={16} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openSections.burns && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1 p-2 text-sm"
                  >
                    {Object.entries(user.burns).map(([token, data], index) => (
                      <motion.div 
                        key={token} 
                        className="flex items-center gap-2"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <img src={data.imagePath} alt={getTokenSymbol(token, data)} className="w-5 h-5 rounded-full object-cover" onError={(e) => e.target.src = '/fallback-token.png'} />
                        <span className="flex-1">{getTokenSymbol(token, data)}</span>
                        <span>{Number(data.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 italic px-4">
            {t('community_rank.decentralized_info')}
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showLocationModal && favoriteLocationData && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowLocationModal(false)}
          >
            <motion.div
              className="bg-light-surface dark:bg-dark-surface rounded-xl p-4 max-w-sm w-full shadow-neon"
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-lg font-medium text-matrix-green">{translate('community_rank.favorite_location_details')}</h4>
                <button onClick={() => setShowLocationModal(false)} className="text-matrix-green">
                  <FaTimes size={16} />
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <p><strong>{translate('common.name')}:</strong> {favoriteLocationData.nombre}</p>
                <p><strong>{translate('common.address')}:</strong> {favoriteLocationData.direccion}</p>
                <p><strong>{translate('common.city')}:</strong> {favoriteLocationData.city}</p>
                <p><strong>{translate('common.telephone')}:</strong> {favoriteLocationData.telephone}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UserModal;