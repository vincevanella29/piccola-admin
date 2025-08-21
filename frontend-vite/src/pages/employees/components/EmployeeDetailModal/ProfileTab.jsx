import React from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  Divider,
  Tooltip,
  Tabs,
  Tab,
  Grid,
} from '@mui/material';
import {
  Person,
  Email,
  Phone,
  LocationOn,
  Work,
  CalendarToday,
  Height,
  Scale,
  Checkroom,
  DirectionsRun,
  Business,
  Badge,
} from '@mui/icons-material';

const isBlank = (v) => v === null || v === undefined || v === '' || v === 0;
const display = (v) => (isBlank(v) ? '—' : String(v));

const fmtCLP = (n) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const compactNumber = (n) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '')}b`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(abs)}`;
};
const money = (n = 0) => `$${compactNumber(Number(n) || 0)}`;

const ProfileRow = ({ label, value, tooltip, icon: Icon }) => (
  <Stack
    direction="row"
    alignItems="center"
    spacing={1}
    sx={{ py: 0.75, transition: 'background 0.2s', '&:hover': { background: 'rgba(255,255,255,0.05)' } }}
  >
    <Icon fontSize="small" className="text-light-text-secondary dark:text-dark-text-secondary" />
    <Typography
      variant="body2"
      className="text-light-text-secondary dark:text-dark-text-secondary flex-1"
    >
      {label}
    </Typography>
    {tooltip ? (
      <Tooltip title={tooltip} arrow>
        <Typography
          variant="body2"
          fontWeight={600}
          className="text-light-text-primary dark:text-dark-text-primary"
        >
          {display(value)}
        </Typography>
      </Tooltip>
    ) : (
      <Typography
        variant="body2"
        fontWeight={600}
        className="text-light-text-primary dark:text-dark-text-primary"
      >
        {display(value)}
      </Typography>
    )}
  </Stack>
);

const SectionTitle = ({ children }) => (
  <Typography
    variant="h6"
    fontWeight={800}
    className="text-light-text-primary dark:text-dark-text-primary font-futurist tracking-wide"
    sx={{ letterSpacing: 0.5 }}
  >
    {children}
  </Typography>
);

const StatusChip = ({ label, color = 'default' }) => (
  <Chip
    size="small"
    label={label}
    className={`${
      color === 'success'
        ? 'text-matrix-green bg-matrix-green/20'
        : color === 'error'
        ? 'text-vanellix-purple bg-vanellix-purple/20'
        : 'text-light-text-secondary dark:text-dark-text-secondary bg-light-surface-secondary/30 dark:bg-dark-surface-secondary/30'
    }`}
    sx={{ height: 22, borderRadius: '9999px', fontWeight: 600 }}
  />
);

const MobileSection = ({ title, children }) => (
  <Box className="rounded-2xl border border-light-accent/25 dark:border-dark-accent/25 bg-light-surface/60 dark:bg-dark-surface/60 shadow-neon">
    <Box sx={{ p: 2 }}>
      <SectionTitle>{title}</SectionTitle>
      <Divider sx={{ my: 1, opacity: 0.25 }} />
      {children}
    </Box>
  </Box>
);

