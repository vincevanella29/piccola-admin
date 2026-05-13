from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
import uuid
from datetime import datetime, timezone
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.web3mongo import db
from firebase_admin import messaging


router = APIRouter()
logger = logging.getLogger(__name__)

# Modelos Pydantic
class ColorCreate(BaseModel):
    name: str
    value: str

class ColorResponse(BaseModel):
    id: str
    name: str
    value: str
    created_at: str
    updated_at: str
    created_by: str

class ColorLevelCreate(BaseModel):
    level: int  # Ej: 0, 1, 2
    minTokens: float  # Mínimo de tokens requeridos
    tokenAddress: str  # Dirección del contrato ERC20
    colors: Dict[str, Dict[str, str]]  # Ej: {"dark": {"dark-background": "#0A0A0A"}, "light": {"light-background": "#F5F5F5"}}

class ColorLevelResponse(BaseModel):
    id: str
    level: int
    minTokens: float
    tokenAddress: str
    colors: Dict[str, Dict[str, str]]
    created_at: str
    updated_at: str
    created_by: str


# Enviar notificación FCM
async def send_fcm_notification(title: str, body: str, target_type: str, target_value: str):
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            topic=target_value if target_type == "topic" else None,
            token=target_value if target_type == "user" else None,
        )
        response = messaging.send(message)
        return response
    except Exception as e:
        logger.error(f"Error sending FCM notification: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error sending notification: {str(e)}")

# CRUD Colores
@router.post("/colors", response_model=ColorResponse)
async def create_color(data: ColorCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    color = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "value": data.value,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["wallet"],
    }
    db.colors.insert_one(color)
    color["created_at"] = color["created_at"].isoformat()
    color["updated_at"] = color["updated_at"].isoformat()
    color.pop("_id", None)

    await send_fcm_notification(
        title="Color Added in Club della Nonna",
        body=f"Color '{data.name}' added with value '{data.value}'.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return color

@router.get("/colors", response_model=List[ColorResponse])
async def get_colors():
    try:
        colors = list(db.colors.find({}))
        for color in colors:
            color["id"] = color["id"]
            color["created_at"] = color["created_at"].isoformat()
            color["updated_at"] = color["updated_at"].isoformat()
            color.pop("_id", None)
        return colors
    except Exception as e:
        logger.error(f"Error fetching colors: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching colors")

@router.put("/colors/{color_id}", response_model=ColorResponse)
async def update_color(color_id: str, data: ColorCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    color = db.colors.find_one({"id": color_id})
    if not color:
        raise HTTPException(status_code=404, detail="Color not found")
    
    update_data = {
        "name": data.name,
        "value": data.value,
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["wallet"],
    }
    db.colors.update_one({"id": color_id}, {"$set": update_data})
    update_data["id"] = color_id
    update_data["created_at"] = color["created_at"].isoformat()
    update_data["updated_at"] = update_data["updated_at"].isoformat()

    await send_fcm_notification(
        title="Color Updated in Club della Nonna",
        body=f"Color '{data.name}' updated to '{data.value}'.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return update_data

@router.delete("/colors/{color_id}")
async def delete_color(color_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    color = db.colors.find_one({"id": color_id})
    if not color:
        raise HTTPException(status_code=404, detail="Color not found")
    
    db.colors.delete_one({"id": color_id})

    await send_fcm_notification(
        title="Color Deleted in Club della Nonna",
        body=f"Color '{color['name']}' deleted.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return {"success": True, "message": "Color deleted"}

# CRUD Niveles de Color
@router.post("/color_levels", response_model=ColorLevelResponse)
async def create_color_level(data: ColorLevelCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    level = {
        "id": str(uuid.uuid4()),
        "level": data.level,
        "minTokens": data.minTokens,
        "tokenAddress": data.tokenAddress,
        "colors": data.colors,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["wallet"],
    }
    db.color_levels.insert_one(level)
    level["created_at"] = level["created_at"].isoformat()
    level["updated_at"] = level["updated_at"].isoformat()
    level.pop("_id", None)

    await send_fcm_notification(
        title="Color Level Added",
        body=f"Level {data.level} added with min {data.minTokens} tokens at {data.tokenAddress}.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return level

@router.get("/color_levels", response_model=List[ColorLevelResponse])
async def get_color_levels():
    try:
        levels = list(db.color_levels.find({}).sort("level", 1))
        for level in levels:
            level["id"] = level["id"]
            level["created_at"] = level["created_at"].isoformat()
            level["updated_at"] = level["updated_at"].isoformat()
            level.pop("_id", None)
        return levels
    except Exception as e:
        logger.error(f"Error fetching color levels: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching color levels")

@router.put("/color_levels/{level_id}", response_model=ColorLevelResponse)
async def update_color_level(level_id: str, data: ColorLevelCreate, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    level = db.color_levels.find_one({"id": level_id})
    if not level:
        raise HTTPException(status_code=404, detail="Color level not found")
    
    update_data = {
        "level": data.level,
        "minTokens": data.minTokens,
        "tokenAddress": data.tokenAddress,
        "colors": data.colors,
        "updated_at": datetime.now(timezone.utc),
        "created_by": user["wallet"],
    }
    db.color_levels.update_one({"id": level_id}, {"$set": update_data})
    update_data["id"] = level_id
    update_data["created_at"] = level["created_at"].isoformat()
    update_data["updated_at"] = update_data["updated_at"].isoformat()

    await send_fcm_notification(
        title="Color Level Updated",
        body=f"Level {data.level} updated with min {data.minTokens} tokens at {data.tokenAddress}.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return update_data

@router.delete("/color_levels/{level_id}")
async def delete_color_level(level_id: str, user: dict = Depends(verify_session)):
    require_admin_level(user, "admin")
    level = db.color_levels.find_one({"id": level_id})
    if not level:
        raise HTTPException(status_code=404, detail="Color level not found")
    
    db.color_levels.delete_one({"id": level_id})

    await send_fcm_notification(
        title="Color Level Deleted",
        body=f"Level {level['level']} deleted.",
        target_type="topic",
        target_value="club_della_nonna_updates",
    )

    return {"success": True, "message": "Color level deleted"}