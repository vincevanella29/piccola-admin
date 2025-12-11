from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import logging
from datetime import datetime, timezone
from utils.auth.session import verify_session
from utils.web3mongo import db, w3  # Import w3 for address validation
from firebase_admin import messaging
from utils.r2_upload import upload_profile_image_to_r2
from config.gamification.profile_services import (
    resolve_employee_from_session,
    normalize_employee_birthdate,
    user_profile_summary,
)

router = APIRouter()
logger = logging.getLogger(__name__)

class UserProfileCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    twitter: Optional[str] = None
    discord: Optional[str] = None
    instagram: Optional[str] = None  # Reemplazado github por instagram
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None  # URL pública de Cloudflare R2
    additional_socials: Optional[Dict[str, str]] = None  # Para otras redes como facebook, tiktok, etc.
    favorite_location: Optional[str] = None  # ID del local favorito (de db.locations)
    liked_products: Optional[Dict[str, bool]] = None  # {menu_option_id: true/false} para likes en productos
    birthdate: Optional[str] = None
    subscribe_news: Optional[bool] = None
    public_profile: Optional[bool] = None
    public_name: Optional[bool] = None
    public_birthdate: Optional[bool] = None

class UserProfileResponse(BaseModel):
    wallet: str
    name: Optional[str]
    email: Optional[str]
    twitter: Optional[str]
    discord: Optional[str]
    instagram: Optional[str]
    bio: Optional[str]
    profile_image_url: Optional[str]
    additional_socials: Optional[Dict[str, str]]
    favorite_location: Optional[str]
    liked_products: Optional[Dict[str, bool]]
    birthdate: Optional[str]
    subscribe_news: Optional[bool]
    public_profile: Optional[bool]
    public_name: Optional[bool]
    public_birthdate: Optional[bool]
    created_at: Optional[str]  # Hacer optional para defaults
    updated_at: Optional[str]  # Hacer optional para defaults
    merit_profile: Optional[Dict[str, Any]] = None

class TokenData(BaseModel):
    amount: float
    company_id: Optional[int]
    type: str
    imagePath: Optional[str] = None  # <-- Para exponer imagePath en balances y burns

class CommunityRankingResponse(BaseModel):
    wallet: str
    profile: Optional[UserProfileResponse]
    completion_percentage: float
    balances: Dict[str, TokenData]
    burns: Dict[str, TokenData]
    updated_at: str

# Enviar notificación FCM (opcional)
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

@router.post("/community_users/profile", response_model=UserProfileResponse)
async def create_or_update_profile(
    profile: UserProfileCreate = Body(...),
    user: dict = Depends(verify_session)
):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    current_time = datetime.now(timezone.utc)
    # Usar el modelo directamente
    profile_data = profile.dict(exclude_unset=True)

    # Si el usuario está vinculado a una ficha de empleado, no permitimos que
    # el endpoint de comunidad sobrescriba nombre/email/fecha de nacimiento,
    # ya que esos datos vienen del sistema de RRHH (trabajadores_vpn).
    emp_ctx = resolve_employee_from_session(user)
    if emp_ctx:
        for field in ["name", "email", "birthdate"]:
            profile_data.pop(field, None)
    update_data = {
        **profile_data,
        "updated_at": current_time
    }
    # Determine filter by wallet or privy_id
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    existing_profile = db.user_profiles.find_one(filter_q)
    if not existing_profile:
        update_data["created_at"] = current_time
        if wallet_lower:
            update_data["wallet"] = wallet_lower
        update_data["privy_id"] = sub
        update_data.setdefault("public_profile", False)
        update_data.setdefault("public_name", False)
        update_data.setdefault("public_birthdate", False)
    else:
        # Ensure wallet is updated when present
        if wallet_lower:
            update_data["wallet"] = wallet_lower
    # Si liked_products se envía, mergear con existing para no sobreescribir todo
    if "liked_products" in profile_data and existing_profile and "liked_products" in existing_profile:
        update_data["liked_products"] = {**existing_profile["liked_products"], **profile_data["liked_products"]}
    result = db.user_profiles.update_one(
        filter_q,
        {"$set": update_data},
        upsert=True
    )
    updated_profile = db.user_profiles.find_one(filter_q)
    if not updated_profile:
        raise HTTPException(status_code=500, detail="Failed to create/update profile")
    
    response_data = {
        "wallet": updated_profile.get("wallet", ""),
        "name": updated_profile.get("name"),
        "email": updated_profile.get("email"),
        "twitter": updated_profile.get("twitter"),
        "discord": updated_profile.get("discord"),
        "instagram": updated_profile.get("instagram"),
        "bio": updated_profile.get("bio"),
        "profile_image_url": updated_profile.get("profile_image_url") if "profile_image_url" in updated_profile else None,
        "additional_socials": updated_profile.get("additional_socials"),
        "favorite_location": updated_profile.get("favorite_location"),
        "liked_products": updated_profile.get("liked_products"),
        "birthdate": updated_profile.get("birthdate"),
        "subscribe_news": updated_profile.get("subscribe_news"),
        "public_profile": updated_profile.get("public_profile", False),
        "public_name": updated_profile.get("public_name", False),
        "public_birthdate": updated_profile.get("public_birthdate", False),
        "created_at": updated_profile["created_at"].isoformat(),
        "updated_at": updated_profile["updated_at"].isoformat()
    }
    
    # Optional: Send notification
    # await send_fcm_notification(...)
    
    return response_data

