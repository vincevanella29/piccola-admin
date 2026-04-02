import re
from typing import Dict, Any, List

def patch_get_kpis():
    with open("apis/admin_merit_rankings.py", "r", encoding="utf-8") as f:
        content = f.read()

    # We will inject the helpers at the start of _get_kpis_dynamic
    injection = """
    category = _get_template_category(template_key)
    params   = (rule or {}).get("params") or {}
    period_mode = params.get("period_mode", "month")
    year = (periodo_dash or "")[:4]

    def _monthly_or_yearly(col, base_query, is_times=False):
        if period_mode == "month":
            return list(col.find(base_query))
            
        # YEAR MODE => Aggregate
        from collections import defaultdict
        year_query = dict(base_query)
        year_query["periodo"] = {"$regex": f"^{year}-"}
        docs_raw = list(col.find(year_query))
        
        by_rut = defaultdict(lambda: {
            "local": "", "es_competidor": True, "sales_total": 0, "personas": 0, "mesas": 0,
            "dias": 0, "pvd_sum": 0, "pvd_cnt": 0, "days_admin": 0,
            "cats": defaultdict(lambda: {"qty": 0, "amt": 0}), "items": defaultdict(lambda: {"qty": 0, "amt": 0}),
            # times stuff
            "tiempos_dias": 0, "tiempos_seg_sum": 0, "samples_tot": 0, "tiempos_samples": 0,
            "breakdowns": {
                "center": defaultdict(lambda: {"slug": "", "avg_sum": 0, "dias": 0, "samples": 0}),
                "family": defaultdict(lambda: {"fam": "", "avg_sum": 0, "dias": 0, "samples": 0}),
                "subfamily": defaultdict(lambda: {"fam": "", "subfam": "", "avg_sum": 0, "dias": 0, "samples": 0})
            }
        })
        for d in docs_raw:
            r = str(d.get("rut", ""))
            b = by_rut[r]
            b["local"] = d.get("local") or b["local"]
            
            s = d.get("sales") or {}
            b["sales_total"] += float(s.get("total") or 0)
            b["personas"] += float((d.get("personas_atendidas") or {}).get("valor") or 0)
            b["mesas"] += float((d.get("total_mesas") or {}).get("valor") or 0)
            b["days_admin"] += int(d.get("days_present_admin") or 0)
            
            pvd = d.get("promedio_venta_diaria") or {}
            b["dias"] += int(pvd.get("dias_con_venta") or pvd.get("dias") or 0)
            v = float(pvd.get("valor") or pvd.get("avg_diario") or 0)
            if v > 0:
                b["pvd_sum"] += v; b["pvd_cnt"] += 1
                
            for cat in (d.get("sales_by_category") or []):
                k = f"{cat.get('familia') or ''}|{cat.get('subfamilia') or ''}"
                b["cats"][k]["qty"] += float(cat.get("cantidad") or 0)
                b["cats"][k]["amt"] += float(cat.get("total") or 0)
            for itm in (d.get("sales_by_item") or []):
                k = f"{itm.get('sku') or ''}|{itm.get('nombre') or ''}"
                b["items"][k]["qty"] += float(itm.get("cantidad") or 0)
                b["items"][k]["amt"] += float(itm.get("total") or 0)
                
            if is_times:
                b["samples_tot"] += float(d.get("samples_total") or 0)
                t = d.get("tiempos") or {}
                b["tiempos_samples"] += float(t.get("samples_share") or 0)
                td = float(t.get("dias_con_registro") or 1)
                b["tiempos_dias"] += td
                b["tiempos_seg_sum"] += float(t.get("avg_seg") or 0) * td
                for bc in (d.get("by_centro") or []):
                    k = bc.get("centro_slug") or ""
                    b["breakdowns"]["center"][k]["slug"] = k
                    bc_d = float(bc.get("dias_con_registro") or 1)
                    b["breakdowns"]["center"][k]["dias"] += bc_d
                    b["breakdowns"]["center"][k]["avg_sum"] += float(bc.get("avg_seg") or 0) * bc_d
                    b["breakdowns"]["center"][k]["samples"] += float(bc.get("samples_total") or 0)
                for bc in (d.get("by_familia") or []):
                    k = bc.get("familia") or ""
                    b["breakdowns"]["family"][k]["fam"] = k
                    bc_d = float(bc.get("dias_con_registro") or 1)
                    b["breakdowns"]["family"][k]["dias"] += bc_d
                    b["breakdowns"]["family"][k]["avg_sum"] += float(bc.get("avg_seg") or 0) * bc_d
                    b["breakdowns"]["family"][k]["samples"] += float(bc.get("samples_total") or 0)
                for bc in (d.get("by_subfamilia") or []):
                    k = f"{bc.get('familia') or ''}|{bc.get('subfamilia') or ''}"
                    b["breakdowns"]["subfamily"][k]["fam"] = bc.get("familia") or ""
                    b["breakdowns"]["subfamily"][k]["subfam"] = bc.get("subfamilia") or ""
                    bc_d = float(bc.get("dias_con_registro") or 1)
                    b["breakdowns"]["subfamily"][k]["dias"] += bc_d
                    b["breakdowns"]["subfamily"][k]["avg_sum"] += float(bc.get("avg_seg") or 0) * bc_d
                    b["breakdowns"]["subfamily"][k]["samples"] += float(bc.get("samples_total") or 0)

        res = []
        for r, b in by_rut.items():
            doc = {"rut": r, "local": b["local"], "es_competidor": b["es_competidor"], "sales": {"total": b["sales_total"]}, "days_present_admin": b["days_admin"]}
            pm = b["sales_total"] / b["mesas"] if b["mesas"] > 0 else 0
            doc["promedio_por_mesa"] = {"valor": pm}
            pp = b["sales_total"] / b["personas"] if b["personas"] > 0 else 0
            doc["promedio_por_persona"] = {"valor": pp}
            doc["personas_atendidas"] = {"valor": b["personas"]}
            doc["total_mesas"] = {"valor": b["mesas"]}
            avg_d = b["pvd_sum"] / b["pvd_cnt"] if b["pvd_cnt"] > 0 else 0
            doc["promedio_venta_diaria"] = {"valor": avg_d, "dias_con_venta": b["dias"]}
            
            s_by_cat = [{"familia": k.split("|")[0], "subfamilia": k.split("|")[1], "cantidad": v["qty"], "total": v["amt"]} for k, v in b["cats"].items()]
            s_by_item = [{"sku": k.split("|")[0], "nombre": k.split("|")[1], "cantidad": v["qty"], "total": v["amt"]} for k, v in b["items"].items()]
            doc["sales_by_category"] = s_by_cat
            doc["sales_by_item"] = s_by_item
            
            if is_times:
                doc["samples_total"] = b["samples_tot"]
                avg_tb = b["tiempos_seg_sum"] / b["tiempos_dias"] if b["tiempos_dias"] > 0 else 0
                doc["tiempos"] = {"avg_seg": avg_tb, "samples_share": b["tiempos_samples"]}
                
                doc["by_centro"] = [{"centro_slug": v["slug"], "avg_seg": v["avg_sum"]/v["dias"] if v["dias"]>0 else 0, "samples_total": v["samples"], "dias_con_registro": v["dias"]} for k, v in b["breakdowns"]["center"].items()]
                doc["by_familia"] = [{"familia": v["fam"], "avg_seg": v["avg_sum"]/v["dias"] if v["dias"]>0 else 0, "samples_total": v["samples"], "dias_con_registro": v["dias"]} for k, v in b["breakdowns"]["family"].items()]
                doc["by_subfamilia"] = [{"familia": v["fam"], "subfamilia": v["subfam"], "avg_seg": v["avg_sum"]/v["dias"] if v["dias"]>0 else 0, "samples_total": v["samples"], "dias_con_registro": v["dias"]} for k, v in b["breakdowns"]["subfamily"].items()]
                
            res.append(doc)
        return res
"""

    content = re.sub(
        r'category = _get_template_category\(template_key\)\n\s+params\s+= \(rule or {}\)\.get\("params"\) or {}',
        injection,
        content
    )

    # 1. Ventas empleado
    content = content.replace(
        'docs = list(KPIS_EMP.find(\n            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},\n            {"rut": 1, "local": 1, "sales": 1, "promedio_por_mesa": 1,\n             "personas_atendidas": 1, "total_mesas": 1, "promedio_por_persona": 1,\n             "promedio_venta_diaria": 1, "es_competidor": 1}\n        ))',
        'docs = _monthly_or_yearly(KPIS_EMP, {"periodo": periodo_dash, "rut": {"$in": ruts_query}})'
    )

    # 2. Ventas top category
    content = content.replace(
        'docs = list(coll_sales.find(\n            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},\n            {"rut": 1, "local": 1, "sales": 1, "sales_by_category": 1, "sales_by_item": 1, "es_competidor": 1}\n        ))',
        'docs = _monthly_or_yearly(coll_sales, {"periodo": periodo_dash, "rut": {"$in": ruts_query}})'
    )

    # 3. Ventas admin ranking
    content = content.replace(
        'docs = list(coll_s.find(\n            {"periodo": periodo_dash, "rut": {"$in": ruts_query}},\n            {"rut": 1, "local": 1, "sales": 1, "promedio_por_mesa": 1,\n             "promedio_por_persona": 1, "promedio_venta_diaria": 1, "personas_atendidas": 1,\n             "total_mesas": 1, "days_present_admin": 1, "es_competidor": 1}\n        ))',
        'docs = _monthly_or_yearly(coll_s, {"periodo": periodo_dash, "rut": {"$in": ruts_query}})'
    )

    # 4. Tiempos empleado
    content = content.replace(
        'docs_t = list(db.kpis_tiempos_empleado_mensual.find(\n            {"periodo": periodo_dash, "rut": {"$in": ruts_query}, "es_competidor": True}, proj\n        ))',
        'docs_t = _monthly_or_yearly(db.kpis_tiempos_empleado_mensual, {"periodo": periodo_dash, "rut": {"$in": ruts_query}, "es_competidor": True}, is_times=True)'
    )

    with open("apis/admin_merit_rankings.py", "w", encoding="utf-8") as f:
        f.write(content)
    
patch_get_kpis()