const ProfileTab = ({ t, emp }) => {
  const name =
    [emp?.nombres, emp?.apellidopaterno, emp?.apellidomaterno]
      .filter(Boolean)
      .join(' ') || t('employees.table.unknown');
  const rut = emp?.rut_str || emp?.rut || '—';
  const sexoMap = {
    f: t('employees.profile.gender.female') || 'Femenino',
    m: t('employees.profile.gender.male') || 'Masculino',
  };
  const sexo = sexoMap[String(emp?.sexo || '').toLowerCase()] || (t('employees.profile.gender.other') || 'Otro');
  const netPrev = emp?.payroll?.previous?.net || 0;
  const netAnte = emp?.payroll?.anteprevious?.net || 0;
  const delta = netAnte > 0 ? ((netPrev - netAnte) / netAnte) * 100 : netPrev > 0 ? 100 : null;

  const [tab, setTab] = React.useState(0);

  return (
    <Paper
      variant="outlined"
      className="bg-light-surface/60 dark:bg-dark-surface/60 border border-light-accent/30 dark:border-dark-accent/30 rounded-3xl p-4 shadow-neon"
    >
      {/* Header Card */}
      <Box
        className="rounded-2xl bg-gradient-to-r from-light-accent/10 to-dark-accent/10 p-3 mb-3"
        sx={{ border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography
            variant="h5"
            fontWeight={800}
            className="text-light-text-primary dark:text-dark-text-primary font-futurist tracking-wide"
          >
            {name}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {emp?.activo ? (
              <StatusChip label={t('employees.profile.active') || 'Activo'} color="success" />
            ) : (
              <StatusChip label={t('employees.profile.inactive') || 'Inactivo'} />
            )}
            {emp?.nongrata ? (
              <StatusChip label={t('employees.profile.blacklisted') || 'No grata'} color="error" />
            ) : null}
            {emp?.rutbloqueado ? (
              <StatusChip label={t('employees.profile.rut_blocked') || 'RUT bloqueado'} color="error" />
            ) : null}
            {emp?.ficha_privada ? (
              <StatusChip label={t('employees.profile.private_file') || 'Ficha privada'} />
            ) : null}
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
          <Typography
            variant="caption"
            className="text-light-text-secondary dark:text-dark-text-secondary"
          >
            {t('employees.payroll.columns.total_paid') || 'Total sueldo'}:
          </Typography>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            className="text-matrix-green font-futurist"
          >
            {money(emp?.payroll?.totals?.total || 0)}
          </Typography>
          <Divider flexItem orientation="vertical" sx={{ mx: 1, opacity: 0.3 }} />
          <Typography
            variant="caption"
            className="text-light-text-secondary dark:text-dark-text-secondary"
          >
            {t('employees.payroll.columns.net_previous') || 'Líquido (anterior)'}:
          </Typography>
          <Tooltip title={fmtCLP(netPrev)} arrow>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              className="text-light-text-primary dark:text-dark-text-primary"
            >
              {money(netPrev)}
            </Typography>
          </Tooltip>
          {delta !== null && (
            <>
              <Divider flexItem orientation="vertical" sx={{ mx: 1, opacity: 0.3 }} />
              <Chip
                size="small"
                label={`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1).replace(/\.0$/, '')}%`}
                className={`${
                  delta >= 0 ? 'text-matrix-green bg-matrix-green/20' : 'text-vanellix-purple bg-vanellix-purple/20'
                } font-futurist font-bold`}
                sx={{ height: 22, borderRadius: '9999px' }}
              />
            </>
          )}
        </Stack>
      </Box>

      {/* Desktop Layout */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <MobileSection title={t('employees.profile.section.personal') || 'Personal'}>
              <ProfileRow
                label={t('employees.table.name') || 'Nombre'}
                value={name}
                icon={Person}
              />
              <ProfileRow
                label={t('employees.table.rut') || 'RUT'}
                value={rut}
                icon={Badge}
              />
              <ProfileRow
                label={t('employees.profile.gender') || 'Sexo'}
                value={sexo}
                icon={Person}
              />
              <ProfileRow
                label={t('employees.profile.nationality') || 'Nacionalidad'}
                value={emp?.nacionalidad}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.birthdate') || 'Nacimiento'}
                value={emp?.fechanacimiento}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.civil_status') || 'Estado civil'}
                value={emp?.estadocivil}
                icon={Person}
              />
            </MobileSection>
          </Grid>
          <Grid item xs={12} md={6}>
            <MobileSection title={t('employees.profile.section.contact') || 'Contacto'}>
              <ProfileRow
                label={t('employees.profile.email') || 'Email'}
                value={emp?.email || emp?.correo}
                icon={Email}
              />
              <ProfileRow
                label={t('employees.profile.phone1') || 'Teléfono 1'}
                value={emp?.telefonouno && emp?.telefonouno !== 0 ? emp.telefonouno : '—'}
                icon={Phone}
              />
              <ProfileRow
                label={t('employees.profile.phone2') || 'Teléfono 2'}
                value={emp?.telefonodos && emp?.telefonodos !== 0 ? emp.telefonodos : '—'}
                icon={Phone}
              />
              <ProfileRow
                label={t('employees.profile.address') || 'Dirección'}
                value={emp?.direccion}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.district') || 'Comuna'}
                value={emp?.comuna}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.city') || 'Ciudad'}
                value={emp?.ciudad}
                icon={LocationOn}
              />
            </MobileSection>
          </Grid>
          <Grid item xs={12} md={6}>
            <MobileSection title={t('employees.profile.section.employment') || 'Laboral'}>
              <ProfileRow
                label={t('employees.table.cargo') || 'Cargo'}
                value={emp?.cargo}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.table.sucursal') || 'Sucursal'}
                value={emp?.sucursal}
                icon={Business}
              />
              <ProfileRow
                label={t('employees.table.ingreso') || 'Ingreso'}
                value={emp?.fechaingreso}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.exit') || 'Retiro'}
                value={emp?.fecharetiro}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.salary') || 'Sueldo'}
                value={money(emp?.sueldo)}
                tooltip={fmtCLP(emp?.sueldo)}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.afp') || 'AFP'}
                value={emp?.afp}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.isapre') || 'Isapre'}
                value={emp?.isapre}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.with_contract') || 'Con contrato'}
                value={emp?.concontrato ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.with_payroll') || 'Con liquidación'}
                value={emp?.conliquidacion ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')}
                icon={Work}
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {emp?.centro_costo_cod ? (
                  <Chip
                    size="small"
                    label={`${t('employees.profile.cost_center_prefix') || 'CC'} ${emp.centro_costo_cod}`}
                    className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary"
                    sx={{ height: 22, borderRadius: '9999px' }}
                  />
                ) : null}
                {emp?.centro_costo ? (
                  <Chip
                    size="small"
                    label={emp.centro_costo}
                    className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary"
                    sx={{ height: 22, borderRadius: '9999px' }}
                  />
                ) : null}
              </Box>
            </MobileSection>
          </Grid>
          <Grid item xs={12} md={6}>
            <MobileSection title={t('employees.profile.section.status') || 'Estado'}>
              <ProfileRow
                label={t('employees.profile.created_at') || 'Creación'}
                value={emp?.fechacreacion}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.company_id') || 'ID empresa'}
                value={emp?.id_empresa}
                icon={Business}
              />
              <ProfileRow
                label={t('employees.profile.internal_id') || 'ID interno'}
                value={emp?.id}
                icon={Badge}
              />
            </MobileSection>
            <Box sx={{ mt: 2 }} />
            <MobileSection title={t('employees.profile.section.measurements') || 'Medidas'}>
              <ProfileRow
                label={t('employees.profile.height') || 'Estatura'}
                value={emp?.estatura}
                icon={Height}
              />
              <ProfileRow
                label={t('employees.profile.weight') || 'Peso'}
                value={emp?.peso}
                icon={Scale}
              />
              <ProfileRow
                label={t('employees.profile.size') || 'Talla'}
                value={emp?.talla}
                icon={Checkroom}
              />
              <ProfileRow
                label={t('employees.profile.shoe') || 'Zapato'}
                value={emp?.zapato}
                icon={DirectionsRun}
              />
            </MobileSection>
          </Grid>
        </Grid>
      </Box>

      {/* Mobile Layout with Tabs */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
        <Box
          className="rounded-2xl border border-light-accent/25 dark:border-dark-accent/25 bg-light-surface/60 dark:bg-dark-surface/60 shadow-neon"
          sx={{ mb: 1 }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            TabIndicatorProps={{ sx: { backgroundColor: 'var(--light-accent, #009246)' } }}
            sx={{
              '& .MuiTab-root': { minHeight: 36, px: 1, color: 'var(--light-text-secondary, #999)' },
              '& .Mui-selected': { color: 'var(--light-text-primary, #fff) !important' },
            }}
          >
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Person fontSize="small" />
                  <Typography variant="caption" className="font-futurist">
                    {t('employees.profile.section.personal') || 'Personal'}
                  </Typography>
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Email fontSize="small" />
                  <Typography variant="caption" className="font-futurist">
                    {t('employees.profile.section.contact') || 'Contacto'}
                  </Typography>
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Work fontSize="small" />
                  <Typography variant="caption" className="font-futurist">
                    {t('employees.profile.section.employment') || 'Laboral'}
                  </Typography>
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Badge fontSize="small" />
                  <Typography variant="caption" className="font-futurist">
                    {t('employees.profile.section.status') || 'Estado'}
                  </Typography>
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Height fontSize="small" />
                  <Typography variant="caption" className="font-futurist">
                    {t('employees.profile.section.measurements') || 'Medidas'}
                  </Typography>
                </Stack>
              }
            />
          </Tabs>
        </Box>

        <Stack spacing={1}>
          {tab === 0 && (
            <MobileSection title={t('employees.profile.section.personal') || 'Personal'}>
              <ProfileRow
                label={t('employees.table.name') || 'Nombre'}
                value={name}
                icon={Person}
              />
              <ProfileRow
                label={t('employees.table.rut') || 'RUT'}
                value={rut}
                icon={Badge}
              />
              <ProfileRow
                label={t('employees.profile.gender') || 'Sexo'}
                value={sexo}
                icon={Person}
              />
              <ProfileRow
                label={t('employees.profile.nationality') || 'Nacionalidad'}
                value={emp?.nacionalidad}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.birthdate') || 'Nacimiento'}
                value={emp?.fechanacimiento}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.civil_status') || 'Estado civil'}
                value={emp?.estadocivil}
                icon={Person}
              />
            </MobileSection>
          )}
          {tab === 1 && (
            <MobileSection title={t('employees.profile.section.contact') || 'Contacto'}>
              <ProfileRow
                label={t('employees.profile.email') || 'Email'}
                value={emp?.email || emp?.correo}
                icon={Email}
              />
              <ProfileRow
                label={t('employees.profile.phone1') || 'Teléfono 1'}
                value={emp?.telefonouno && emp?.telefonouno !== 0 ? emp.telefonouno : '—'}
                icon={Phone}
              />
              <ProfileRow
                label={t('employees.profile.phone2') || 'Teléfono 2'}
                value={emp?.telefonodos && emp?.telefonodos !== 0 ? emp.telefonodos : '—'}
                icon={Phone}
              />
              <ProfileRow
                label={t('employees.profile.address') || 'Dirección'}
                value={emp?.direccion}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.district') || 'Comuna'}
                value={emp?.comuna}
                icon={LocationOn}
              />
              <ProfileRow
                label={t('employees.profile.city') || 'Ciudad'}
                value={emp?.ciudad}
                icon={LocationOn}
              />
            </MobileSection>
          )}
          {tab === 2 && (
            <MobileSection title={t('employees.profile.section.employment') || 'Laboral'}>
              <ProfileRow
                label={t('employees.table.cargo') || 'Cargo'}
                value={emp?.cargo}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.table.sucursal') || 'Sucursal'}
                value={emp?.sucursal}
                icon={Business}
              />
              <ProfileRow
                label={t('employees.table.ingreso') || 'Ingreso'}
                value={emp?.fechaingreso}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.exit') || 'Retiro'}
                value={emp?.fecharetiro}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.salary') || 'Sueldo'}
                value={money(emp?.sueldo)}
                tooltip={fmtCLP(emp?.sueldo)}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.afp') || 'AFP'}
                value={emp?.afp}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.isapre') || 'Isapre'}
                value={emp?.isapre}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.with_contract') || 'Con contrato'}
                value={emp?.concontrato ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')}
                icon={Work}
              />
              <ProfileRow
                label={t('employees.profile.with_payroll') || 'Con liquidación'}
                value={emp?.conliquidacion ? (t('common.yes') || 'Sí') : (t('common.no') || 'No')}
                icon={Work}
              />
              <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {emp?.centro_costo_cod ? (
                  <Chip
                    size="small"
                    label={`${t('employees.profile.cost_center_prefix') || 'CC'} ${emp.centro_costo_cod}`}
                    className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary"
                    sx={{ height: 22, borderRadius: '9999px' }}
                  />
                ) : null}
                {emp?.centro_costo ? (
                  <Chip
                    size="small"
                    label={emp.centro_costo}
                    className="bg-light-surface-secondary/40 dark:bg-dark-surface-secondary/40 text-light-text-secondary dark:text-dark-text-secondary"
                    sx={{ height: 22, borderRadius: '9999px' }}
                  />
                ) : null}
              </Box>
            </MobileSection>
          )}
          {tab === 3 && (
            <MobileSection title={t('employees.profile.section.status') || 'Estado'}>
              <ProfileRow
                label={t('employees.profile.created_at') || 'Creación'}
                value={emp?.fechacreacion}
                icon={CalendarToday}
              />
              <ProfileRow
                label={t('employees.profile.company_id') || 'ID empresa'}
                value={emp?.id_empresa}
                icon={Business}
              />
              <ProfileRow
                label={t('employees.profile.internal_id') || 'ID interno'}
                value={emp?.id}
                icon={Badge}
              />
            </MobileSection>
          )}
          {tab === 4 && (
            <MobileSection title={t('employees.profile.section.measurements') || 'Medidas'}>
              <ProfileRow
                label={t('employees.profile.height') || 'Estatura'}
                value={emp?.estatura}
                icon={Height}
              />
              <ProfileRow
                label={t('employees.profile.weight') || 'Peso'}
                value={emp?.peso}
                icon={Scale}
              />
              <ProfileRow
                label={t('employees.profile.size') || 'Talla'}
                value={emp?.talla}
                icon={Checkroom}
              />
              <ProfileRow
                label={t('employees.profile.shoe') || 'Zapato'}
                value={emp?.zapato}
                icon={DirectionsRun}
              />
            </MobileSection>
          )}
        </Stack>
      </Box>
    </Paper>
  );
};

export default ProfileTab;