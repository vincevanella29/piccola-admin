import React from 'react';
import Pill from './ui/Pill.jsx';
import ConfidenceBar from './ui/ConfidenceBar.jsx';
import { CheckCircle2, XCircle } from 'lucide-react';

const ResultSheet = ({
  t,
  sheetOpen,
  setSheetOpen,
  autoMode,
  setAutoMode,
  result,
  hasLabel,
  labelDoc,
  conf,
  topkInfo = [],
}) => {
  return (
    <div className={`mt-3 transition-all ${sheetOpen ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-1'}`}>
      <div className="bg-dark-surface border border-dark-border rounded-2xl p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{t('dishes.result.title')}</div>
          <div className="flex gap-2">
            <Pill onClick={() => setAutoMode(v => !v)} active={autoMode}>{t('dishes.modes.auto')}</Pill>
            <Pill onClick={() => setSheetOpen(v => !v)}>{sheetOpen ? t('dishes.actions.hide') : t('dishes.actions.show')}</Pill>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2">
            {hasLabel
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-matrix-green" />
              : <XCircle className="mt-0.5 h-4 w-4 text-red-400" />}
            <div className="text-sm">
              <div>
                <b>{t('dishes.result.dish')}:</b> {labelDoc?.nombre ?? result?.label ?? t('dishes.unknown')}
              </div>
              {labelDoc?.descripcion && (
                <div className="text-xs text-dark-text-secondary mt-0.5 line-clamp-3">
                  {labelDoc.descripcion}
                </div>
              )}
              {typeof labelDoc?.precio !== 'undefined' && (
                <div className="text-xs text-dark-text-secondary mt-0.5">
                  {t('dishes.fields.price')}: {labelDoc.precio}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-dark-text-secondary">{t('dishes.result.confidence')}</div>
            <ConfidenceBar value={conf} />
          </div>

          {!!topkInfo.length && (
            <div className="mt-2">
              <div className="text-xs text-dark-text-secondary mb-1">{t('dishes.result.topk')}</div>
              <ul className="space-y-1 text-sm">
                {topkInfo.map((r, i) => {
                  const name = r?.doc?.nombre || r.plato_id;
                  const price = r?.doc?.precio;
                  return (
                    <li key={i} className="flex items-center justify-between">
                      <span className="truncate">
                        {name}{typeof price !== 'undefined' ? ` · ${price}` : ''}
                      </span>
                      <span className="tabular-nums text-dark-text-secondary">
                        {Number(r.score ?? 0).toFixed(3)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="text-[11px] text-dark-text-tertiary mt-2">
            {t('dishes.result.threshold_note', { thr: result?.threshold_min ?? 0.25 })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultSheet;
