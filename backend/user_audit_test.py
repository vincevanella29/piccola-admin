import asyncio
from pymongo import MongoClient

def audit_test():
    client = MongoClient("mongodb://localhost:27017")
    db = client["piccola_italia"] # Check the db name in vanellix setup
    
    # Let's inspect ONE user and ONE trabajador
    t = db.trabajadores_vpn.find_one({"activo": 1})
    u = db.users.find_one()
    
    print("Worker:", t.get("rut") if t else "None", t.get("cargo") if t else "-")
    print("User fields:", u.keys() if u else "None")

audit_test()
