import logging
from main import verify_session
from utils.web3mongo import db
from apis.roles import get_company_role_level
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter()

@router.get("/db/collections")
async def list_collections(user: dict = Depends(verify_session)):
    # Obtener el nivel de rol directamente en el endpoint
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4, 5]:
        raise HTTPException(status_code=403, detail="Only admins can view collections, wn")
    collections = db.list_collection_names()
    return {"collections": collections}

@router.get("/db/{collection}")
async def get_collection_data(collection: str, user: dict = Depends(verify_session)):
    # Obtener el nivel de rol directamente en el endpoint
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4, 5]:
        raise HTTPException(status_code=403, detail="Only admins can view data, wn")
    if collection not in db.list_collection_names():
        raise HTTPException(status_code=404, detail="Collection not found, wn")
    data = list(db[collection].find({}, {"_id": 0}))
    return {"data": data}