import { createConfig, http } from 'wagmi';

const customChain = (chainId, rpcUrl, blockExplorer) => ({
  id: chainId,
  name: 'Polygon Amoy',
  network: 'polygon-amoy',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Polygonscan', url: blockExplorer },
  },
});

export default function getWagmiConfig(chainId, rpcUrl, blockExplorer) {
  return createConfig({
    chains: [customChain(chainId, rpcUrl, blockExplorer)],
    transports: {
      [chainId]: http(rpcUrl),
    },
  });
}