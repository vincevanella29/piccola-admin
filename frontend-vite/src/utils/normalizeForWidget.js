import dayjs from 'dayjs';

// helper simple
const pick = (obj, keys, def = undefined) => {
  for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  return def;
};

export function normalizeForWidget(
  raw,
  {
    preferLabelKey = 'resumen2',
    labelFallbacks = ['resumen2', 'resumen', 'local', 'sigla', 'nombre_cuenta'],
    preferValueKey = 'total',
    valueFallbacks = ['total', 'total_cargo', 'cargo', 'abono', 'subtotal'],
    dateKeys = ['fecha', 'fecha_pago', 'fecha_emision'],
    type = 'generic',
    getName = (d) => pick(d, ['glosa', 'nombre_cuenta', 'local'], 'Detalle'),
    getDescription = (d) => pick(d, ['detalle', 'descripcion', 'nombre_cuenta_resultado'], ''),
  } = {}
) {
  // Para debug
  if (process.env.NODE_ENV === 'development') {
    console.debug('[normalizeForWidget] RAW length:', Array.isArray(raw) ? raw.length : (raw ? 1 : 0));
  }

  const getDate = (o) => {
    const dr = pick(o, dateKeys, null);
    return dr ? dayjs(dr).format('YYYY-MM-DD') : null;
  };

  const pushRow = (out, src, parentLabelHint = 'Sin etiqueta', parent = null) => {
    const date = getDate(src);
    if (!date) return; // sin fecha, descarto (igual que antes)
    const label = pick(src, [preferLabelKey, ...labelFallbacks], parentLabelHint ?? 'Sin etiqueta');
    const value = Number(pick(src, [preferValueKey, ...valueFallbacks], 0)) || 0;
    out.push({
      label,
      value,
      date,
      details: {
        name: getName(src),
        description: getDescription(src),
        type,
        data: src,
        parent,
      },
    });
  };

  const out = [];
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];

  for (const d of items) {
    // 1) Caso ventas agregadas: d.details es array de días
    if (Array.isArray(d?.details) && d.details.length) {
      const parentLabel = pick(d, [preferLabelKey, ...labelFallbacks], 'Sin etiqueta');
      d.details.forEach((it) => pushRow(out, it, parentLabel, d));
      continue;
    }

    // 2) Caso gastos: resumen_data -> tipo_gasto_data -> details
    if (Array.isArray(d?.resumen_data) && d.resumen_data.length) {
      const parentLabel = pick(d, [preferLabelKey, ...labelFallbacks], 'Sin etiqueta');
      for (const r of d.resumen_data) {
        const tg = Array.isArray(r?.tipo_gasto_data) ? r.tipo_gasto_data : [];
        for (const t of tg) {
          const dets = Array.isArray(t?.details) ? t.details : [];
          dets.forEach((it) => {
            // el detalle trae 'resumen2' normalmente; si no, cae al parentLabel
            pushRow(out, it, parentLabel || pick(r, [preferLabelKey, ...labelFallbacks], 'Sin etiqueta'), d);
          });
        }
      }
      continue;
    }

    // 3) Caso plano: fila con fecha/valor directo
    pushRow(out, d, pick(d, [preferLabelKey, ...labelFallbacks], 'Sin etiqueta'));
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[normalizeForWidget] OUTPUT length:', out.length);
  }
  return out;
}
