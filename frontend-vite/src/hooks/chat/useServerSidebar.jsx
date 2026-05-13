import { useMemo } from 'react';

export default function useServerSidebar({ channels }) {
  const sectionMap = useMemo(() => {
    const map = {};
    channels.forEach(ch => {
      const sec = (ch.section_filter || 'general').toLowerCase();
      if (!map[sec]) map[sec] = [];
      map[sec].push(ch);
    });
    return map;
  }, [channels]);

  const sectionOrder = ['general', 'cocina', 'sala', 'delivery'];
  const sortedSections = useMemo(() => {
    const keys = Object.keys(sectionMap);
    const ordered = sectionOrder.filter(s => keys.includes(s));
    const rest = keys.filter(s => !sectionOrder.includes(s)).sort();
    return [...ordered, ...rest];
  }, [sectionMap]);

  return { sectionMap, sortedSections };
}
