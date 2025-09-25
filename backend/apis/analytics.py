import logging
from utils.auth.session import verify_session
from utils.web3mongo import db
from config.roles.service import verify_admin
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()

@router.get("/db/collections")
async def list_collections(user: dict = Depends(verify_session)):
    if not verify_admin(user):
        raise HTTPException(status_code=403, detail="Only admins can view collections, wn")
    collections = db.list_collection_names()
    return {"collections": collections}

@router.get("/db/{collection}")
async def get_collection_data(collection: str, user: dict = Depends(verify_session)):
    if not verify_admin(user):
        raise HTTPException(status_code=403, detail="Only admins can view data, wn")
    if collection not in db.list_collection_names():
        raise HTTPException(status_code=404, detail="Collection not found, wn")
    data = list(db[collection].find({}, {"_id": 0}))
    return {"data": data}