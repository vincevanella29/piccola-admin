// src/pages/chat/components/common/ClubSectionCard.jsx
import React, { useMemo } from 'react';

function normalizeActions(payload) {
  const actions = Array.isArray(payload?.actions) ? payload.actions : [];
  const specPrimary = payload?.spec?.primary_action;
  // Avoid duplicate primary if it's already in actions by label+url
  const hasPrimary = specPrimary && actions.some(a => (a?.label || '').trim() === (specPrimary?.label || '').trim() && (a?.url || '').trim() === (specPrimary?.url || '').trim());
  const out = [...actions];
  if (specPrimary && !hasPrimary) {
    out.unshift({ label: specPrimary.label, url: specPrimary.url, variant: specPrimary.variant || 'primary', method: specPrimary.method || 'GET' });
  }
  return out;
}

const VARIANT_CLASSES = {
  // Primary CTA in brand green, readable text on dark background color token
  primary: 'bg-matrix-green text-dark-background hover:bg-matrix-green/90',
  // Neutral button matching panels in both themes
  secondary: 'bg-light-surface-secondary dark:bg-dark-surface-secondary text-light-text-primary dark:text-dark-text-primary hover:opacity-90',
  // Link-style action in brand green
  link: 'bg-transparent underline text-matrix-green hover:opacity-80',
};

const ClubSectionPayload = ({ payload }) => {
  const section = payload?.section || payload?.spec?.section || 'club';
  const title = payload?.title || payload?.spec?.title || 'Sección del Club';
  const text = payload?.text || payload?.base_text || '';
  const primaryUrl = payload?.primary_url || payload?.spec?.primary_action?.url || null;
  const actions = useMemo(() => normalizeActions(payload), [payload]);

  return (
    <div className="flex flex-col h-full w-full max-w-full rounded-xl border border-light-border/60 dark:border-dark-border/60 bg-light-surface/90 dark:bg-dark-surface/60 shadow-sm hover:shadow-md transition-shadow">
      <div className="px-4 py-3 border-b border-light-border/50 dark:border-dark-border/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-matrix-green/15 text-matrix-green uppercase tracking-wide">{section}</span>
          <h3 className="text-sm md:text-base font-semibold truncate">{title}</h3>
        </div>
        {primaryUrl && (
          <a href={primaryUrl} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-matrix-green text-dark-background hover:bg-matrix-green/90">
            Abrir
          </a>
        )}
      </div>
      {text && (
        <div className="flex-1 px-4 pt-3 pb-3 text-sm whitespace-pre-wrap break-words text-light-text-primary dark:text-dark-text-primary">
          {text}
        </div>
      )}
      {actions.length > 0 && (
        <div className="px-4 py-3 flex flex-wrap gap-2 mt-auto border-t border-light-border/10 dark:border-dark-border/10">
          {actions.map((act, idx) => {
            const variant = (act?.variant || 'secondary').toLowerCase();
            const cls = VARIANT_CLASSES[variant] || VARIANT_CLASSES.secondary;
            const label = act?.label || 'Abrir';
            const url = act?.url || '#';
            return (
              <a
                key={`${label}-${idx}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${cls}`}
                title={label}
              >
                {label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClubSectionPayload;
