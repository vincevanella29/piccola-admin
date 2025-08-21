import { useTranslation } from 'react-i18next';

export const getDefaultMetadata = (metadata, t) => {
  return {
    title: t(metadata.label) || 'Club della Nonna - La Piccola Italia Web3',
    description: t(metadata.description) || 'Join La Piccola Italia\'s Club della Nonna, a Web3 experience where you earn Nonna tokens with every order, participate in our DAO, and enjoy discounts, VIP events, and the metaverse.',
    keywords: [
      'La Piccola Italia',
      'Club della Nonna',
      'Web3',
      t(metadata.category) || 'restaurant',
      'Italian cuisine',
      'Nonna tokens',
      'DAO',
    ].filter(Boolean).join(', '),
    og_title: t(metadata.label) || 'Club della Nonna - La Piccola Italia Web3',
    og_description: t(metadata.description) || 'Earn Nonna tokens with every order at La Piccola Italia! Join Club della Nonna, participate in our DAO, redeem discounts, and experience the metaverse.',
    twitter_title: t(metadata.label) || 'Club della Nonna - La Piccola Italia Web3',
    twitter_description: t(metadata.description) || 'La Piccola Italia embraces Web3! Earn Nonna tokens, join the DAO, and enjoy discounts and VIP events.',
    canonical: `https://club.lapiccolaitalia.cl${metadata.path}`,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: t(metadata.label) || 'Club della Nonna',
      description: t(metadata.description) || 'Explore La Piccola Italia\'s Web3 platform.',
      url: `https://club.lapiccolaitalia.cl${metadata.path}`,
      publisher: {
        '@type': 'Organization',
        name: 'La Piccola Italia',
        url: 'https://club.lapiccolaitalia.cl',
        logo: {
          '@type': 'ImageObject',
          url: '/favicon-piccola.png',
        },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://club.lapiccolaitalia.cl',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: t(metadata.label),
            item: `https://club.lapiccolaitalia.cl${metadata.path}`,
          },
        ],
      },
    },
  };
};

export const getProductSchema = (products, currency = 'CLP') => {
  return products.map((product) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.nombre || 'Unnamed Product',
    description: product.descripcion || 'No description available',
    image: product.media_url || (product.media_id ? product.media_url : '/favicon-piccola.png'),
    sku: product._id,
    offers: {
      '@type': 'Offer',
      priceCurrency: currency,
      price: product.precio || 0,
      availability: product.estado ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `https://club.lapiccolaitalia.cl/app/menus/${product._id}`,
      seller: {
        '@type': 'Organization',
        name: 'La Piccola Italia',
      },
    },
  }));
};