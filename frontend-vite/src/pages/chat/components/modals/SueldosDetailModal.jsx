import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DataTable from '../common/DataTable';

const SueldosDetailModal = ({ open, onClose, payload }) => {
  if (!open) return null;
  const title = payload?.title || 'Detalle de sueldos';
  const columns = payload?.columns || [];
  const rows = payload?.rows || [];
  const kpis = payload?.kpis || [];
  const totals = payload?.totals || null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" className="text-light-text-primary dark:text-dark-text-primary">
          {title}
        </Typography>
        <IconButton aria-label="close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {Array.isArray(rows) && rows.length > 0 ? (
          <DataTable
            title={null}
            subtitle={null}
            kpis={kpis}
            columns={columns}
            rows={rows}
            totals={totals}
            charts={null}
            compact={true}
          />
        ) : (
          <Box sx={{ py: 3 }}>
            <Typography variant="body2" className="text-light-text-secondary dark:text-dark-text-secondary">
              Sin datos para mostrar.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SueldosDetailModal;
