import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Utensils, XCircle } from 'lucide-react';
import ConfidenceBar from './ui/ConfidenceBar.jsx';

const ResultSheet = ({ result, classifying, t }) => {
  const hasResult = result && result.topk && result.topk.length > 0;
  const best = hasResult ? result.topk[0] : null;
  const confidence = best ? Math.max(0, Math.min(1, Number(best.score) || 0)) : 0;
  const MIN_CONF = 0.70;
  const isVisible = hasResult || classifying;
  const [sheetOpen, setSheetOpen] = useState(false);
  // Reopen when a new classification cycle starts
  useEffect(() => {
    if (classifying) setSheetOpen(true);
  }, [classifying]);
  // Reopen when a new result object arrives
  useEffect(() => {
    if (result) setSheetOpen(true);
  }, [result]);

  if (!sheetOpen) return null;

  return (
    <div
      onClick={() => setSheetOpen(false)}
      className={`absolute inset-0 z-40 p-3 transition-transform duration-500 ease-out ${
        isVisible ? 'translate-y-0 pointer-events-auto' : 'translate-y-[calc(100%+12px)] pointer-events-none'
      }`}
    >
      {/* Backdrop click area */}
      <div className="absolute inset-0 bg-light-surface/40 dark:bg-dark-surface/40" />

      {/* Sheet card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md mx-auto bg-light-surface/90 dark:bg-dark-surface/90 backdrop-blur-xl border border-light-border dark:border-dark-border rounded-3xl p-4 shadow-2xl"
      >
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-light-text-primary dark:text-dark-text-primary">{t('dishes.result.title')}</h3>
          {classifying && !hasResult && (
            <div className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
              <div className="h-2 w-2 bg-matrix-green rounded-full animate-pulse" />
              <span>{t('dishes.actions.classifying')}...</span>
            </div>
          )}
          <button
            onClick={() => setSheetOpen(false)}
            aria-label={t('dishes.actions.hide')}
            className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-accent-hover/60 dark:hover:bg-dark-accent-hover/50"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {hasResult && (
          <div className="space-y-4">
            {confidence >= MIN_CONF ? (
              <StrongMatch result={result} t={t} />
            ) : (
              <WeakMatch result={result} t={t} />
            )}
            
            <div>
              <ConfidenceBar value={confidence} />
              <div className="text-[10px] text-light-text-tertiary dark:text-dark-text-tertiary text-center mt-1.5">
                {t('dishes.result.confidence')} ({Math.round(confidence * 100)}%)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StrongMatch = ({ result, t }) => {
  const labelDoc = result.label_info || {};
  const imgSrc = labelDoc?.media_r2 || labelDoc?.media_url || labelDoc?.media_local || null;
  return (
    <div className="flex items-center gap-4">
      {imgSrc ? (
        <img src={imgSrc} alt={labelDoc?.nombre} className="h-16 w-16 rounded-xl object-cover border border-light-border dark:border-dark-border flex-shrink-0" />
      ) : (
        <div className="h-16 w-16 rounded-xl bg-light-surface-tertiary dark:bg-dark-background border border-light-border dark:border-dark-border flex-shrink-0 flex items-center justify-center">
            <Utensils className="h-6 w-6 text-light-text-tertiary dark:text-dark-text-tertiary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-matrix-green flex-shrink-0" />
            <div className="font-semibold leading-tight truncate text-light-text-primary dark:text-dark-text-primary">{labelDoc?.nombre ?? result?.label}</div>
        </div>
        {labelDoc?.descripcion && (
          <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 line-clamp-2">{labelDoc.descripcion}</p>
        )}
      </div>
       <PriceDisplay doc={labelDoc} t={t} />
    </div>
  );
};

const WeakMatch = ({ result, t }) => {
  const bestGuess = (result?.topk_info || [])[0] || {};
  const otherGuesses = (result?.topk_info || []).slice(1, 4);

  return (
    <div className="space-y-3">
        <div className="flex items-start gap-2 p-2 rounded-lg bg-light-surface-tertiary/50 dark:bg-dark-background/50">
            <XCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
               {t('dishes.result.no_strong_match')}
            </p>
        </div>

        {bestGuess?.doc && <ListItem r={bestGuess} isBestGuess t={t} />}
      
        {otherGuesses.length > 0 && (
            <details className="group">
                <summary className="list-none flex items-center justify-between cursor-pointer py-1 text-xs text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary">
                    <span>{t('dishes.result.other_matches', 'Ver otras coincidencias')}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="space-y-2 pt-2 border-t border-light-border dark:border-dark-border">
                    {otherGuesses.map((r, i) => (
                        <ListItem key={i} r={r} t={t} />
                    ))}
                </ul>
            </details>
        )}
    </div>
  );
};

const ListItem = ({ r, isBestGuess = false, t }) => {
  const d = r?.doc || {};
  const img = d.media_r2 || d.media_url || d.media_local || null;
  return (
     <li className={`flex items-center gap-3 ${isBestGuess ? 'p-2 rounded-lg bg-light-surface-tertiary/40 dark:bg-dark-background/40' : ''}`}>
      {img ? (
        <img src={img} alt={d.nombre || 'dish'} className="h-10 w-10 rounded-md object-cover border border-light-border dark:border-dark-border" />
      ) : (
        <div className="h-10 w-10 rounded-md bg-light-surface-tertiary dark:bg-dark-background border border-light-border dark:border-dark-border flex items-center justify-center"><Utensils className="h-5 w-5 text-light-text-tertiary dark:text-dark-text-tertiary"/></div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-light-text-primary dark:text-dark-text-primary">{d.nombre || d._id}</div>
        <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
            {t('dishes.result.confidence_short', 'Conf:')} {Math.round((r.score || 0) * 100)}%
        </div>
      </div>
      <PriceDisplay doc={d} t={t} />
    </li>
  )
}

const PriceDisplay = ({ doc, t }) => {
    const curr = doc?.currency || '$';
    const price = doc?.precio;
    const sp = doc?.especial?.special_status ? doc?.especial?.special_price : null;
    
    if (typeof sp === 'number' && sp > 0) {
      return (
        <div className="text-right flex-shrink-0">
          <div className="text-[11px] text-light-text-tertiary dark:text-dark-text-tertiary line-through tabular-nums">{curr}{price}</div>
          <div className="text-base font-mono font-semibold text-light-text-primary dark:text-dark-text-primary tabular-nums">{curr}{sp}</div>
        </div>
      );
    }
    return (
      <div className="text-base font-mono font-semibold text-light-text-primary dark:text-dark-text-primary tabular-nums flex-shrink-0">
        {typeof price !== 'undefined' ? `${curr}${price}` : '—'}
      </div>
    );
};

export default ResultSheet;
