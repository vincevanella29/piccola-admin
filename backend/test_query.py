from utils.web3mongo import db

empleados = list(db.empleados_usuarios.find({}, {"rut": 1, "wallet": 1, "sub": 1, "email": 1, "_id": 0}))
print(f"Total empleados_usuarios: {len(empleados)}")

active_workers = list(db.trabajadores_vpn.find({"activo": 1}, {"rut": 1, "_id": 0}))
print(f"Total trabajadores_vpn activos: {len(active_workers)}")

emp_ruts_str = set(str(e.get("rut")).strip() for e in empleados if e.get("rut"))
worker_ruts_str = set(str(w.get("rut")).strip() for w in active_workers if w.get("rut"))

print(f"Ruts in empleados but not in active workers: {len(emp_ruts_str - worker_ruts_str)}")

