// Privy configuration for Vanellix HUB
// Docs: https://docs.privy.io/basics/react/advanced/automatic-wallet-creation#automatic-wallet-creation

const privyConfig = (chainId, rpcUrl, privyAppId) => {
  return {
    appId: privyAppId,
    loginMethods: ['google', 'twitter', 'email', 'wallet'],
    appearance: {
      theme: 'dark',
      accentColor: '#676FFF',
      logo: 'https://vanellix.com/wp-content/uploads/2022/11/logo-vanellix.png',
    },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
      rpcUrl: rpcUrl,
      chainId: chainId,
    }
  },
  showWalletUIs: true,
};
};

export default privyConfig;