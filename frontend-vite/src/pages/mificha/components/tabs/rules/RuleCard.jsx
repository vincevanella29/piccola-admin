import React from 'react';
import { motion } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import { HelpCircle, CheckCircle2, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { getRuleConfig } from './templates/_index';

const RuleCard = ({ merit, type, segmentMap, historyStatus }) => {
  // 1. Obtenemos la configuración base y dinámica del template
  const baseConfig = getRuleConfig(merit.template_key);
  const dynamicConfig = baseConfig.getCardStyle(merit);

  // 2. Extraemos los componentes visuales del template
  // Si el dynamicConfig trae un icono específico (ej: Copa de Oro), usamos ese.
  const Icon = dynamicConfig.icon || baseConfig.icon;
  const CardBody = baseConfig.card;
  const TooltipBody = baseConfig.tooltip;
  
  // 3. Datos del segmento (puntos)
  const segment = segmentMap?.[merit.segment_token_id] || { symbol: '???', name: 'Desconocido' };

  // 4. Lógica de Estados
  const isFulfilledThisMonth = type === 'current' && merit.status === 'fulfilled';
  const isHistory = type === 'history';
  const isFulfilledHistorically = isHistory && ((historyStatus ?? merit.status) === 'fulfilled');
  const needsMinting = isHistory && isFulfilledHistorically && merit.mint_status === 'pending';
  const isCompleted = isFulfilledThisMonth || isFulfilledHistorically;

  const tooltipId = `rule-tooltip-${merit.rule_id || merit.result_id}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`
        relative flex flex-col justify-between
        rounded-2xl border backdrop-blur-md overflow-hidden transition-all duration-300
        ${isCompleted ? 'shadow-lg shadow-matrix-green/10' : 'shadow-sm hover:shadow-md'}
      `}
      style={{
        // Usamos los colores definidos en la template (ej: AdminSalesRanking devuelve dorado si es top 1)
        borderColor: dynamicConfig.borderColor || 'rgba(255,255,255,0.1)',
        backgroundColor: dynamicConfig.backgroundColor ? `${dynamicConfig.backgroundColor}` : 'rgba(255,255,255,0.02)', 
      }}
    >
        {/* Barra superior de color sutil para dar identidad sin invadir */}
        <div 
            className="absolute top-0 left-0 right-0 h-1 opacity-60" 
            style={{ backgroundColor: dynamicConfig.borderColor }} 
        />

        <div className="p-5 flex flex-col h-full">
            {/* --- HEADER: Identidad de la Misión --- */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3">
                    {/* El Icono respeta el color del template */}
                    <div 
                        className="p-2.5 rounded-xl border border-black/5 dark:border-white/10 shadow-sm bg-white/50 dark:bg-black/20"
                        style={{ color: dynamicConfig.borderColor }} // El icono toma el color del borde (ej: dorado)
                    >
                        <Icon size={20} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm leading-tight text-light-text-primary dark:text-white line-clamp-2">
                            {merit.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                {segment.name}
                            </span>
                             {/* Badge de Puntos pequeño */}
                             <span className="px-1.5 py-0.5 text-[10px] rounded bg-light-surface-secondary dark:bg-white/10 font-mono font-bold text-light-text-primary dark:text-white border border-light-border/10 dark:border-white/5">
                                +{merit.merit_points} {segment.symbol}
                             </span>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* --- BODY: Aquí se renderiza el diseño "Bonito" del Template --- */}
            <div className="flex-grow relative z-10">
                <CardBody merit={merit} />
            </div>

            {/* --- FOOTER: Estado unificado --- */}
            <div className="mt-4 pt-3 border-t border-light-border/10 dark:border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                     {isHistory ? (
                        <div className="flex items-center gap-1.5">
                            {isFulfilledHistorically ? (
                                <CheckCircle2 size={14} className="text-matrix-green" />
                            ) : (
                                <Clock size={14} className="text-red-400" />
                            )}
                            <span className={`text-xs font-medium ${isFulfilledHistorically ? 'text-matrix-green' : 'text-red-400'}`}>
                                {isFulfilledHistorically ? merit.periodo : 'No Logrado'}
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            {isFulfilledThisMonth ? (
                                <>
                                    <Sparkles size={14} className="text-matrix-green fill-matrix-green/20" />
                                    <span className="text-xs font-bold text-matrix-green">¡Logrado!</span>
                                </>
                            ) : (
                                <>
                                    <Clock size={14} className="text-yellow-500" />
                                    <span className="text-xs font-medium text-yellow-500">En curso</span>
                                </>
                            )}
                        </div>
                    )}
                    
                    {needsMinting && (
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-blue-400 animate-pulse" data-tooltip-id="mint-tooltip">
                            <AlertTriangle size={10} />
                            <span>Pendiente Blockchain</span>
                        </div>
                    )}
                </div>

                <button 
                    data-tooltip-id={tooltipId} 
                    className="p-1.5 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-surface-secondary dark:hover:bg-white/10 transition-colors"
                >
                  <HelpCircle size={18} strokeWidth={1.5} />
                </button>
            </div>
        </div>

      {/* Tooltips */}
      <Tooltip id={tooltipId} place="top" className="!bg-dark-surface !text-white !border !border-white/10 !rounded-xl !shadow-xl !px-4 !py-3 backdrop-blur-md z-50 max-w-xs" clickable>
        <div className="text-xs leading-relaxed opacity-90"><TooltipBody merit={merit} /></div>
      </Tooltip>
      <Tooltip id="mint-tooltip" place="top" className="!bg-blue-900/90 !text-blue-100 !border !border-blue-500/30 !rounded-xl !shadow-xl !px-4 !py-3 z-50 max-w-xs">
        <div className="text-center space-y-1">
            <p className='font-bold text-xs'>¡Méritos Listos!</p>
            <p className='text-[10px]'>Esperando envío a tu wallet.</p>
        </div>
      </Tooltip>
    </motion.div>
  );
};

export default RuleCard;