@router.get("/community_users/profile", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None

    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    profile = db.user_profiles.find_one(filter_q)

    # Enriquecer con ficha de empleado si existe vínculo
    emp_ctx = resolve_employee_from_session(user)
    emp_name = None
    emp_email = None
    emp_birthdate = None
    if emp_ctx:
        emp = emp_ctx.get("emp") or {}
        nombres = (emp.get("nombres") or "").strip()
        ap_p = (emp.get("apellidopaterno") or "").strip()
        emp_name = " ".join(p for p in [nombres, ap_p] if p).strip() or None
        emp_email = (emp.get("correo") or emp.get("email") or "").strip() or None
        emp_birthdate = normalize_employee_birthdate(emp.get("fechanacimiento"))

    # Perfil de méritos usando user_profile_summary
    merit_profile = None
    if wallet:
        try:
            merit_profile = user_profile_summary(wallet)
        except Exception as e:
            logger.exception(f"Error fetching merit profile for wallet {wallet}: {e}")
            merit_profile = {"ok": False, "error": str(e)}

    if not profile:
        # Return defaults if not found
        current_time_iso = datetime.now(timezone.utc).isoformat()
        response_data = {
            "wallet": wallet_lower or "",
            "name": emp_name,
            "email": emp_email,
            "twitter": None,
            "discord": None,
            "instagram": None,
            "bio": None,
            "profile_image_url": None,
            "additional_socials": None,
            "favorite_location": None,
            "liked_products": None,
            "birthdate": emp_birthdate,
            "subscribe_news": None,
            "public_profile": False,
            "public_name": False,
            "public_birthdate": False,
            "created_at": current_time_iso,
            "updated_at": current_time_iso,
            "merit_profile": merit_profile,
        }
        return response_data
    
    response_data = {
        "wallet": profile.get("wallet", ""),
        "name": emp_name if emp_name else profile.get("name"),
        "email": emp_email if emp_email else profile.get("email"),
        "twitter": profile.get("twitter"),
        "discord": profile.get("discord"),
        "instagram": profile.get("instagram"),
        "bio": profile.get("bio"),
        "profile_image_url": profile.get("profile_image_url") if "profile_image_url" in profile else None,
        "additional_socials": profile.get("additional_socials"),
        "favorite_location": profile.get("favorite_location"),
        "liked_products": profile.get("liked_products"),
        "birthdate": emp_birthdate if emp_birthdate else profile.get("birthdate"),
        "subscribe_news": profile.get("subscribe_news"),
        "public_profile": profile.get("public_profile", False),
        "public_name": profile.get("public_name", False),
        "public_birthdate": profile.get("public_birthdate", False),
        "created_at": profile["created_at"].isoformat(),
        "updated_at": profile["updated_at"].isoformat(),
        "merit_profile": merit_profile,
    }
    
    return response_data

@router.get("/community_users/public_profiles", response_model=List[UserProfileResponse])
async def get_public_profiles():
    profiles = db.user_profiles.find({"public_profile": True})
    response = []
    for profile in profiles:
        # Hide sensitive fields
        response_data = {
            "wallet": profile.get("wallet", ""),
            "name": profile.get("name") if profile.get("public_name", False) else "Anonymous",
            "email": None,  # Always hide
            "twitter": profile.get("twitter"),
            "discord": profile.get("discord"),
            "instagram": profile.get("instagram"),
            "bio": profile.get("bio"),
            "profile_image_url": profile.get("profile_image_url") if "profile_image_url" in profile else None,
            "additional_socials": profile.get("additional_socials"),
            "favorite_location": profile.get("favorite_location"),
            "liked_products": profile.get("liked_products"),
            "birthdate": profile.get("birthdate") if profile.get("public_birthdate", False) else None,
            "subscribe_news": None,  # Hide
            "public_profile": profile.get("public_profile", False),
            "public_name": profile.get("public_name", False),
            "public_birthdate": profile.get("public_birthdate", False),
            "created_at": profile["created_at"].isoformat(),
            "updated_at": profile["updated_at"].isoformat()
        }
        response.append(response_data)
    return response

@router.get("/community_users/profile/{wallet}", response_model=UserProfileResponse)
async def get_public_profile(wallet: str):
    if not w3.is_address(wallet):
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    
    wallet_lower = wallet.lower()
    profile = db.user_profiles.find_one({"wallet": wallet_lower})
    if not profile or not profile.get("public_profile", False):
        raise HTTPException(status_code=404, detail="Profile not found or not public")
    
    response_data = {
        "wallet": profile.get("wallet", wallet_lower),
        "name": profile.get("name") if profile.get("public_name", False) else "Anonymous",
        "email": None,  # Always hide
        "twitter": profile.get("twitter"),
        "discord": profile.get("discord"),
        "instagram": profile.get("instagram"),
        "bio": profile.get("bio"),
        "profile_image_url": profile.get("profile_image_url") if "profile_image_url" in profile else None,
        "additional_socials": profile.get("additional_socials"),
        "favorite_location": profile.get("favorite_location"),
        "liked_products": profile.get("liked_products"),
        "birthdate": profile.get("birthdate") if profile.get("public_birthdate", False) else None,
        "subscribe_news": None,  # Hide
        "public_profile": profile.get("public_profile", False),
        "public_name": profile.get("public_name", False),
        "public_birthdate": profile.get("public_birthdate", False),
        "created_at": profile["created_at"].isoformat(),
        "updated_at": profile["updated_at"].isoformat()
    }
    
    return response_data

@router.get("/community_users/rankings", response_model=List[CommunityRankingResponse])
async def get_community_rankings():
    rankings = db.community_rankings.find({})
    response = []
    def is_true(val):
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.lower() == "true"
        return False

    for rank in rankings:
        profile_data = rank.get("profile")
        if profile_data and is_true(profile_data.get("public_profile", False)):
            # Filter profile
            filtered_profile = {
                "wallet": rank["wallet"],
                "name": profile_data.get("name") if is_true(profile_data.get("public_name", False)) else "Anonymous",
                "email": None,  # Always hide
                "twitter": profile_data.get("twitter"),
                "discord": profile_data.get("discord"),
                "instagram": profile_data.get("instagram"),
                "bio": profile_data.get("bio"),
                "profile_image_url": profile_data.get("profile_image_url"),
                "additional_socials": profile_data.get("additional_socials"),
                "favorite_location": profile_data.get("favorite_location"),
                "liked_products": profile_data.get("liked_products"),
                "birthdate": profile_data.get("birthdate") if is_true(profile_data.get("public_birthdate", False)) else None,
                "subscribe_news": None,  # Hide
                "public_profile": profile_data.get("public_profile", False),
                "public_name": profile_data.get("public_name", False),
                "public_birthdate": profile_data.get("public_birthdate", False),
                "created_at": profile_data["created_at"].isoformat(),
                "updated_at": profile_data["updated_at"].isoformat()
            }
        else:
            filtered_profile = None

        response_data = {
            "wallet": rank["wallet"],
            "profile": filtered_profile,
            "completion_percentage": rank["completion_percentage"],
            "balances": rank["balances"],
            "burns": rank["burns"],
            "updated_at": rank["updated_at"].isoformat()
        }
        response.append(response_data)
    return response

class ToggleUpdate(BaseModel):
    field: str
    value: bool

@router.put("/community_users/toggle")
async def toggle_field(data: ToggleUpdate, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    
    allowed_fields = ["subscribe_news", "public_profile", "public_name", "public_birthdate"]
    if data.field not in allowed_fields:
        raise HTTPException(status_code=400, detail="Invalid field")
    
    current_time = datetime.now(timezone.utc)
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    result = db.user_profiles.update_one(
        filter_q,
        {"$set": {data.field: data.value, "updated_at": current_time}}
    )

    if result.matched_count == 0:
        # If no profile, create one with the update
        insert_data = {
            "privy_id": sub,
            data.field: data.value,
            "created_at": current_time,
            "updated_at": current_time
        }
        if wallet_lower:
            insert_data["wallet"] = wallet_lower
        # Set defaults for other toggles
        for field in allowed_fields:
            if field not in insert_data:
                insert_data[field] = False
        db.user_profiles.insert_one(insert_data)

    return {"success": True, "field": data.field, "value": data.value}

# Endpoints rápidos para updates atómicos (para front rápido)
class ProfileImageUpdate(BaseModel):
    profile_image_url: str

@router.put("/community_users/profile_image")
async def update_profile_image(
    profile_image: UploadFile = File(...),
    user: dict = Depends(verify_session)
):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    current_time = datetime.now(timezone.utc)
    # Subida de imagen
    ext = profile_image.filename.split('.')[-1].lower()
    filename = f"profile_{sub}_{int(current_time.timestamp())}.{ext}"
    url = upload_profile_image_to_r2(profile_image.file, filename)
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    result = db.user_profiles.update_one(filter_q, {"$set": {"profile_image_url": url, "updated_at": current_time}})
    if result.matched_count == 0:
        db.user_profiles.insert_one({
            "privy_id": sub,
            **({"wallet": wallet_lower} if wallet_lower else {}),
            "profile_image_url": url,
            "created_at": current_time,
            "updated_at": current_time
        })
    return {"success": True, "profile_image_url": url}

class FavoriteLocationUpdate(BaseModel):
    location_id: str

@router.put("/community_users/favorite_location")
async def update_favorite_location(data: FavoriteLocationUpdate, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    
    current_time = datetime.now(timezone.utc)
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    result = db.user_profiles.update_one(filter_q, {"$set": {"favorite_location": data.location_id, "updated_at": current_time}})
    
    if result.matched_count == 0:
        # If no profile, create one with the update
        db.user_profiles.insert_one({
            "privy_id": sub,
            **({"wallet": wallet_lower} if wallet_lower else {}),
            "favorite_location": data.location_id,
            "created_at": current_time,
            "updated_at": current_time
        })
    
    return {"success": True, "favorite_location": data.location_id}

class ProductLikeUpdate(BaseModel):
    product_id: str
    like: bool

@router.put("/community_users/like_product")
async def update_product_like(data: ProductLikeUpdate, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    
    current_time = datetime.now(timezone.utc)
    update_key = f"liked_products.{data.product_id}"
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    result = db.user_profiles.update_one(filter_q, {"$set": {update_key: data.like, "updated_at": current_time}})
    
    if result.matched_count == 0:
        # If no profile, create one with the update
        db.user_profiles.insert_one({
            "privy_id": sub,
            **({"wallet": wallet_lower} if wallet_lower else {}),
            "liked_products": {data.product_id: data.like},
            "created_at": current_time,
            "updated_at": current_time
        })
    
    return {"success": True, "product_id": data.product_id, "like": data.like}

class ProfileFieldUpdate(BaseModel):
    field: str
    value: Optional[str]

@router.put("/community_users/profile_field")
async def update_profile_field(data: ProfileFieldUpdate, user: dict = Depends(verify_session)):
    wallet = user.get("wallet")
    sub = user.get("sub")
    wallet_lower = wallet.lower() if wallet else None
    
    allowed_fields = ["name", "email", "twitter", "discord", "instagram", "bio", "birthdate"]
    if data.field not in allowed_fields:
        raise HTTPException(status_code=400, detail=f"Invalid field. Allowed fields: {', '.join(allowed_fields)}")
    
    current_time = datetime.now(timezone.utc)
    update_data = {
        data.field: data.value,
        "updated_at": current_time
    }
    filter_q = {"wallet": wallet_lower} if wallet_lower else {"privy_id": sub}
    result = db.user_profiles.update_one(filter_q, {"$set": update_data}, upsert=True)
    
    if result.matched_count == 0 and result.upserted_id:
        # If upserted, set default values for other fields
        update_data["privy_id"] = sub
        if wallet_lower:
            update_data["wallet"] = wallet_lower
        update_data["created_at"] = current_time
        update_data["public_profile"] = False
        update_data["public_name"] = False
        update_data["public_birthdate"] = False
        update_data["subscribe_news"] = False
        db.user_profiles.update_one(filter_q, {"$set": update_data})
    
    updated_profile = db.user_profiles.find_one(filter_q)
    if not updated_profile:
        raise HTTPException(status_code=500, detail="Failed to update profile")
    
    response_data = {
        "success": True,
        "field": data.field,
        "value": data.value,
        "updated_at": updated_profile["updated_at"].isoformat()
    }
    
    return response_data