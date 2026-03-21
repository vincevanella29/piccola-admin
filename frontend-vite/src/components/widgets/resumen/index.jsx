import React from 'react';
import { Dialog, DialogContent } from '@mui/material';
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
  labelName = '',
  valueKey = 'value',
  valueData = null,
  dateKey = 'date',
  onDetailsClick = null,
  alignByIndex = false,
  loading = false,
}) => {
  const { t } = useTranslation();

  const allResumenes = React.useMemo(() => {
    const fromData = Array.isArray(data) ? [...new Set(data.map(d => d.series ?? d[labelKey]).filter(Boolean))] : [];
    const fromComp = Array.isArray(comparisonData) ? [...new Set(comparisonData.map(d => d.series ?? d[labelKey]).filter(Boolean))] : [];
    return Array.from(new Set([...(resumenes || []), ...fromData, ...fromComp]));
  }, [resumenes, data, comparisonData, labelKey]);

  const [selectedResumen, setSelectedResumen] = React.useState([]);
  const [detailData, setDetailData] = React.useState(null);
  const [granularity, setGranularity] = React.useState(defaultGranularity);
  const [mode, setMode] = React.useState('aggregate');
  const [openModal, setOpenModal] = React.useState(false);

  React.useEffect(() => {
    setSelectedResumen(allResumenes.length ? allResumenes : []);
    setGranularity(defaultGranularity);
    setMode('aggregate');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

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

  if (loading) {
    return (
      <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20">
        <div className="h-4 w-28 rounded bg-light-surface-secondary/60 dark:bg-dark-surface-secondary/60 animate-pulse mb-3" />
        <div className="h-[180px] rounded-xl bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30 animate-pulse" />
        <div className="h-3 w-48 rounded bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 animate-pulse mt-3" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 bg-light-surface dark:bg-dark-surface border border-light-border/20 dark:border-dark-border/20 text-light-text-primary dark:text-dark-text-primary">
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

      <div className="mt-2">
        <ResumenTotals
          t={t}
          mode={mode}
          aggregatedData={aggregatedData}
          selectedResumen={selectedResumen}
          comparisonType={comparisonType}
          labelName={labelName}
          valueData={valueData}
        />
      </div>

      {/* Expanded Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="lg"
        fullWidth
        classes={{ paper: 'bg-light-surface dark:bg-dark-surface rounded-2xl' }}
      >
        <DialogContent className="bg-light-surface dark:bg-dark-surface text-light-text-primary dark:text-dark-text-primary p-5">
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
          <ResumenChart
            key={chartKey + '-modal'}
            mode={mode}
            aggregatedData={aggregatedData}
            chartData={chartData}
            chartOptions={chartOptions}
            height={500}
            t={t}
          />
          <div className="mt-3">
            <ResumenTotals
              t={t}
              mode={mode}
              aggregatedData={aggregatedData}
              selectedResumen={selectedResumen}
              comparisonType={comparisonType}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailData} onClose={() => setDetailData(null)} maxWidth="sm" fullWidth>
        <DialogContent className="bg-light-surface dark:bg-dark-surface">
          <DetalleResumen detalle={detailData} t={t} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResumenWidget;
