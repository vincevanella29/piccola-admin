import { useState, useEffect, useRef } from 'react';

const useMenuSearch = (allLocationMenus) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [displayedMenus, setDisplayedMenus] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);
  const filteredMenusRef = useRef([]);
  const ITEMS_PER_PAGE = 10;

  const filteredMenus = allLocationMenus.filter((menu) =>
    (menu.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (menu.descripcion || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (
      filteredMenusRef.current.length === filteredMenus.length &&
      filteredMenusRef.current.every((item, index) => item._id === filteredMenus[index]?._id)
    ) {
      return;
    }
    filteredMenusRef.current = filteredMenus;
    setDisplayedMenus(filteredMenus.slice(0, ITEMS_PER_PAGE));
    setPage(1);
    setHasMore(filteredMenus.length > ITEMS_PER_PAGE);
  }, [filteredMenus]);

  useEffect(() => {
    if (!isSearchModalOpen || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => {
            const nextPage = prev + 1;
            const newItems = filteredMenus.slice(0, nextPage * ITEMS_PER_PAGE);
            setDisplayedMenus(newItems);
            setHasMore(newItems.length < filteredMenus.length);
            return nextPage;
          });
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [isSearchModalOpen, hasMore, filteredMenus.length]);

  return {
    searchQuery,
    setSearchQuery,
    isSearchModalOpen,
    setIsSearchModalOpen,
    displayedMenus,
    hasMore,
    loaderRef,
  };
};

export default useMenuSearch;