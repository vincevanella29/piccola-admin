// src/pages/chat/components/common/HistoryTimeline.jsx
import React, { useMemo, useState } from 'react';

// Utility: group items by year preserving order within year
const groupByYear = (items) => {
  const map = new Map();
  (items || []).forEach((it) => {
    const y = it?.year ?? '—';
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(it);
  });
  return map;
};

const Chevron = ({ open }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M6.293 7.293a1 1 0 011.414 0L10 9.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const YearHeader = ({ year, open, firstItem, count, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-light-surface/70 dark:hover:bg-dark-surface/50 transition-colors"
    aria-expanded={open}
  >
    {/* Timeline dot */}
    <div className="relative hidden md:flex w-4 items-center justify-center shrink-0">
      <div className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow ring-4 ring-pink-500/20 z-10" />
    </div>
    {/* Year label */}
    <div className="shrink-0 w-12 md:w-16 text-right pr-2 mr-1 text-light-text/80 dark:text-dark-text/80">
      <span className="text-sm font-semibold tabular-nums">{year}</span>
    </div>
    {/* Preview */}
    <div className="flex-1 min-w-0 flex items-center gap-3 text-left">
      {firstItem?.image && (
        <img
          src={firstItem.image}
          alt={firstItem.title || ''}
          className="w-12 h-12 rounded-md object-cover bg-light-surface/50 dark:bg-dark-surface/50"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-light-text dark:text-dark-text truncate">
          {firstItem?.title || 'Hitos'}
        </div>
        <div className="text-[12px] text-light-text/60 dark:text-dark-text/60">{count} {count === 1 ? 'hito' : 'hitos'}</div>
      </div>
    </div>
    <div className="text-light-text/60 dark:text-dark-text/60 ml-2">
      <Chevron open={open} />
    </div>
  </button>
);

const YearPanel = ({ items }) => (
  <div className="pl-3 md:pl-[calc(2rem+64px)] pr-2">
    <ul className="space-y-4">
      {items.map((it, idx) => (
        <li key={`${it.year}-${idx}-${it.title}`} className="rounded-md border border-light-border/50 dark:border-dark-border/40 bg-light-surface/40 dark:bg-dark-surface/40 p-3">
          <div className="flex flex-col gap-2">
            <h4 className="text-[15px] font-semibold text-light-text dark:text-dark-text">{it.title}</h4>
            {it.image && (
              <img
                src={it.image}
                alt={it.title || ''}
                className="w-full max-w-xl rounded-md object-cover aspect-video bg-light-surface/50 dark:bg-dark-surface/50"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            {it.description && (
              <p className="text-[13px] leading-5 text-light-text/80 dark:text-dark-text/80 whitespace-pre-line">{it.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const HistoryTimeline = ({ payload }) => {
  const { title, intro, items, text } = payload || {};
  const sorted = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    return arr.sort((a, b) => (a.year || 0) - (b.year || 0) || String(a.title || '').localeCompare(String(b.title || '')));
  }, [items]);

  const grouped = useMemo(() => groupByYear(sorted), [sorted]);
  const years = useMemo(() => Array.from(grouped.keys()).sort((a, b) => Number(a) - Number(b)), [grouped]);
  const latestYear = years.length ? years[years.length - 1] : null;
  const [openYears, setOpenYears] = useState(() => new Set(latestYear ? [latestYear] : []));

  const toggleYear = (y) => {
    setOpenYears((prev) => {
      const n = new Set(prev);
      if (n.has(y)) n.delete(y); else n.add(y);
      return n;
    });
  };

  return (
    <div className="w-full max-w-full">
      <div className="mb-3">
        {title && (
          <h3 className="text-lg font-bold text-light-text dark:text-dark-text flex items-center gap-2">
            <span role="img" aria-label="timeline">🧵</span>
            {title}
          </h3>
        )}
        {text && (
          <div className="mt-2 rounded-md border border-light-border/60 dark:border-dark-border/50 bg-light-surface/40 dark:bg-dark-surface/30 p-3">
            <p className="text-[13px] leading-6 text-light-text/90 dark:text-dark-text/90 whitespace-pre-line">
              {text}
            </p>
          </div>
        )}
      </div>

      <div className="relative">
        {/* Central vertical line */}
        <div className="absolute left-[20px] top-4 bottom-4 w-0.5 bg-light-border/60 dark:bg-dark-border/40 hidden md:block" aria-hidden="true" />
        <div className="space-y-2">
          {years.map((y) => {
            const list = grouped.get(y) || [];
            const first = list[0];
            const open = openYears.has(y);
            return (
              <div key={`year-${y}`} className="relative">
                {/* Year header clickable */}
                <YearHeader year={y} open={open} firstItem={first} count={list.length} onToggle={() => toggleYear(y)} />
                {/* Collapsible panel */}
                <div className={`transition-all overflow-hidden ${open ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <YearPanel items={list} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary card at bottom */}
      {(intro || title) && (
        <div className="mt-4 rounded-lg border border-light-border/60 dark:border-dark-border/50 bg-light-surface/50 dark:bg-dark-surface/40 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-xl">📜</div>
            <div className="min-w-0">
              {title && (
                <div className="text-base font-semibold text-light-text dark:text-dark-text">{title}</div>
              )}
              {intro && (
                <p className="mt-1 text-[13px] leading-5 text-light-text/80 dark:text-dark-text/80 whitespace-pre-line">{intro}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTimeline;
