import { useState, useEffect, useRef } from 'react';
import { fetchColorLevels } from '../utils/clubNonnaData.jsx';
import { ethers, formatUnits } from 'ethers';

const DEFAULT_COLORS = {
  'dark-background': '#0A0A0A',
  'dark-surface': '#1A1A1A',
  'dark-surface-secondary': '#2A2A2A',
  'dark-surface-tertiary': '#232323',
  'dark-text-primary': '#FFFFFF',
  'dark-text-secondary': '#B0B0B0',
  'dark-accent': '#009246',
  'dark-accent-hover': '#007A3D',
  'dark-error': '#CE2B37',
  'dark-error-hover': '#A8232D',
  'dark-success': '#1DE9B6',
  'dark-border': '#333333',
  'dark-social-twitter': '#009246',
  'dark-social-discord': '#7289DA',
  'dark-social-github': '#FFFFFF',
  'dark-glow': 'rgba(0, 146, 70, 0.3)',
  'light-background': '#F5F5F5',
  'light-surface': '#FFFFFF',
  'light-surface-secondary': '#E5E7EB',
  'light-surface-tertiary': '#D1D5DB',
  'light-text-primary': '#111827',
  'light-text-secondary': '#6B7280',
  'light-accent': '#009246',
  'light-accent-hover': '#007A3D',
  'light-error': '#CE2B37',
  'light-error-hover': '#A8232D',
  'light-success': '#1DE9B6',
  'light-border': '#D1D5DB',
  'light-social-twitter': '#009246',
  'light-social-discord': '#7289DA',
  'light-social-github': '#111827',
  'light-glow': 'rgba(0, 146, 70, 0.3)',
  'matrix-green': '#009246',
  'vanellix-purple': '#CE2B37',
  'vanellix-cyan': '#FFFFFF',
};

const useAppData = ({ account, changeLanguage, provider }) => {
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [userLevel, setUserLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastAccountRef = useRef(null);

  useEffect(() => {
    if (account !== lastAccountRef.current) {
      lastAccountRef.current = account;

      const fetchData = async () => {
        try {
          const levelsResponse = await fetchColorLevels();

          const levels = levelsResponse.sort((a, b) => b.level - a.level);

          let userColors = { ...DEFAULT_COLORS };
          let selectedLevel = 0;

          if (account && provider) {
            const maxLevel = await determineUserLevel(account, levels, provider);
            selectedLevel = maxLevel.level;
            userColors = {
              ...DEFAULT_COLORS,
              ...maxLevel.colors.dark,
              ...maxLevel.colors.light,
              'matrix-green': maxLevel.colors.dark['dark-matrix-green'] || maxLevel.colors.light['light-matrix-green'] || DEFAULT_COLORS['matrix-green'],
              'vanellix-purple': maxLevel.colors.dark['dark-vanellix-purple'] || maxLevel.colors.light['light-vanellix-purple'] || DEFAULT_COLORS['vanellix-purple'],
              'vanellix-cyan': maxLevel.colors.dark['dark-vanellix-cyan'] || maxLevel.colors.light['light-vanellix-cyan'] || DEFAULT_COLORS['vanellix-cyan'],
            };
          } else {
            const defaultLevel = levels.find((lvl) => lvl.level === 0) || { colors: { dark: {}, light: {} } };
            userColors = {
              ...DEFAULT_COLORS,
              ...defaultLevel.colors.dark,
              ...defaultLevel.colors.light,
              'matrix-green': defaultLevel.colors.dark['dark-matrix-green'] || defaultLevel.colors.light['light-matrix-green'] || DEFAULT_COLORS['matrix-green'],
              'vanellix-purple': defaultLevel.colors.dark['dark-vanellix-purple'] || defaultLevel.colors.light['light-vanellix-purple'] || DEFAULT_COLORS['vanellix-purple'],
              'vanellix-cyan': defaultLevel.colors.dark['dark-vanellix-cyan'] || defaultLevel.colors.light['light-vanellix-cyan'] || DEFAULT_COLORS['vanellix-cyan'],
            };
          }

          setColors(userColors);
          setUserLevel(selectedLevel);
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching data:', error);
          setError('Failed to load levels');
          setColors(DEFAULT_COLORS);
          setUserLevel(0);
          setIsLoading(false);
        }
      };

      fetchData();
    }
  }, [account, provider, changeLanguage]);

  const determineUserLevel = async (account, levels, provider) => {
    const ERC20_ABI = [
      {
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
      },
    ];

    let maxLevel = levels.find((lvl) => lvl.level === 0) || { level: 0, colors: { dark: {}, light: {} } };

    for (const level of levels) {
      try {
        const contract = new ethers.Contract(level.tokenAddress, ERC20_ABI, provider);
        const balance = await contract.balanceOf(account);
        const balanceInTokens = Number(formatUnits(balance, 18));

        if (balanceInTokens >= level.minTokens) {
          maxLevel = level;
          break;
        }
      } catch (error) {
        console.error(`Error checking balance for token ${level.tokenAddress}:`, error);
      }
    }

    return maxLevel;
  };

  return {
    colors,
    userLevel,
    isLoading,
    error,
    changeLanguage,
  };
};

export default useAppData;