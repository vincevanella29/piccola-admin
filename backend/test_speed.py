import time
from utils.web3mongo import db

start = time.time()
workers = list(db.trabajadores_vpn.find({}, {"rut": 1, "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1, "cargo": 1, "sucursal": 1, "activo": 1, "_id": 0}))
print("Time to fetch 16k:", time.time() - start)
print("Amount:", len(workers))
