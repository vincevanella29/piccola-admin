// src/pages/chat/components/common/DataTable.jsx
import React, { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

/** Formateador de números (Reutilizado) */
const numberFormat = (v, format = 'number') => {
  try {
    if (v === null || v === undefined || v === '') return '-';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    if (format === 'money') return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
    return n.toLocaleString('es-CL');
  } catch {
    return String(v ?? '');
  }
};

/** Helper para obtener valor limpio (para excel/pdf) */
const getCleanValue = (row, col) => {
  const raw = row[col.key];
  if (col.format === 'money') return numberFormat(raw, 'money');
  if (col.format === 'number') return numberFormat(raw);
  if (col.key === 'delta') return `${raw > 0 ? '+' : ''}${raw}%`;
  return raw;
};

/** Iconos SVG Actualizados */
const Icons = {
  ChevronDown: ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>,
  Table: ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7-4h14m-7-4v8m-7-4h14" /></svg>,
  // Nuevos iconos de exportación
  FileExcel: ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  FilePdf: ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Image: ({ className }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Loading: ({ className }) => <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
};

/** Donut Chart (Sin cambios) */
const DonutChart = ({ data }) => {
  const cleanData = (data || []).filter(d => Number(d.value) > 0);
  const total = cleanData.reduce((acc, cur) => acc + Number(cur.value || 0), 0) || 1;
  let accumulatedAngle = 0;
  const segmentClasses = [
    'stroke-light-accent',
    'stroke-vanellix-purple',
    'stroke-matrix-green',
    'stroke-light-error',
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 py-4 justify-center sm:justify-start">
      <div className="relative w-28 h-28 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
          {cleanData.map((d, i) => {
            const value = Number(d.value);
            const percentage = value / total;
            const dashArray = percentage * 314; 
            const dashOffset = -(accumulatedAngle * 314);
            accumulatedAngle += percentage;
            return <circle key={i} cx="50" cy="50" r="40" fill="transparent" strokeWidth="16" strokeDasharray={`${dashArray} 314`} strokeDashoffset={dashOffset} className={`hover:opacity-80 transition-opacity ${segmentClasses[i % segmentClasses.length]}`} />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] opacity-50 uppercase font-bold">Total</span>
          <span className="text-[10px] font-bold">{numberFormat(total, 'compact')}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {cleanData.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="opacity-70 truncate max-w-[80px]" title={d.label}>{d.label}</span>
            <span className="font-medium ml-auto">{numberFormat(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function DataTable({ 
  title, subtitle, kpis = [], columns = [], rows = [], totals = null, charts = [], compact = true, onRowClick = null, pageSize = 10 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState(columns[0]?.key || '');
  const [sortDir, setSortDir] = useState('desc');
  const [isExporting, setIsExporting] = useState(false);
  const tableRef = useRef(null); // Referencia para la captura de imagen
  
  const size = Math.max(5, pageSize);
  const safeCharts = Array.isArray(charts) ? charts : [];
  const metricKey = useMemo(() => columns.find(c => (c.format === 'money' || c.format === 'number') && c.key !== 'delta' && c.key !== 'id')?.key, [columns]);
  const maxMetricValue = useMemo(() => (!metricKey ? 0 : Math.max(...rows.map(r => Number(r[metricKey]) || 0), 0)), [rows, metricKey]);

  // --- EXPORT FUNCTIONS ---

  const handleExportExcel = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        // Preparamos la data "plana" para Excel
        const excelData = rows.map(row => {
          const newRow = {};
          columns.forEach(col => {
            newRow[col.label] = getCleanValue(row, col);
          });
          return newRow;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, `${title || 'Reporte'}.xlsx`);
      } catch (e) {
        console.error("Error excel export", e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        
        // Títulos
        doc.setFontSize(18);
        doc.text(title || 'Reporte', 14, 22);
        if(subtitle) {
          doc.setFontSize(11);
          doc.setTextColor(100);
          doc.text(subtitle, 14, 28);
        }

        // Tabla
        const tableColumn = columns.map(c => c.label);
        const tableRows = rows.map(row => columns.map(col => getCleanValue(row, col)));

        doc.autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: subtitle ? 35 : 30,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [66, 66, 66] }
        });

        doc.save(`${title || 'Reporte'}.pdf`);
      } catch (e) {
        console.error("Error PDF export", e);
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    
    // Forzamos expansión temporalmente si está colapsado para la foto
    const wasExpanded = isExpanded;
    if (!wasExpanded) setIsExpanded(true);

    // Pequeño delay para renderizar
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(tableRef.current, { 
          backgroundColor: null, // Transparente o hereda
          scale: 2 // Mejor calidad
        });
        
        const link = document.createElement('a');
        link.download = `${title || 'Snapshot'}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (e) {
        console.error("Error Image export", e);
      } finally {
        if(!wasExpanded) setIsExpanded(false);
        setIsExporting(false);
      }
    }, 300);
  };

  // --- TABLE LOGIC ---

  const sortedRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];
    if (!sortKey) return arr;
    const col = columns.find(c => c.key === sortKey) || {};
    const isNumber = ['number', 'money', 'delta'].includes(col.format);
    
    arr.sort((a, b) => {
      const va = a?.[sortKey];
      const vb = b?.[sortKey];
      if (isNumber) return sortDir === 'asc' ? (Number(va)||0) - (Number(vb)||0) : (Number(vb)||0) - (Number(va)||0);
      return sortDir === 'asc' ? String(va||'').localeCompare(String(vb||'')) : String(vb||'').localeCompare(String(va||''));
    });
    return arr;
  }, [rows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil((sortedRows?.length || 0) / size));
  const pageSafe = Math.min(page, totalPages - 1);
  const start = pageSafe * size;
  const pageRows = sortedRows.slice(start, start + size);

  const renderCell = (row, col) => {
    const raw = row[col.key];
    if (col.format === 'image') return raw ? <img src={raw} alt="" className="w-8 h-8 rounded-lg object-cover border border-black/5 dark:border-white/10" /> : <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />;
    
    if (col.key === 'delta') {
      const val = Number(raw) || 0;
      if (val === 0) return <span className="text-gray-300">—</span>;
      const isPos = val > 0;
      return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${isPos ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>{isPos ? '↑' : '↓'} {Math.abs(val)}%</span>;
    }
    if ((col.format === 'money' || col.format === 'number') && col.key === metricKey && maxMetricValue > 0) {
      const val = Number(raw) || 0;
      const width = Math.min(100, (Math.abs(val) / maxMetricValue) * 100);
      return (
        <div className="relative w-full flex justify-end items-center gap-2">
          <div className="absolute right-0 top-1 bottom-1 bg-light-accent/10 dark:bg-dark-accent/15 rounded-l pointer-events-none" style={{ width: `${width}%` }} />
          <span className="relative z-10 font-medium">{col.format === 'money' ? numberFormat(val, 'money') : numberFormat(val)}</span>
        </div>
      );
    }
    if (col.format === 'money') return numberFormat(raw, 'money');
    if (col.format === 'number') return numberFormat(raw);
    return raw ?? '-';
  };

  return (
    <div ref={tableRef} className="flex flex-col w-full max-w-full bg-light-surface dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
      
      {/* --- CABECERA --- */}
      <div className="bg-gray-50/50 dark:bg-white/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Títulos */}
          <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              {title || 'Reporte'}
              <Icons.ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
            </h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
          </div>

          {/* Acciones (Exportar) - Solo visibles si hay datos */}
          {rows.length > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={handleExportExcel} disabled={isExporting} title="Descargar Excel" className="p-2 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors disabled:opacity-50">
                {isExporting ? <Icons.Loading className="w-4 h-4" /> : <Icons.FileExcel className="w-4 h-4" />}
              </button>
              <button onClick={handleExportPDF} disabled={isExporting} title="Descargar PDF" className="p-2 rounded-lg text-gray-500 hover:bg-light-error/10 hover:text-light-error dark:hover:bg-dark-error/20 dark:hover:text-dark-error transition-colors disabled:opacity-50">
                {isExporting ? <Icons.Loading className="w-4 h-4" /> : <Icons.FilePdf className="w-4 h-4" />}
              </button>
              <button onClick={handleExportImage} disabled={isExporting} title="Guardar Imagen" className="p-2 rounded-lg text-gray-500 hover:bg-light-accent/10 hover:text-light-accent dark:hover:bg-dark-accent/20 dark:hover:text-dark-accent transition-colors disabled:opacity-50">
                {isExporting ? <Icons.Loading className="w-4 h-4" /> : <Icons.Image className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* KPI CARDS */}
        {Array.isArray(kpis) && kpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            {kpis.slice(0, isExpanded ? undefined : 4).map((k, idx) => {
              const deltaVal = Number(k.delta);
              return (
                <div key={idx} className="flex flex-col p-2.5 rounded-xl bg-white dark:bg-dark-surface-secondary border border-gray-100 dark:border-dark-border/40 shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold truncate">{k.label}</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {k.isMoney ? numberFormat(k.value, 'money') : numberFormat(k.value)}
                    </span>
                    {typeof k.delta !== 'undefined' && (
                      <span className={`text-[9px] font-bold ${deltaVal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {deltaVal > 0 ? '▲' : '▼'}{Math.abs(deltaVal)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botón Ver más (si está colapsado) */}
        {!isExpanded && (
          <div className="mt-3 flex items-center justify-center cursor-pointer" onClick={() => setIsExpanded(true)}>
            <span className="text-[10px] font-medium text-light-accent dark:text-dark-accent flex items-center gap-1 opacity-80 hover:opacity-100">
              Ver análisis completo <Icons.Table className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>

      {/* --- CONTENIDO EXPANDIBLE --- */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-800 animate-in fade-in slide-in-from-top-2 duration-300">
          
          {/* Gráficos */}
          {safeCharts.length > 0 && (
            <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-white dark:bg-dark-surface">
              {safeCharts.map((ch, idx) => (
                <div key={idx}>
                  {ch.title && <h4 className="text-xs font-semibold mb-2 text-center opacity-70">{ch.title}</h4>}
                  {ch.type === 'pie' && <DonutChart data={ch.data} />}
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 dark:bg-dark-surface-secondary border-b border-gray-200 dark:border-gray-800">
                <tr>
                  {columns.map((c, idx) => (
                    <th 
                      key={idx} 
                      className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 select-none ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                      onClick={() => { if (sortKey === c.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(c.key); setSortDir('desc'); } }}
                    >
                      {c.label} {sortKey === c.key && (sortDir === 'asc' ? '▴' : '▾')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {pageRows.map((r, ridx) => (
                  <tr key={ridx} onClick={onRowClick ? () => onRowClick(r, start + ridx) : undefined} className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-light-accent/5 dark:hover:bg-dark-accent/20' : ''}`}>
                    {columns.map((c, cidx) => (
                      <td key={cidx} className={`px-4 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 tabular-nums ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
                        {renderCell(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot className="bg-gray-50 dark:bg-dark-surface-secondary border-t border-gray-200 dark:border-gray-800 font-semibold text-xs">
                  <tr>
                    {columns.map((c, idx) => {
                      if(idx===0) return <td key={idx} className="px-4 py-2">Total</td>;
                      const val = totals[c.key];
                      if (c.key === 'delta' || !val) return <td key={idx}></td>;
                      return <td key={idx} className={`px-4 py-2 tabular-nums ${c.align === 'right' ? 'text-right' : ''}`}>{c.format === 'money' ? numberFormat(val, 'money') : numberFormat(val)}</td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5">
              <span className="text-[10px] text-gray-400">{pageSafe + 1} / {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0} className="px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs disabled:opacity-50">Anterior</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1} className="px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs disabled:opacity-50">Siguiente</button>
              </div>
            </div>
          )}
          
          <div className="py-2 text-center border-t border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors" onClick={() => setIsExpanded(false)}>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Cerrar Detalle</span>
          </div>
        </div>
      )}
    </div>
  );
}