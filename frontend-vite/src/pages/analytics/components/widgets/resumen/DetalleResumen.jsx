import React from 'react';
import { Box, Typography, Divider, Table, TableBody, TableCell, TableRow, TableHead } from '@mui/material';

// Renderiza detalles de venta o gasto, con clima si hay
export default function DetalleResumen({ detalle, t }) {
  if (!detalle) return null;

  // Si viene envuelto en {details: {...}} desanidar
  const d = detalle.details?.data || detalle.details || detalle.data || detalle;
  const parent = detalle.details?.parent || detalle.parent;
  const clima = d?.clima;

  return (
    <Box p={2}>
      <Typography variant="h6" gutterBottom>{d.type === 'venta' ? t('analytics.Detalle Venta') : t('analytics.Detalle Gasto')}</Typography>
      <Box mb={1}>
        {detalle.dateLabel && (
          <Typography variant="subtitle2">{t('analytics.Fecha')}: <b>{detalle.dateLabel}</b></Typography>
        )}
        {detalle.series && (
          <Typography variant="subtitle2">{t('analytics.Local')}: <b>{detalle.series}</b></Typography>
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Table size="small">
        <TableBody>
          <TableRow>
            <TableCell>{t('analytics.Local')}</TableCell>
            <TableCell>{d.local}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>{t('analytics.Fecha')}</TableCell>
            <TableCell>{d.fecha}</TableCell>
          </TableRow>
          {d.type === 'venta' && (
            <>
              <TableRow>
                <TableCell>{t('analytics.Mesas')}</TableCell>
                <TableCell>{d.mesas}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Personas')}</TableCell>
                <TableCell>{d.personas}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Subtotal')}</TableCell>
                <TableCell>{d.subtotal?.toLocaleString('es-CL')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Descuentos')}</TableCell>
                <TableCell>{d.desctos?.toLocaleString('es-CL')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Total')}</TableCell>
                <TableCell>{d.total?.toLocaleString('es-CL')}</TableCell>
              </TableRow>
            </>
          )}
          {d.type === 'gasto' && (
            <>
              <TableRow>
                <TableCell>{t('analytics.Cuenta')}</TableCell>
                <TableCell>{d.cuenta}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Descripcion')}</TableCell>
                <TableCell>{d.descripcion}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Monto')}</TableCell>
                <TableCell>{d.monto?.toLocaleString('es-CL')}</TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
      {clima && (
        <Box mt={2}>
          <Typography variant="subtitle1" gutterBottom>{t('analytics.Clima')}</Typography>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell>{t('analytics.Temperatura Max')}</TableCell>
                <TableCell>{clima.temp_max}°C</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Temperatura Min')}</TableCell>
                <TableCell>{clima.temp_min}°C</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Temperatura Media')}</TableCell>
                <TableCell>{clima.temp_mean}°C</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Precipitacion')}</TableCell>
                <TableCell>{clima.precipitation_sum} mm</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Lluvia')}</TableCell>
                <TableCell>{clima.rain_sum} mm</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Nieve')}</TableCell>
                <TableCell>{clima.snowfall_sum} mm</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Estuvo Lloviendo')}</TableCell>
                <TableCell>{clima.was_raining ? t('analytics.Si') : t('analytics.No')}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>{t('analytics.Estuvo Nevando')}</TableCell>
                <TableCell>{clima.was_snowing ? t('analytics.Si') : t('analytics.No')}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
