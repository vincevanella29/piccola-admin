import React from 'react';
import { Maximize2, GitCompare, ChevronDown } from 'lucide-react';

const ResumenHeader = ({
  t,
  allResumenes,
  selectedResumen,
  setSelectedResumen,
  granularity,
  setGranularity,
  mode,
  setMode,
  onExpand,
  dense = true,
  hideExpand = false,
  labelName = '',
}) => {
  const granularities = [
    { value: 'day', label: 'D' },
    { value: 'week', label: 'S' },
    { value: 'month', label: 'M' },
  ];

  // Use a compact dropdown when there are many series (>4)
  const useDropdown = allResumenes.length > 4;

  const handleResumenToggle = (resumen) => {
    if (selectedResumen.includes(resumen)) {
      setSelectedResumen(selectedResumen.filter(r => r !== resumen));
    } else {
      setSelectedResumen([...selectedResumen, resumen]);
    }
  };

  return (
    <div className={`flex items-center justify-between gap-2 ${dense ? 'mb-2' : 'mb-3'}`}>
      {/* Left: Label + series */}
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-xs font-bold text-light-text-primary dark:text-dark-text-primary shrink-0">
          {labelName || t('analytics.Resumen')}
        </span>

        {useDropdown ? (
          <div className="relative">
            <select
              multiple
              value={selectedResumen}
              onChange={(e) => {
                const vals = Array.from(e.target.selectedOptions, o => o.value);
                setSelectedResumen(vals);
              }}
              className="h-7 pl-2 pr-6 text-[10px] font-medium rounded-lg appearance-none
                bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50
                text-light-text-primary dark:text-dark-text-primary
                border border-light-border/30 dark:border-dark-border/30
                focus:outline-none max-w-[140px]"
            >
              {allResumenes.map(r => (
                <option key={r} value={r}>{r || '—'}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-light-text-secondary dark:text-dark-text-secondary" />
          </div>
        ) : (
          <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {allResumenes.map(r => (
              <button
                key={r}
                onClick={() => handleResumenToggle(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors
                  ${selectedResumen.includes(r)
                    ? 'bg-light-accent dark:bg-dark-accent text-white'
                    : 'bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
                  }
                `}
              >
                {r || '—'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Compare */}
        <button
          onClick={() => setMode(mode === 'compare' ? 'aggregate' : 'compare')}
          className={`p-1.5 rounded-lg transition-colors
            ${mode === 'compare'
              ? 'bg-light-accent/10 dark:bg-dark-accent/10 text-light-accent dark:text-dark-accent'
              : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary'
            }
          `}
          title={t('analytics.Comparar series')}
        >
          <GitCompare size={14} />
        </button>

        {/* Granularity */}
        <div className="flex rounded-lg overflow-hidden border border-light-border/30 dark:border-dark-border/30">
          {granularities.map(g => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className={`px-2 py-1 text-[10px] font-bold transition-colors
                ${granularity === g.value
                  ? 'bg-light-accent dark:bg-dark-accent text-white'
                  : 'bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 text-light-text-secondary dark:text-dark-text-secondary'
                }
              `}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Expand */}
        {!hideExpand && (
          <button
            onClick={onExpand}
            className="p-1.5 rounded-lg text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ResumenHeader;
