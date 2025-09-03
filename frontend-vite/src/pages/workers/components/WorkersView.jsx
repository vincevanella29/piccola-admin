import React from 'react';
import { Box, Typography, Button, CircularProgress, Chip, TextField, Paper, Stack, Divider, MenuItem, Checkbox, ListItemText } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const WorkersView = ({ t, workers = [], isLoading, error, runWorkers, executionResults }) => {
  const [mesano, setMesano] = React.useState('');
  const [selectedWorkers, setSelectedWorkers] = React.useState([]);
  const [results, setResults] = React.useState([]);
  const [localLoading, setLocalLoading] = React.useState(false);

  React.useEffect(() => {
    if (executionResults && Array.isArray(executionResults)) {
      setResults(executionResults);
    }
  }, [executionResults]);

  const handleWorkerToggle = (worker) => {
    setSelectedWorkers((prev) =>
      prev.includes(worker) ? prev.filter((w) => w !== worker) : [...prev, worker]
    );
  };

  const handleRun = async () => {
    if (!mesano) return;
    setLocalLoading(true);
    try {
      await runWorkers({
        mesano,
        include: selectedWorkers.length > 0 ? selectedWorkers : undefined,
      });
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <Paper
      elevation={2}
      className="bg-light-surface dark:bg-dark-surface shadow-neon"
      sx={{ p: { xs: 2, md: 4 }, maxWidth: 600, mx: 'auto', mt: 4, borderRadius: '1.5rem', boxShadow: 'var(--tw-shadow-neon)' }}
    >
      <Stack spacing={3}>
        <Typography
          variant="h5"
          className="text-light-accent dark:text-dark-accent font-futurist"
          sx={{ fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}
        >
          {t('workers.run', 'Ejecutar Workers')}
        </Typography>
        {isLoading && <CircularProgress sx={{ mx: 'auto', color: 'var(--matrix-green)' }} />}
        {error && (
          <Typography color="error" sx={{ textAlign: 'center', fontWeight: 500 }}>
            {error.message || t('workers.error', 'Error')}
          </Typography>
        )}
        <TextField
          label={t('workers.mesano_placeholder', 'MesAño (e.g. 202408)')}
          value={mesano}
          onChange={e => setMesano(e.target.value)}
          variant="outlined"
          fullWidth
          sx={{
            maxWidth: 300,
            mx: 'auto',
            '& .MuiOutlinedInput-root': {
              color: 'var(--light-text-primary)',
              background: 'var(--light-surface-secondary)',
              borderRadius: '0.75rem',
              fontWeight: 500,
            },
            '& .MuiInputLabel-root': {
              color: 'var(--light-accent)',
              fontWeight: 600,
            },
          }}
        />
        <Box>
  <Typography
    variant="body2"
    className="text-light-text-secondary dark:text-dark-text-secondary"
    sx={{ mb: 1, fontWeight: 500 }}
  >
    {t('workers.select', 'Selecciona los workers a ejecutar (opcional):')}
  </Typography>
  <TextField
    select
    SelectProps={{
      multiple: true,
      renderValue: (selected) =>
        selected.length === 0
          ? t('workers.all_selected', 'Todos los workers')
          : selected.join(', '),
      MenuProps: {
        PaperProps: {
          style: {
            maxHeight: 300,
          },
        },
      },
    }}
    value={selectedWorkers}
    onChange={(e) => setSelectedWorkers(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
    variant="outlined"
    fullWidth
    sx={{ maxWidth: 400, mx: 'auto', background: 'var(--light-surface-secondary)', borderRadius: '0.75rem' }}
    placeholder={t('workers.all_selected', 'Todos los workers')}
  >
    {workers.map((w) => (
      <MenuItem key={w} value={w}>
        <Checkbox checked={selectedWorkers.indexOf(w) > -1} color="success" />
        <ListItemText primary={w} />
      </MenuItem>
    ))}
  </TextField>
</Box>
        <Button
          variant="contained"
          color="success"
          onClick={handleRun}
          disabled={!mesano || localLoading}
          size="large"
          startIcon={<PlayArrowIcon />}
          className="bg-light-accent dark:bg-dark-accent hover:bg-light-accent-hover dark:hover:bg-dark-accent-hover text-white font-futurist shadow-neon"
          sx={{
            borderRadius: '1rem',
            fontWeight: 700,
            minWidth: 160,
            mx: 'auto',
            fontSize: '1.1rem',
            letterSpacing: 1,
            boxShadow: 'var(--tw-shadow-neon)',
          }}
        >
          {localLoading ? t('workers.running', 'Ejecutando...') : t('workers.run_button', 'Ejecutar')}
        </Button>
        {results.length > 0 && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography
              variant="subtitle1"
              className="text-light-accent dark:text-dark-accent"
              sx={{ mb: 1, fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}
            >
              {t('workers.results', 'Resultados de ejecución:')}
            </Typography>
            <Stack spacing={1}>
              {results.map((res, idx) => (
                <Paper
                  key={idx}
                  elevation={0}
                  className="bg-light-surface-secondary dark:bg-dark-surface-secondary"
                  sx={{
                    p: 1.5,
                    borderRadius: '1rem',
                    fontFamily: 'Poppins, Inter, sans-serif',
                    color: res.status === 'success'
                      ? 'var(--matrix-green)'
                      : 'var(--vanellix-purple)',
                    border: res.status === 'success'
                      ? '1.5px solid var(--matrix-green)'
                      : '1.5px solid var(--vanellix-purple)',
                    background: 'inherit',
                  }}
                >
                  <Typography variant="body2">
                    <b>{res.worker}:</b> {res.status} {res.message ? `- ${res.message}` : ''}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default WorkersView;
