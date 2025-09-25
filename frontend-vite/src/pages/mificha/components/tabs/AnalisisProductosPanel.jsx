// src/pages/employees_register/components/tabs/AnalisisProductosPanel.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LoaderCircle, Info, BarChart2, FileText, Building, Store, Crown, ArrowUp, ArrowDown, Minus } from 'lucide-react';

// --- Componente de Barra de Progreso (sin cambios) ---
const BenchmarkBar = ({ title, yourSales, average, top, icon: Icon, colorClass }) => {
    const { t } = useTranslation();
    const safeYour = Number(isFinite(yourSales) ? yourSales : 0) || 0;
    const safeAvg = Number(isFinite(average) ? average : 0) || 0;
    const safeTop = Number(isFinite(top) ? top : 0) || 0;
    const barMax = Math.max(safeYour, safeTop, 1);
    const yourSalesPercent = Math.min((safeYour / barMax) * 100, 100);
    const avgPercent = Math.min((safeAvg / barMax) * 100, 100);
    return (
        <div>
            <p className="text-xs text-dark-text-secondary mb-1.5 flex items-center gap-1.5"><Icon size={14} className={colorClass} /> {title}</p>
            <div className="relative w-full h-3 bg-dark-surface-secondary rounded-full" data-tooltip-id="benchmark-tooltip" data-tooltip-content={`${t('mificha.top', 'Top')}: $${safeTop.toLocaleString('es-CL')}`}>
                <div className="absolute top-0 h-3 border-r-2 border-dashed border-cyan-400 z-10" style={{ left: `${avgPercent}%` }} data-tooltip-id="benchmark-tooltip" data-tooltip-content={`${t('mificha.promedio', 'Promedio')}: $${safeAvg.toLocaleString('es-CL')}`}/>
                <div className={`absolute top-0 h-3 rounded-full ${colorClass} bg-opacity-40`} style={{ width: `${yourSalesPercent}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1.5 px-1 font-mono text-dark-text-secondary">
                <span>Tú: ${safeYour.toLocaleString('es-CL')}</span>
                <span className={`font-bold ${colorClass} flex items-center gap-1`}><Crown size={12}/> Top: ${safeTop.toLocaleString('es-CL')}</span>
            </div>
        </div>
    );
};

// --- Tarjeta de Análisis (sin cambios) ---
const BenchmarkCard = ({ title, data }) => {
  const { t } = useTranslation();
  const { tus_ventas, comparativo_anual, benchmark_local, benchmark_empresa, ranking } = data;
  const getChangeIcon = (variacion) => {
    if (variacion > 0.1) return <ArrowUp size={14} className="text-green-400" />;
    if (variacion < -0.1) return <ArrowDown size={14} className="text-red-400" />;
    return <Minus size={14} className="text-gray-500" />;
  };
  const RankingInfo = ({ period, ranks }) => (
    <div className="text-center">
        <p className="text-[10px] uppercase text-dark-text-secondary tracking-wider">{period}</p>
        <p className="font-mono font-bold text-white text-sm">
            <span className="text-yellow-400" data-tooltip-id="benchmark-tooltip" data-tooltip-content={t('mificha.puesto_local', 'Puesto Local')}>{ranks?.puesto_local ? `L${ranks.puesto_local}` : '-'}</span>
            <span className="text-dark-text-secondary mx-1">/</span>
            <span className="text-cyan-400" data-tooltip-id="benchmark-tooltip" data-tooltip-content={t('mificha.puesto_empresa', 'Puesto Empresa')}>{ranks?.puesto_empresa ? `E${ranks.puesto_empresa}` : '-'}</span>
        </p>
    </div>
  );
  return (
    <div className="p-4 rounded-xl border border-dark-border/10 bg-dark-surface/50 space-y-4 transition-all hover:border-dark-border/30 hover:shadow-lg">
      <h4 className="font-bold text-white truncate text-base">{title}</h4>
      <div className="flex justify-between items-center bg-dark-surface-secondary/40 p-3 rounded-lg">
        <div>
          <p className="text-xs text-dark-text-secondary">{t('mificha.tus_ventas', 'Tus Ventas (Rango)')}</p>
          <p className="text-2xl font-bold font-mono text-matrix-green">${(tus_ventas || 0).toLocaleString('es-CL')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-dark-text-secondary">{t('mificha.variacion_anual', 'vs Año Anterior')}</p>
          <div className={`text-xl font-bold font-mono flex items-center justify-end gap-1 ${comparativo_anual?.variacion_porcentual > 0 ? 'text-green-400' : comparativo_anual?.variacion_porcentual < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {getChangeIcon(comparativo_anual?.variacion_porcentual || 0)}
            {(comparativo_anual?.variacion_porcentual || 0).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {benchmark_local && <BenchmarkBar title={t('mificha.benchmark_local', 'Benchmark Local')} icon={Store} colorClass="text-yellow-400" yourSales={tus_ventas} average={benchmark_local.promedio} top={benchmark_local.top} />}
        {benchmark_empresa && <BenchmarkBar title={t('mificha.benchmark_empresa', 'Benchmark Empresa')} icon={Building} colorClass="text-cyan-400" yourSales={tus_ventas} average={benchmark_empresa.promedio} top={benchmark_empresa.top} />}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-dark-border/10">
        <RankingInfo period={t('mificha.ranking_actual', 'Actual')} ranks={ranking?.actual} />
        <RankingInfo period={t('mificha.ranking_anterior', 'Año Ant.')} ranks={ranking?.anterior} />
        <RankingInfo period={t('mificha.ranking_historico', 'Histórico')} ranks={ranking?.historico} />
      </div>
    </div>
  );
};

// --- Componente de Controles de Fecha ---
const DateControls = ({ onApply, isLoading }) => {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];
  
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultEndDate.getDate() - 29);

  const [startDate, setStartDate] = useState(defaultStartDate.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(defaultEndDate.toISOString().split('T')[0]);

  const handleApplyClick = () => {
    onApply(startDate, endDate);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-dark-surface rounded-lg border border-dark-border/10">
      <div className="w-full sm:w-auto">
        <label htmlFor="start-date" className="text-xs text-dark-text-secondary">{t('mificha.fecha_inicio', 'Fecha Inicio')}</label>
        <input 
          id="start-date" 
          type="date" 
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full bg-dark-surface-secondary text-white p-2 rounded-md border-dark-border/20 border focus:ring-matrix-green focus:border-matrix-green"
          max={today}
        />
      </div>
      <div className="w-full sm:w-auto">
        <label htmlFor="end-date" className="text-xs text-dark-text-secondary">{t('mificha.fecha_fin', 'Fecha Fin')}</label>
        <input 
          id="end-date" 
          type="date" 
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full bg-dark-surface-secondary text-white p-2 rounded-md border-dark-border/20 border focus:ring-matrix-green focus:border-matrix-green"
          max={today}
        />
      </div>
      <button 
        onClick={handleApplyClick}
        disabled={isLoading}
        className="w-full sm:w-auto mt-4 sm:mt-0 self-end px-4 py-2 bg-matrix-green text-black font-bold rounded-md hover:bg-matrix-green/80 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? <LoaderCircle size={16} className="animate-spin" /> : t('mificha.aplicar', 'Aplicar')}
      </button>
    </div>
  );
};

export default function AnalisisProductosPanel({ ventasDetalle, fetchVentasDetalleProductos, isLoading }) {
    const { t } = useTranslation();
    const [analysisTab, setAnalysisTab] = useState('familia');

    const handleFetchDetails = useCallback(async (start, end) => {
        await fetchVentasDetalleProductos({ periodo_start: start, periodo_end: end, force: true });
    }, [fetchVentasDetalleProductos]);

    useEffect(() => {
        if (!ventasDetalle) {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 29);
            handleFetchDetails(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        }
    }, [ventasDetalle, handleFetchDetails]);
    
    const TabButton = ({ id, label, icon: Icon, action, current }) => (
        <button onClick={action} className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-semibold rounded-md transition-colors ${current === id ? 'bg-matrix-green/10 text-matrix-green' : 'text-dark-text-secondary hover:bg-dark-surface-secondary'}`}>
          <Icon size={16} /><span className="hidden sm:inline">{label}</span>
        </button>
      );

    return (
        <div className="space-y-6">
            <DateControls onApply={handleFetchDetails} isLoading={isLoading} />
            {isLoading && <div className="flex justify-center p-8"><LoaderCircle className="animate-spin text-matrix-green" /></div>}
            
            {!isLoading && ventasDetalle && (
                <>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm text-blue-300">
                        <Info size={40} className="hidden sm:block flex-shrink-0" />
                        <div>
                            <p className="font-bold">{t('mificha.analisis_title', 'Tu Coaching de Ventas')}</p>
                            <p className="text-xs" dangerouslySetInnerHTML={{ __html: t('mificha.analisis_desc_dinamico', `Análisis de tu rendimiento en el período <strong>${ventasDetalle.periodo_analisis}</strong>.`)}}/>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-1.5 rounded-lg bg-dark-surface-secondary/40 border border-dark-border/20 w-full sm:w-auto self-start">
                        <TabButton id="familia" label={t('mificha.tab_familia', 'Por Familia')} icon={BarChart2} action={() => setAnalysisTab('familia')} current={analysisTab} />
                        <TabButton id="subfamilia" label={t('mificha.tab_subfamilia', 'Por Subfamilia')} icon={FileText} action={() => setAnalysisTab('subfamilia')} current={analysisTab} />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {analysisTab === 'familia' && ventasDetalle.analisis_por_familia.map((item, idx) => (
                            <BenchmarkCard key={`fam-${idx}`} title={item.familia} data={item} />
                        ))}
                        {analysisTab === 'subfamilia' && ventasDetalle.analisis_por_subfamilia.map((item, idx) => (
                            <BenchmarkCard key={`sub-${idx}`} title={`${item.familia} / ${item.subfamilia}`} data={item} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}