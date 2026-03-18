// /Users/vanellix/Vanellix HUB/vanellix-hub/frontend-vite/src/pages/hub/swap/Swap.jsx
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { fetchSwapTokenRoutes } from "../../utils/tokensData";
import SwapCard from "./components/SwapCard";
import useSwap from "../../hooks/useSwap";

const Swap = ({ appState }) => {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState([]);
  const [routes, setRoutes] = useState({});
  const swapHook = useSwap(appState);

  useEffect(() => {
    const loadTokensAndRoutes = async () => {
      try {
        const res = await fetchSwapTokenRoutes();
        // Build bidirectional routes for all tokens
        const routesMap = res.routes || {};
        // Clone to avoid mutating original
        const bidirRoutes = {};
        // First, copy all original routes
        Object.keys(routesMap).forEach(address => {
          bidirRoutes[address] = [...routesMap[address]];
        });
        // Now, for each route, add the reverse mapping to the payment token
        Object.entries(routesMap).forEach(([from, arr]) => {
          arr.forEach(route => {
            if (!route.paymentToken) return;
            if (!bidirRoutes[route.paymentToken]) bidirRoutes[route.paymentToken] = [];
            // Add the reverse route if not already present
            if (!bidirRoutes[route.paymentToken].some(r => r.paymentToken === from)) {
              bidirRoutes[route.paymentToken].push({
                paymentToken: from,
                pairAddress: route.pairAddress,
                exists: route.exists
              });
            }
          });
        });
        // Attach bidirectional routes to tokens
        const tokensWithRoutes = (res.tokens || []).map(token => ({
          ...token,
          routes: bidirRoutes[token.address] || []
        }));
        setTokens(tokensWithRoutes);
        setRoutes(bidirRoutes);
      } catch (err) {
        appState.setError(t('swap.error_fetching_platform_tokens_routes', { message: err.message }));
      }
    };
    loadTokensAndRoutes();
  }, []);

  return (
    <motion.div
      className="w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col gap-6 sm:gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <motion.div
        className="flex items-center justify-between"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-vanellix-cyan font-futurist">
          {t('swap.title')}
        </h2>
      </motion.div>
      <SwapCard appState={appState} tokens={tokens} routes={routes} useSwap={swapHook} />
    </motion.div>
  );
};

export const pageMetadata = {
  path: '/app/admin/swap',
  label: 'swap.title',
  category: 'admin.tools.category',
  minRoleLevel: -1,
  order: 2,
  orderWalletMenu: 6,
  locations: ['walletMenu', 'sidebar'],
  description: 'swap.description',
  icon: 'FaExchangeAlt',
  isMainPage: false,
  isSearchable: true,
};

export default Swap;