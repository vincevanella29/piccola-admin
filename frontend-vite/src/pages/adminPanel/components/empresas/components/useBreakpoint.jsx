import { useEffect, useState } from 'react';

export default function useBreakpoint(query = '(max-width: 767px)') {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatch(e.matches);
    mq.addEventListener?.('change', handler);
    // Safari fallback
    mq.addListener?.(handler);
    return () => {
      mq.removeEventListener?.('change', handler);
      mq.removeListener?.(handler);
    };
  }, [query]);
  return match;
}
