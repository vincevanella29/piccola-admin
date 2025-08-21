export function normPeriodo(p) {
    if (p == null) return null;
    const s = String(p).trim();
    if (!s) return null;
    // Asegura YYYYMM de 6 dígitos
    return s.length === 6 ? s : s.replace(/\D/g, '').slice(0, 6);
  }
  
  export function normalizePayrollItem(it) {
    const periodo = normPeriodo(it?.periodo ?? it?.mesano ?? it?.mes_ano ?? it?.periodo_str);
    const liquido = Number(it?.sueldo_liquido_a_pago) || 0;
    const imponible = Number(it?.remuneracion_imponible) || 0;
    const noImponible = Number(it?.remuneracion_no_imponible) || 0;
    const total = Number(it?.remuneracion_total) || (imponible + noImponible);
    return { ...it, _periodo: periodo, _liquido: liquido, _imponible: imponible, _noImponible: noImponible, _total: total };
  }
  
  export function normalizeList(items = []) {
    return (items || []).map(normalizePayrollItem).filter(x => x._periodo);
  }
  
  export function sumField(items, key) {
    return (items || []).reduce((acc, x) => acc + (Number(x[key]) || 0), 0);
  }
  
  export function groupByPeriodo(items = []) {
    const out = new Map();
    for (const it of normalizeList(items)) {
      if (!out.has(it._periodo)) out.set(it._periodo, []);
      out.get(it._periodo).push(it);
    }
    return out;
  }
  
  export function buildComparison(currItems = [], prevItems = []) {
    const c = normalizeList(currItems);
    const p = normalizeList(prevItems);
  
    const curr = {
      liquido: sumField(c, '_liquido'),
      total:   sumField(c, '_total'),
      imponible: sumField(c, '_imponible'),
      noImponible: sumField(c, '_noImponible'),
      meses: Array.from(groupByPeriodo(c).keys()).length
    };
  
    const prev = {
      liquido: sumField(p, '_liquido'),
      total:   sumField(p, '_total'),
      imponible: sumField(p, '_imponible'),
      noImponible: sumField(p, '_noImponible'),
      meses: Array.from(groupByPeriodo(p).keys()).length
    };
  
    const delta = {
      liquido: curr.liquido - prev.liquido,
      total: curr.total - prev.total,
      imponible: curr.imponible - prev.imponible,
      noImponible: curr.noImponible - prev.noImponible,
    };
  
    const pct = {
      liquido: prev.liquido === 0 ? (curr.liquido > 0 ? 100 : 0) : ((curr.liquido - prev.liquido) / prev.liquido) * 100,
      total: prev.total === 0 ? (curr.total > 0 ? 100 : 0) : ((curr.total - prev.total) / prev.total) * 100,
      imponible: prev.imponible === 0 ? (curr.imponible > 0 ? 100 : 0) : ((curr.imponible - prev.imponible) / prev.imponible) * 100,
      noImponible: prev.noImponible === 0 ? (curr.noImponible > 0 ? 100 : 0) : ((curr.noImponible - prev.noImponible) / prev.noImponible) * 100,
    };
  
    return { curr, prev, delta, pct };
  }
  