import { useMemo } from 'react';

// Helper para acceder a valores anidados de forma segura (ej: 'sales.total')
const getNestedValue = (obj, path) => path.split('.').reduce((o, k) => (o || {})[k], obj);

// Función principal para calcular las estadísticas de un KPI específico
const calculateKpiStats = (kpiKey, selectedEmployee, allEmployees) => {
    // 1. Filtrar para incluir solo a los competidores
    const allCompetitors = allEmployees.filter(e => e.es_competidor === true);
    
    const local = selectedEmployee.local;
    const competitorsInLocal = allCompetitors.filter(e => e.local === local);

    const getStatsForGroup = (group) => {
        if (!group || group.length === 0) {
            return { topPerformer: null, topValue: 0, average: 0 };
        }
        
        let topPerformer = group[0];
        let topValue = getNestedValue(topPerformer.latest_kpi, kpiKey) || 0;
        let sum = 0;

        for (const employee of group) {
            const currentValue = getNestedValue(employee.latest_kpi, kpiKey) || 0;
            if (currentValue > topValue) {
                topValue = currentValue;
                topPerformer = employee;
            }
            sum += currentValue;
        }

        return {
            topPerformer,
            topValue,
            average: sum / group.length
        };
    };

    const companyStats = getStatsForGroup(allCompetitors);
    const localStats = getStatsForGroup(competitorsInLocal);

    const yourValue = getNestedValue(selectedEmployee.latest_kpi, kpiKey) || 0;
    
    // El puesto ya viene en la data, lo usamos directamente.
    const kpiCategory = kpiKey.split('.')[0];
    const puestoEmpresa = getNestedValue(selectedEmployee.latest_kpi, `${kpiCategory}.puesto_empresa`);
    const puestoLocal = getNestedValue(selectedEmployee.latest_kpi, `${kpiCategory}.puesto_local`);

    return {
        yourValue,
        puestoEmpresa,
        puestoLocal,
        promedioEmpresa: companyStats.average,
        topEmpresa: companyStats.topPerformer,
        topEmpresaValue: companyStats.topValue, // Devolvemos el valor máximo
        promedioLocal: localStats.average,
        topLocal: localStats.topPerformer,
        topLocalValue: localStats.topValue, // Devolvemos el valor máximo
    };
};


export const useKpiBenchmarks = (selectedEmployee, allEmployees) => {
    return useMemo(() => {
        if (!selectedEmployee || !allEmployees || allEmployees.length === 0) {
            return {};
        }

        const kpiKeys = {
            sales: 'sales.total',
            total_mesas: 'total_mesas.valor',
            promedio_por_mesa: 'promedio_por_mesa.valor',
            personas_atendidas: 'personas_atendidas.valor',
            promedio_por_persona: 'promedio_por_persona.valor',
        };

        const benchmarks = {};
        for (const [name, key] of Object.entries(kpiKeys)) {
            benchmarks[name] = calculateKpiStats(key, selectedEmployee, allEmployees);
        }

        return benchmarks;

    }, [selectedEmployee, allEmployees]);
};

