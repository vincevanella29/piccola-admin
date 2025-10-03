import React from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import { HelpCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getRuleConfig } from './templates/_index';

const RuleCard = ({ merit, type, segmentMap, historyStatus }) => {
  const baseConfig = getRuleConfig(merit.template_key);
  const dynamicConfig = baseConfig.getCardStyle(merit);

  const Icon = dynamicConfig.icon || baseConfig.icon;
  const CardBody = baseConfig.card;
  const TooltipBody = baseConfig.tooltip;
  
  const segment = segmentMap[merit.segment_token_id] || { symbol: '???', name: 'Desconocido' };

  const isFulfilledThisMonth = type === 'current' && merit.status === 'fulfilled';
  const isHistory = type === 'history';
  const isFulfilledHistorically = isHistory && ((historyStatus ?? merit.status) === 'fulfilled');
  const needsMinting = isHistory && isFulfilledHistorically && merit.mint_status === 'pending';

  const tooltipId = `rule-tooltip-${merit.rule_id || merit.result_id}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-light-surface dark:bg-dark-surface rounded-xl border border-light-border/20 dark:border-dark-border/20 p-4 flex flex-col justify-between"
      style={{
        borderColor: dynamicConfig.borderColor,
        background: `radial-gradient(circle at top left, ${dynamicConfig.backgroundColor}, rgba(0,0,0,0) 50%)` ,
      }}
    >
      <div>
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-light-surface-secondary/50 dark:bg-dark-surface-secondary/50 p-2 rounded-full">
              <Icon size={20} className="text-light-text-primary dark:text-dark-text-primary" />
            </div>
            <div>
              <p className="font-bold text-base text-light-text-primary dark:text-dark-text-primary">{merit.name}</p>
              <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-mono">
                +{merit.merit_points} {segment.symbol} ({segment.name})
              </p>
            </div>
          </div>
          {isFulfilledThisMonth || isFulfilledHistorically ? (
            <CheckCircle size={20} className="text-matrix-green" />
          ) : (
            <Clock size={20} className="text-yellow-400" />
          )}
        </div>
        
        {/* Renderiza el cuerpo de la tarjeta dinámicamente */}
        <CardBody merit={merit} />

      </div>
      <div className="flex justify-between items-center mt-auto pt-3 border-t border-light-border/10 dark:border-dark-border/10">
        {isHistory ? (
          <div className='flex items-center gap-2'>
            <span className={`text-xs font-mono px-2 py-1 rounded ${isFulfilledHistorically ? 'bg-matrix-green/20 text-matrix-green' : 'bg-red-500/20 text-red-500'}`}>
              {isFulfilledHistorically ? `Logrado: ${merit.periodo}` : `No logrado: ${merit.periodo}`}
            </span>
            {needsMinting && (
              <div className='flex items-center gap-1 text-xs text-blue-400 font-semibold' data-tooltip-id="mint-tooltip">
                <AlertTriangle size={14}/> 
                <span>Pendiente de Entrega</span>
              </div>
            )}
          </div>
        ) : (
           <span className={`text-xs font-mono px-2 py-1 rounded ${isFulfilledThisMonth ? 'bg-matrix-green/20 text-matrix-green' : 'bg-yellow-400/20 text-yellow-400'}` }>
             {isFulfilledThisMonth ? '¡Logrado este mes!' : 'Misión Activa'}
           </span>
        )}
        <button data-tooltip-id={tooltipId} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors">
          <HelpCircle size={18} />
        </button>
      </div>

      <Tooltip id={tooltipId} place="top" className="z-50 max-w-xs" clickable>
        <div className="p-1"><TooltipBody merit={merit} /></div>
      </Tooltip>
      <Tooltip id="mint-tooltip" place="top" className="z-50 max-w-xs">
        <div className="p-1 text-center">
            <p className='font-bold'>¡Tus méritos están listos!</p>
            <p className='text-xs'>Avisa a administración para que envíen tus puntos a tu wallet y se registren en la blockchain.</p>
        </div>
      </Tooltip>
    </motion.div>
  );
};

export default RuleCard;