import React from 'react';
import { Trophy, Building, Store } from 'lucide-react';

const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('es-CL');

// --- Componente de Barra de Progreso ---
const BenchmarkBar = ({ yourValue, average, top, colorClass }) => {
    const formatValue = (val) => val.toLocaleString('es-CL');
    const barMax = Math.max(yourValue, top, 1);
    const yourPercent = Math.min((yourValue / barMax) * 100, 100);
    const avgPercent = Math.min((average / barMax) * 100, 100);

    return (
        <div className="relative w-full h-3 bg-dark-surface-secondary rounded-full overflow-hidden">
            <div className="absolute top-0 h-full border-r-2 border-dashed border-purple-400/50 z-10" style={{ left: `${avgPercent}%` }} title={`Promedio: ${formatValue(average)}`} />
            <div className={`h-full rounded-full ${colorClass} bg-opacity-40`} style={{ width: `${yourPercent}%` }} />
        </div>
    );
};

// --- Componente de Perfil del #1 ---
const TopPerformerProfile = ({ performer, value, unit, label, icon: Icon, colorClass }) => (
    <div className="flex items-center gap-3">
        <Icon size={24} className={`flex-shrink-0 ${colorClass}`} />
        <div className="flex-grow">
            <p className={`text-xs font-semibold ${colorClass}`}>{label}</p>
            {performer ? (
                <>
                    <div className="flex items-center gap-2 mt-1">
                        <img src={performer.profile_image_url} alt={performer.nombre || 'Top Performer'} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                            <p className="text-sm font-bold text-dark-text-primary">{performer.nombre} {performer.apellido}</p>
                            <p className="text-xs text-dark-text-secondary">{unit === '$' ? fmtCLP.format(value) : fmtNum.format(value)}</p>
                        </div>
                    </div>
                </>
            ) : <p className="text-sm text-dark-text-secondary">N/A</p>}
        </div>
    </div>
);

export const BenchmarkDetailCard = ({ title, icon: Icon, unit = '', kpiData }) => {
    if (!kpiData) return null;

    const { yourValue, puestoLocal, puestoEmpresa, promedioLocal, promedioEmpresa, topLocal, topEmpresa, topLocalValue, topEmpresaValue } = kpiData;
    const formatValue = (val) => unit === '$' ? fmtCLP.format(val) : fmtNum.format(val);
    
    return (
        <div className="bg-dark-surface-secondary/50 border border-dark-border/10 rounded-xl p-4 space-y-4">
            {/* Título y Valor Principal */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-dark-text-primary">
                        <Icon size={18} className="text-matrix-green" /> {title}
                    </h3>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-mono font-bold text-matrix-green">{formatValue(yourValue)}</p>
                    <p className="text-xs text-dark-text-secondary">Tu rendimiento</p>
                </div>
            </div>

            {/* Benchmarks y Rankings */}
            <div className="space-y-3 text-sm">
                {/* Local */}
                <div className="space-y-1">
                    <div className="flex justify-between items-baseline font-mono text-xs">
                        <span className="font-semibold text-yellow-400">Local</span>
                        <span className="text-dark-text-secondary">Puesto: <span className="font-bold text-white">#{puestoLocal || '-'}</span></span>
                    </div>
                    <BenchmarkBar yourValue={yourValue} average={promedioLocal} top={topLocalValue || 0} colorClass="bg-yellow-400" />
                </div>
                {/* Empresa */}
                <div className="space-y-1">
                     <div className="flex justify-between items-baseline font-mono text-xs">
                        <span className="font-semibold text-cyan-400">Empresa</span>
                        <span className="text-dark-text-secondary">Puesto: <span className="font-bold text-white">#{puestoEmpresa || '-'}</span></span>
                    </div>
                    <BenchmarkBar yourValue={yourValue} average={promedioEmpresa} top={topEmpresaValue || 0} colorClass="bg-cyan-400" />
                </div>
            </div>

            {/* Líderes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dark-border/10">
                <TopPerformerProfile 
                    performer={topLocal} 
                    value={topLocalValue}
                    unit={unit}
                    label="Líder del Local" 
                    icon={Store}
                    colorClass="text-yellow-400"
                />
                <TopPerformerProfile 
                    performer={topEmpresa} 
                    value={topEmpresaValue}
                    unit={unit}
                    label="Líder de la Empresa" 
                    icon={Building}
                    colorClass="text-cyan-400"
                />
            </div>
        </div>
    );
};