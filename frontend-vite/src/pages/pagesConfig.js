import categoryOrder from './categoryOrder.json';
import navigationLinks from './navigationLinks.json';
import { getDefaultMetadata, getProductSchema } from './metadataUtils';

const pageModules = import.meta.glob('../pages/**/*.jsx', { eager: true });

const pagesMetadata = [];
const seenPaths = new Set();
const categoryIcons = {};

function getCategoryIcon(category) {
  return categoryOrder?.[category]?.icon || null;
}

navigationLinks.forEach((link) => {
  const requiredFields = ['path', 'label', 'category', 'minRoleLevel', 'order', 'locations', 'description', 'icon'];
  const missingFields = requiredFields.filter((field) => !link.hasOwnProperty(field));
  if (missingFields.length > 0) {
    console.warn(`Navigation link missing fields: ${missingFields.join(', ')} for path ${link.path}`);
    return;
  }

  const normalizedPath = link.path.replace(/:[^/]+/g, ':param');
  if (seenPaths.has(normalizedPath)) {
    console.warn(`Duplicate normalized path detected: ${normalizedPath}`);
    return;
  }
  seenPaths.add(normalizedPath);

  if (link.maxRoleLevel !== undefined && link.maxRoleLevel < link.minRoleLevel) {
    console.warn(`Invalid role range for path ${link.path}: maxRoleLevel < minRoleLevel`);
  }

  if (!categoryIcons[link.category]) {
    categoryIcons[link.category] = new Set();
  }
  if (categoryIcons[link.category].has(link.icon)) {
    console.warn(`Duplicate icon ${link.icon} in category ${link.category}`);
  }
  categoryIcons[link.category].add(link.icon);

  pagesMetadata.push({
    ...link,
    fullPath: link.path,
    isExternal: !!link.external,
    newTab: link.newTab !== undefined ? link.newTab : !!link.external,
  });
});

Object.keys(pageModules).forEach((fileName) => {
  if (fileName.includes('pagesConfig.js')) return;

  const module = pageModules[fileName];
  const metadata = module.pageMetadata;

  if (metadata) {
    const processMetadata = (meta) => {
      const requiredFields = ['path', 'label', 'category', 'minRoleLevel', 'order', 'locations', 'description', 'icon'];
      const missingFields = requiredFields.filter((field) => !meta.hasOwnProperty(field));
      if (missingFields.length > 0) {
        console.warn(`Metadata missing fields: ${missingFields.join(', ')} for path ${meta.path}`);
        return;
      }

      const normalizedPath = meta.path.replace(/:[^/]+/g, ':param');
      if (seenPaths.has(normalizedPath)) {
        console.warn(`Duplicate normalized path detected: ${normalizedPath}`);
        return;
      }
      seenPaths.add(normalizedPath);

      if (meta.maxRoleLevel !== undefined && meta.maxRoleLevel < meta.minRoleLevel) {
        console.warn(`Invalid role range for path ${meta.path}: maxRoleLevel < minRoleLevel`);
      }

      if (!categoryIcons[meta.category]) {
        categoryIcons[meta.category] = new Set();
      }
      if (categoryIcons[meta.category].has(meta.icon)) {
        console.warn(`Duplicate icon ${meta.icon} in category ${meta.category}`);
      }
      categoryIcons[meta.category].add(meta.icon);

      pagesMetadata.push({
        ...meta,
        fullPath: meta.path,
        isExternal: !!meta.external,
        newTab: meta.newTab !== undefined ? meta.newTab : !!meta.external,
      });
    };

    if (Array.isArray(metadata)) {
      metadata.forEach((meta) => processMetadata(meta));
    } else {
      processMetadata(metadata);
    }
  }
});

const mainPages = pagesMetadata.filter((page) => page.isMainPage === true);

const currentCategories = new Set(
  pagesMetadata
    .filter((page) => page.locations.includes('sidebar'))
    .map((page) => page.category || 'General')
);

let effectiveCategoryOrder = categoryOrder;
if (Object.keys(categoryOrder).length === 0) {
  effectiveCategoryOrder = Array.from(currentCategories)
    .sort()
    .reduce((acc, category, index) => {
      acc[category] = index + 1;
      return acc;
    }, {});
}

