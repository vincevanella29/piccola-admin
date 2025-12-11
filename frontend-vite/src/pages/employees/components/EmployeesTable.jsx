import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import useEmpleadosCache from '../../../hooks/useEmpleadosCache';
import EmployeeDetailModal from './EmployeeDetailModal';
import EmployeesToolbar from './ui/EmployeesToolbar';
import KPIStat from '../../../components/widgets/KPIStat';
import MobileEmployeesList from './ui/MobileEmployeesList';
import DesktopEmployeesTable from './ui/DesktopEmployeesTable';
import GenderDonutWidget from '../../../components/widgets/GenderDonutWidget';
import StackedBarWidget from '../../../components/widgets/StackedBarWidget';
import BranchAveragesWidget from '../../../components/widgets/BranchAveragesWidget';


const EmployeesTable = ({ appState }) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width:960px)'); // md- para cards, md+ tabla

  const { loadTrabajadoresActivos, loading, error } = useEmpleadosCache(appState);

  const [q, setQ] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [cargo, setCargo] = useState('');
  const [seccion, setSeccion] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0); // 0-based
  const [pageSize, setPageSize] = useState(10); // 10 | 50 | 100
  const [selected, setSelected] = useState(null); // empleado seleccionado para modal

  // Debounce simple para la búsqueda
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 280);
    return () => clearTimeout(id);
  }, [q]);

  const fetchData = useCallback(async () => {
    const { items } = await loadTrabajadoresActivos({
      sucursal: sucursal || null,
      cargo: cargo || null,
      seccion: seccion || null,
      // fetch all to paginate client-side
      skip: 0,
      limit: 10000,
    });
    setRows(Array.isArray(items) ? items : []);
  }, [sucursal, cargo, seccion, loadTrabajadoresActivos]);

  const sucursalOptions = useMemo(() => {
    // 1) Tomar SIGLAs permitidas desde appState.allowed
    const allowedEmpresas = Array.isArray(appState?.allowed?.empresas)
      ? appState.allowed.empresas
      : [];
    const siglas = new Set();
    for (const e of allowedEmpresas) {
      for (const s of (e?.sucursales ?? [])) {
        if (s?.sigla) siglas.add(String(s.sigla));
      }
    }
    // 2) Fallback dev: si no hay allowed, usar lo observado en rows
    if (siglas.size === 0) {
      for (const r of rows) if (r?.sucursal) siglas.add(String(r.sucursal));
    }
    return Array.from(siglas).sort();
  }, [appState?.allowed?.empresas, rows]);

  useEffect(() => {
    // si hay exactamente 1 sucursal permitida y no hay selección, la usamos
    if (!sucursal && sucursalOptions.length === 1) {
      setSucursal(sucursalOptions[0]);
    }
    fetchData().catch(() => {});
  }, [fetchData, sucursal, sucursalOptions]);

  // Resetear a primera página cuando cambian filtros o query
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, sucursal, cargo, seccion]);

  const cargoOptions = useMemo(() => {
    const set = new Set();
    for (const r of rows) if (r?.cargo) set.add(String(r.cargo));
    return Array.from(set).sort();
  }, [rows]);
  const seccionOptions = useMemo(() => {
    const set = new Set();
    for (const r of rows) if (r?.seccion) set.add(String(r.seccion));
    return Array.from(set).sort();
  }, [rows]);

  // Helpers para normalizar textos (quita acentos, símbolos, espacios) y rut
  const norm = useCallback((v) => {
    return (v ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);
  const normRut = useCallback((v) => (v ?? '').toString().toLowerCase().replace(/[^0-9kK]/g, ''), []);

  // Filtro local por nombre, rut, sucursal, cargo, email
  const filteredRows = useMemo(() => {
    const termRaw = (debouncedQ || '').toString();
    const term = norm(termRaw);
    const termRut = normRut(termRaw);
    // server already filters sucursal/cargo/seccion if provided; keep local text/rut/email
    if (!term) return rows;
    return rows.filter((r) => {
      const name = norm([r?.nombres, r?.apellidopaterno, r?.apellidomaterno].filter(Boolean).join(' '));
      const rut = normRut(r?.rut);
      const suc = norm(r?.sucursal);
      const crg = norm(r?.cargo);
      const sec = norm(r?.seccion);
      const eml = norm(r?.email || r?.correo);
      return name.includes(term) || suc.includes(term) || crg.includes(term) || sec.includes(term) || eml.includes(term) || (termRut && rut.includes(termRut));
    });
  }, [rows, debouncedQ, norm, normRut]);

  // Global payroll KPIs (previous vs anteprevious). Current month is ignored per request
  const { kpiPrevTotal, kpiAnteTotal, kpiDeltaPct } = useMemo(() => {
    let prev = 0;
    let ante = 0;
    for (const r of filteredRows) {
      const p = r?.payroll;
      if (p?.previous?.total) prev += Number(p.previous.total) || 0;
      if (p?.anteprevious?.total) ante += Number(p.anteprevious.total) || 0;
    }
    const deltaPct = ante > 0 ? ((prev - ante) / ante) * 100 : null;
    return { kpiPrevTotal: prev, kpiAnteTotal: ante, kpiDeltaPct: deltaPct };
  }, [filteredRows]);

  // --- KPIs por sucursal: promedios ---
  const branchStats = useMemo(() => {
    const map = new Map();
    for (const r of filteredRows) {
      const key = (r?.sucursal ?? '').toString().trim();
      const sueldo = Number(r?.sueldo) || 0;
      if (!map.has(key)) map.set(key, { count: 0, salarySum: 0, salaryCount: 0 });
      const obj = map.get(key);
      obj.count += 1;
      if (sueldo > 0) { obj.salarySum += sueldo; obj.salaryCount += 1; }
    }
    // Excluir claves vacías de branches efectivos
    const branches = Array.from(map.entries()).filter(([k]) => k && k !== '-');
    const branchesCount = branches.length;
    const totalEmployees = filteredRows.length;
    const avgEmpPerBranch = branchesCount > 0 ? totalEmployees / branchesCount : 0;

    // Promedio de sueldo por sucursal (promedio de promedios por sucursal con datos)
    let sumBranchAverages = 0, branchesWithSalary = 0;
    for (const [, v] of branches) {
      if (v.salaryCount > 0) {
        sumBranchAverages += v.salarySum / v.salaryCount;
        branchesWithSalary += 1;
      }
    }
    const avgSalaryPerBranch = branchesWithSalary > 0 ? (sumBranchAverages / branchesWithSalary) : 0;

    return { branchesCount, avgEmpPerBranch, avgSalaryPerBranch };
  }, [filteredRows]);

  const fmtCLP = useMemo(() => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }), []);

  // Paginación: la maneja DesktopEmployeesTable internamente

  // --- KPIs extra: género y edades ---
  const { genderStats, ageStats, headcountStats } = useMemo(() => {
    const total = filteredRows.length;
    let f = 0, m = 0, o = 0;
    const ranges = [
      { key: '<25', min: -Infinity, max: 24, count: 0 },
      { key: '25-34', min: 25, max: 34, count: 0 },
      { key: '35-44', min: 35, max: 44, count: 0 },
      { key: '45-54', min: 45, max: 54, count: 0 },
      { key: '55+', min: 55, max: Infinity, count: 0 },
    ];
    let withContract = 0, withPayroll = 0;

    const today = new Date();
    const calcAge = (d) => {
      if (!d) return null;
      const dt = new Date(d);
      if (isNaN(dt)) return null;
      let age = today.getFullYear() - dt.getFullYear();
      const mth = today.getMonth() - dt.getMonth();
      if (mth < 0 || (mth === 0 && today.getDate() < dt.getDate())) age--;
      return age;
    };

    for (const r of filteredRows) {
      const sx = String(r?.sexo || '').toLowerCase();
      if (sx === 'f') f++; else if (sx === 'm') m++; else o++;

      const age = calcAge(r?.fechanacimiento);
      if (age !== null) {
        for (const rng of ranges) {
          if (age >= rng.min && age <= rng.max) { rng.count++; break; }
        }
      }

      if (r?.concontrato) withContract++;
      if (r?.conliquidacion) withPayroll++;
    }

    const pct = (n) => (total > 0 ? (n / total) * 100 : 0);

    return {
      genderStats: {
        total,
        f, m, o,
        fPct: pct(f), mPct: pct(m), oPct: pct(o),
      },
      ageStats: {
        total,
        ranges,
      },
      headcountStats: {
        total,
        withContract,
        withPayroll,
      },
    };
  }, [filteredRows]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }} className="text-light-text-primary dark:text-dark-text-primary">
      {/* KPIs enriquecidos: Género, Edades, Totales sueldo, Headcount */}
      <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {/* KPI Género */}
        <GenderDonutWidget
          title={t('employees.profile.gender') || 'Género'}
          total={genderStats.total}
          data={[
            { key: 'f', label: t('employees.profile.gender.female') || 'Mujeres', count: genderStats.f, color: '#e91e63' },
            { key: 'm', label: t('employees.profile.gender.male') || 'Hombres', count: genderStats.m, color: '#1976d2' },
            { key: 'o', label: t('employees.profile.gender.other') || 'Otro', count: genderStats.o, color: '#9e9e9e' },
          ]}
        />


        {/* KPI Edades (stacked bar) */}
        <StackedBarWidget
          title={t('employees.profile.section.measurements') || 'Edades'}
          totalLabel={t('employees.total') || 'Total'}
          total={ageStats.total}
          ranges={ageStats.ranges.map((r) => ({ key: r.key, label: r.key, count: r.count }))}
        />


        {/* KPI Sueldos (prev vs ante) */}
        <KPIStat
          label={t('employees.payroll.period_previous') || 'Mes pasado (Total)'}
          value={fmtCLP.format(kpiPrevTotal)}
          deltaPct={kpiDeltaPct}
          goodWhenUp={true}
        />


        {/* KPI Promedios por sucursal */}
        <BranchAveragesWidget
          title={t('employees.table.sucursal') || 'Sucursal'}
          branchesCount={branchStats.branchesCount}
          totalLabel={t('employees.total') || 'Total'}
          avgEmployeesLabel={t('employees.kpi.avg_employees_per_branch') || 'Prom. empleados/sucursal'}
          avgSalaryLabel={t('employees.kpi.avg_salary_per_branch') || 'Prom. sueldo/sucursal'}
          avgEmpPerBranch={branchStats.avgEmpPerBranch}
          avgSalaryPerBranch={branchStats.avgSalaryPerBranch}
          formatCurrency={(n) => fmtCLP.format(n)}
        />
      </Box>
      <EmployeesToolbar
        t={t}
        q={q}
        setQ={setQ}
        sucursal={sucursal}
        setSucursal={setSucursal}
        sucursalOptions={sucursalOptions}
        cargo={cargo}
        setCargo={setCargo}
        cargoOptions={cargoOptions}
        seccion={seccion}
        setSeccion={setSeccion}
        seccionOptions={seccionOptions}
        loading={loading}
        error={error}
        onRefresh={fetchData}
      />

      {/* Vista adaptativa */}
      {isMobile ? (
        <MobileEmployeesList
          items={filteredRows}
          loading={loading}
          t={t}
          onSelect={(emp) => setSelected(emp)}
        />
      ) : (
        <DesktopEmployeesTable
          items={filteredRows}
          loading={loading}
          t={t}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          onSelect={(emp) => setSelected(emp)}
        />
      )}

      {/* Modal detalle empleado (HUD KPIs) */}
      <EmployeeDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        emp={selected}
        appState={appState}
      />
    </Box>
  );
};

export default EmployeesTable;
