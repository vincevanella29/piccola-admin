def agg_sales(docs):
    from collections import defaultdict
    by_rut = defaultdict(lambda: {
        "local": "", "es_competidor": False, "sales_total": 0, "personas": 0, "mesas": 0, "dias": 0, "pvd_sum": 0, "pvd_cnt": 0
    })
    for d in docs:
        r = str(d.get("rut", ""))
        b = by_rut[r]
        b["local"] = d.get("local") or b["local"]
        b["es_competidor"] = bool(d.get("es_competidor") or b["es_competidor"])
        
        s = d.get("sales") or {}
        b["sales_total"] += float(s.get("total") or 0)
        
        b["personas"] += int((d.get("personas_atendidas") or {}).get("valor") or 0)
        b["mesas"] += int((d.get("total_mesas") or {}).get("valor") or 0)
        
        pvd = d.get("promedio_venta_diaria") or {}
        b["dias"] += int(pvd.get("dias_con_venta") or pvd.get("dias") or 0)
        
        v = float(pvd.get("valor") or pvd.get("avg_diario") or 0)
        if v > 0:
            b["pvd_sum"] += v
            b["pvd_cnt"] += 1

    res = []
    for r, b in by_rut.items():
        doc = {
            "rut": r, "local": b["local"], "es_competidor": b["es_competidor"],
            "sales": {"total": b["sales_total"]},
            "personas_atendidas": {"valor": b["personas"]},
            "total_mesas": {"valor": b["mesas"]},
        }
        pm = b["sales_total"] / b["mesas"] if b["mesas"] > 0 else 0
        doc["promedio_por_mesa"] = {"valor": pm}
        
        pp = b["sales_total"] / b["personas"] if b["personas"] > 0 else 0
        doc["promedio_por_persona"] = {"valor": pp}
        
        avg_d = b["pvd_sum"] / b["pvd_cnt"] if b["pvd_cnt"] > 0 else 0
        doc["promedio_venta_diaria"] = {"valor": avg_d, "dias_con_venta": b["dias"]}
        res.append(doc)
    return res