const canAccessPage = (page, roleLevel) => {
  if (page.minRoleLevel === -1) return true;
  if (roleLevel === -1) return false;
  const meetsMinLevel = roleLevel >= page.minRoleLevel;
  const meetsMaxLevel = page.maxRoleLevel === undefined || roleLevel <= page.maxRoleLevel;
  return meetsMinLevel && meetsMaxLevel;
};

const getSidebarConfig = (roleLevel, t) => {
  const filteredPages = pagesMetadata.filter((page) => {
    if (!page.locations.includes('sidebar')) return false;
    return canAccessPage(page, roleLevel);
  });

  const categoriesMap = filteredPages.reduce((acc, page) => {
    const categoryKey = page.category || 'General';
    const categoryOrderData = categoryOrder[categoryKey] || {};
    const categoryLabel = t(page.category);
    if (!acc[categoryKey]) {
      acc[categoryKey] = {
        category: categoryKey,
        categoryLabel,
        categoryOrder: categoryOrderData.order !== undefined ? categoryOrderData.order : Infinity,
        icon: categoryOrderData.icon || 'FaFolder',
        items: [],
      };
    }
    acc[categoryKey].items.push({
      fullPath: page.fullPath,
      isExternal: page.isExternal,
      newTab: page.newTab,
      label: t(page.label),
      icon: page.icon,
      description: t(page.description),
      order: page.order,
      isSearchable: page.isSearchable,
    });
    return acc;
  }, {});

  return Object.values(categoriesMap)
    .map((category) => ({
      ...category,
      items: category.items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.categoryOrder - b.categoryOrder || a.category.localeCompare(b.category));
};

const getFooterConfig = (roleLevel, t) => {
  const filteredPages = pagesMetadata.filter((page) => {
    if (!page.locations.includes('footer')) return false;
    return canAccessPage(page, roleLevel);
  });

  const footerConfig = filteredPages.reduce((acc, page) => {
    const category = page.category || 'General';
    if (!acc[category]) {
      acc[category] = {
        category,
        categoryOrder: effectiveCategoryOrder[category] || Infinity,
        items: [],
      };
    }
    acc[category].items.push({
      fullPath: page.fullPath,
      isExternal: page.isExternal,
      newTab: page.newTab,
      label: t(page.label),
      icon: page.icon,
      description: t(page.description),
      order: page.orderFooter !== undefined ? page.orderFooter : page.order,
      isSearchable: page.isSearchable,
    });
    return acc;
  }, {});

  return Object.values(footerConfig)
    .map((category) => ({
      ...category,
      items: category.items.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.categoryOrder - b.categoryOrder || a.category.localeCompare(b.category));
};

const getHeaderConfig = (roleLevel, t) => {
  const filteredPages = pagesMetadata.filter((page) => {
    if (!page.locations.includes('header')) return false;
    return canAccessPage(page, roleLevel);
  });

  return filteredPages
    .map((page) => ({
      fullPath: page.fullPath,
      isExternal: page.isExternal,
      newTab: page.newTab,
      label: t(page.label),
      icon: page.icon,
      description: t(page.description),
      order: page.orderHeader !== undefined ? page.orderHeader : page.order,
      isSearchable: page.isSearchable,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
};

const getWalletMenuConfig = (roleLevel, t) => {
  const filteredPages = pagesMetadata.filter((page) => {
    if (!page.locations.includes('walletMenu')) return false;
    return canAccessPage(page, roleLevel);
  });

  return filteredPages
    .map((page) => ({
      fullPath: page.fullPath,
      isExternal: page.isExternal,
      newTab: page.newTab,
      label: t(page.label),
      icon: page.icon,
      description: t(page.description),
      order: page.orderWalletMenu !== undefined ? page.orderWalletMenu : page.order,
      isSearchable: page.isSearchable,
      action: page.action,
      external: page.external,
    }))
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.label.localeCompare(b.label);
    });
};

const getSearchConfig = (roleLevel, t) => {
  const filteredPages = pagesMetadata.filter((page) => {
    if (!page.isSearchable) return false;
    return canAccessPage(page, roleLevel);
  });

  return filteredPages
    .map((page) => ({
      fullPath: page.fullPath,
      isExternal: page.isExternal,
      newTab: page.newTab,
      label: t(page.label),
      description: t(page.description),
      icon: page.icon,
      category: page.category,
      categoryIcon: getCategoryIcon(page.category),
      order: page.order,
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
};

// Función para metadatos dinámicos
const getDynamicMetadata = (path, appState, t) => {
  const matchParams = (pagePath, path) => {
    const regex = new RegExp(`^${pagePath.replace(/:[^/]+/g, '([^/]+)').replace(/\?/g, '')}$`);
    const match = path.match(regex);
    if (match) {
      const paramNames = pagePath.match(/:([^/]+)/g)?.map((p) => p.slice(1)) || [];
      return paramNames.reduce((acc, name, i) => {
        acc[name.replace('?', '')] = match[i + 1];
        return acc;
      }, {});
    }
    return null;
  };

  const metadata = pagesMetadata.find((page) => {
    if (page.path.includes(':')) {
      return matchParams(page.path, path);
    }
    return path === page.path;
  });

  if (!metadata) return getDefaultMetadata({ path: '/', label: 'app.name', description: 'app.description' }, t);

  const params = metadata.path.includes(':') ? matchParams(metadata.path, path) : {};
  const defaultMetadata = getDefaultMetadata(metadata, t);

  // Lógica específica para la página de Menus
  if (metadata.path.startsWith('/app/menus')) {
    const { selectedLocation, selectedCategory, data } = appState || {};
    const { menus = [], mediaMap = {}, selectedProduct } = data || {};

    // Obtener location, category y product desde params o estado
    const locationFromParams = params.locationId
      ? data?.locations?.find((l) => String(l._id) === params.locationId)
      : selectedLocation;
    const categoryFromParams = params.categoryId
      ? data?.categories?.find((c) => String(c.id) === params.categoryId)
      : selectedCategory;
    const productFromParams = selectedProduct || (params.productId
      ? menus.find((m) => String(m._id) === params.productId) || data?.allLocationMenus?.find((m) => String(m._id) === params.productId)
      : null);

    let pageTitle = t('menus.label');
    let pageDescription = t('menus.description');

    if (productFromParams) {
      pageTitle = `${productFromParams.nombre} - ${locationFromParams?.nombre || t('club.selectLocation')}`;
      pageDescription = productFromParams.descripcion
        ? truncateDescription(productFromParams.descripcion, 160)
        : t('menus.product_description', { product: productFromParams.nombre });
    } else if (categoryFromParams && locationFromParams) {
      pageTitle = t('menus.category_description', {
        category: categoryFromParams.nombre || t('club.noCategories'),
        location: locationFromParams.nombre || t('club.selectLocation'),
      });
      pageDescription = pageTitle;
    } else if (locationFromParams) {
      pageTitle = t('menus.location_description', {
        location: locationFromParams.nombre || t('club.selectLocation'),
      });
      pageDescription = pageTitle;
    }

    const keywords = [
      'La Piccola Italia',
      'Club della Nonna',
      'Web3',
      'menus',
      locationFromParams?.nombre || 'restaurant',
      categoryFromParams?.nombre || 'food',
      productFromParams?.nombre || 'Italian cuisine',
      'Nonna tokens',
      'DAO',
      ...menus.map((menu) => menu.nombre).filter(Boolean),
    ].filter(Boolean).join(', ');

    const canonicalUrl = `https://club.lapiccolaitalia.cl/app/menus${locationFromParams ? `/${locationFromParams._id}` : ''}${categoryFromParams ? `/${categoryFromParams.id}` : ''}${productFromParams ? `/${productFromParams._id}` : ''}`;

    const productSchemas = productFromParams
      ? [getProductSchema([productFromParams])[0]]
      : getProductSchema(menus);

    return {
      ...defaultMetadata,
      title: pageTitle,
      description: pageDescription,
      keywords,
      og_title: pageTitle,
      og_description: pageDescription,
      twitter_title: pageTitle,
      twitter_description: pageDescription,
      canonical: canonicalUrl,
      schema: {
        '@context': 'https://schema.org',
        '@type': productFromParams ? 'Product' : 'WebPage',
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        ...(productFromParams && {
          image: productFromParams.media_url || mediaMap[productFromParams.media_id] || '/favicon-piccola.png',
          offers: {
            '@type': 'Offer',
            price: getCurrentPrice(productFromParams, 'dinein', appState.chileTime, t).price,
            priceCurrency: productFromParams.currency || 'CLP',
            availability: productFromParams.estado ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
        }),
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
              name: t('menus.label'),
              item: 'https://club.lapiccolaitalia.cl/app/menus',
            },
            locationFromParams && {
              '@type': 'ListItem',
              position: 3,
              name: locationFromParams.nombre,
              item: `https://club.lapiccolaitalia.cl/app/menus/${locationFromParams._id}`,
            },
            categoryFromParams && {
              '@type': 'ListItem',
              position: 4,
              name: categoryFromParams.nombre,
              item: `https://club.lapiccolaitalia.cl/app/menus/${locationFromParams?._id}/${categoryFromParams.id}`,
            },
            productFromParams && {
              '@type': 'ListItem',
              position: 5,
              name: productFromParams.nombre,
              item: canonicalUrl,
            },
          ].filter(Boolean),
        },
      },
      productSchemas,
    };
  }

  // Lógica para otras rutas dinámicas
  if (metadata.path.includes(':companyId') || metadata.path.includes(':year')) {
    const params = path.match(new RegExp(metadata.path.replace(/:[^/]+/g, '([^/]+)')));
    const companyId = params?.[1];
    const year = params?.[2];

    const pageTitle = companyId && year
      ? t('staking.title', { companyId, year })
      : companyId
      ? t(metadata.label, { companyId })
      : t(metadata.label);

    const pageDescription = companyId && year
      ? t('staking.description', { companyId, year })
      : companyId
      ? t(metadata.description, { companyId })
      : t(metadata.description);

    const keywords = [
      'La Piccola Italia',
      'Club della Nonna',
      'Web3',
      companyId || t(metadata.category),
      year || 'staking',
      'Nonna tokens',
      'DAO',
    ].filter(Boolean).join(', ');

    const canonicalUrl = `https://club.lapiccolaitalia.cl${path}`;

    return {
      ...defaultMetadata,
      title: pageTitle,
      description: pageDescription,
      keywords,
      og_title: pageTitle,
      og_description: pageDescription,
      twitter_title: pageTitle,
      twitter_description: pageDescription,
      canonical: canonicalUrl,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
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
            companyId && {
              '@type': 'ListItem',
              position: 3,
              name: companyId,
              item: `https://club.lapiccolaitalia.cl${metadata.path.replace(':companyId', companyId)}`,
            },
            year && {
              '@type': 'ListItem',
              position: 4,
              name: year,
              item: canonicalUrl,
            },
          ].filter(Boolean),
        },
      },
    };
  }

  if (metadata.path === '/app/club') {
    return {
      ...defaultMetadata,
      title: t('club.title'),
      description: t('club.description'),
      keywords: ['La Piccola Italia', 'Club della Nonna', 'Web3', 'loyalty program', 'Nonna tokens', 'DAO'].join(', '),
      og_title: t('club.title'),
      og_description: t('club.description'),
      twitter_title: t('club.title'),
      twitter_description: t('club.description'),
    };
  }

  if (metadata.path === '/app/locations') {
    return {
      ...defaultMetadata,
      title: t('club.locations'),
      description: t('club.locationsDescription'),
      keywords: ['La Piccola Italia', 'Club della Nonna', 'locations', 'restaurants', 'Italian cuisine'].join(', '),
      og_title: t('club.locations'),
      og_description: t('club.locationsDescription'),
      twitter_title: t('club.locations'),
      twitter_description: t('club.locationsDescription'),
    };
  }

  if (metadata.path === '/app/admin') {
    return {
      ...defaultMetadata,
      title: t('admin.title'),
      description: t('admin.description'),
      keywords: ['La Piccola Italia', 'admin panel', 'Web3', 'management', 'DAO'].join(', '),
      og_title: t('admin.title'),
      og_description: t('admin.description'),
      twitter_title: t('admin.title'),
      twitter_description: t('admin.description'),
    };
  }

  return defaultMetadata;
};

export { getSidebarConfig, getFooterConfig, getHeaderConfig, getWalletMenuConfig, getSearchConfig, pagesMetadata, pageModules, getCategoryIcon, getDynamicMetadata };