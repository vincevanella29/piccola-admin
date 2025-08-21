import React from 'react';
import { Box, Dialog, DialogContent } from '@mui/material';
import { useTranslation } from 'react-i18next';

import ResumenHeader from './ResumenHeader';
import ResumenChart from './ResumenChart';
import ResumenTotals from './ResumenTotals';
import useResumenAggregation from './useResumenAggregation';
import DetalleResumen from './DetalleResumen';

const ResumenWidget = ({
  nonce = 0,
  resumenes = [],
  data = [],
  comparisonData = [],
  defaultGranularity = 'day',
  comparisonType = 'none',
  labelKey = 'label',
  labelName = '', // New: display name for the label
  valueKey = 'value',
  valueData = null, // New: display value or function
  dateKey = 'date',
  onDetailsClick = null,
  alignByIndex = false,
}) => {
  const { t } = useTranslation();

  // Labels disponibles
  const allResumenes = React.useMemo(() => {
    const fromData = Array.isArray(data) ? [...new Set(data.map(d => d.series ?? d[labelKey]).filter(Boolean))] : [];
    const fromComp = Array.isArray(comparisonData) ? [...new Set(comparisonData.map(d => d.series ?? d[labelKey]).filter(Boolean))] : [];
    return Array.from(new Set([...(resumenes || []), ...fromData, ...fromComp]));
  }, [resumenes, data, comparisonData, labelKey]);

  // Estado UI local
  const [selectedResumen, setSelectedResumen] = React.useState([]);
  const [detailData, setDetailData] = React.useState(null);
  const [granularity, setGranularity] = React.useState(defaultGranularity); // 'day'|'week'|'month'
  const [mode, setMode] = React.useState('aggregate'); // 'aggregate'|'compare'
  const [openModal, setOpenModal] = React.useState(false);

  // Reset limpio SOLO cuando cambia nonce (nueva búsqueda)
  React.useEffect(() => {
    setSelectedResumen(allResumenes.length ? allResumenes : []);
    setGranularity(defaultGranularity);
    setMode('aggregate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, allResumenes, defaultGranularity]);

  // Agregación + datasets + options
  const {
    aggregatedData,
    labels,
    chartData,
    chartOptions,
  } = useResumenAggregation({
    data,
    comparisonData,
    selectedResumen,
    granularity,
    comparisonType,
    alignByIndex,
    labelKey,
    valueKey,
    dateKey,
    t,
    onDetailsClick: setDetailData,
    mode,
  });

  const chartKey = React.useMemo(
    () => `${mode}-${granularity}-${selectedResumen.join('|')}`,
    [mode, granularity, selectedResumen]
  );

  return (
    <Box className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary shadow-modal rounded-3xl p-4">
      <ResumenHeader
        t={t}
        allResumenes={allResumenes}
        selectedResumen={selectedResumen}
        setSelectedResumen={setSelectedResumen}
        granularity={granularity}
        setGranularity={setGranularity}
        mode={mode}
        setMode={setMode}
        onExpand={() => setOpenModal(true)}
        labelName={labelName}
      />

      <ResumenChart
        key={chartKey}
        mode={mode}
        aggregatedData={aggregatedData}
        chartData={chartData}
        chartOptions={chartOptions}
        height={180}
        t={t}
      />

      <Box className="flex flex-col gap-1 mt-2">
        <ResumenTotals
          t={t}
          mode={mode}
          aggregatedData={aggregatedData}
          selectedResumen={selectedResumen}
          comparisonType={comparisonType}
          labelName={labelName}
          valueData={valueData}
        />
      </Box>

      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="lg"
        fullWidth
        classes={{ paper: 'bg-light-surface dark:bg-dark-surface rounded-3xl shadow-neon' }}
      >
        <DialogContent className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary p-6">
          <ResumenHeader
            t={t}
            allResumenes={allResumenes}
            selectedResumen={selectedResumen}
            setSelectedResumen={setSelectedResumen}
            granularity={granularity}
            setGranularity={setGranularity}
            mode={mode}
            setMode={setMode}
            dense={false}
            hideExpand
          />
          <Box className="mt-3" />
          <ResumenChart
            key={chartKey + '-modal'}
            mode={mode}
            aggregatedData={aggregatedData}
            chartData={chartData}
            chartOptions={chartOptions}
            height={500}
            t={t}
          />
          <Box className="flex flex-col gap-1 mt-4">
            <ResumenTotals
              t={t}
              mode={mode}
              aggregatedData={aggregatedData}
              selectedResumen={selectedResumen}
              comparisonType={comparisonType}
            />
          </Box>
        </DialogContent>
      </Dialog>
    {/* Dialog para mostrar el detalle del punto seleccionado */}
    <Dialog open={!!detailData} onClose={() => setDetailData(null)} maxWidth="sm" fullWidth>
      <DialogContent>
        <DetalleResumen detalle={detailData} t={t} />
      </DialogContent>
    </Dialog>
  </Box>
  );
};

export default ResumenWidget;
