from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any
from datetime import datetime

# Identity semantics: prefer wallet (lowercased) when present; otherwise privy_id (Privy sub)

class ChatSessionStartRequest(BaseModel):
    # Optional, backend will infer from verify_session
    metadata: Optional[Dict[str, Any]] = None

class ChatSessionStartResponse(BaseModel):
    conv_id: int
    mode: Literal["bot", "human"] = "bot"
    status: Literal["open", "closed"] = "open"

class ChatMessageRequest(BaseModel):
    conv_id: int
    text: str = Field(..., min_length=1, max_length=5000)
    metadata: Optional[Dict[str, Any]] = None

class AdminReplyRequest(BaseModel):
    text: str

class AdminToggleRequest(BaseModel):
    # For future extensibility
    reason: Optional[str] = None

class ChatMessageOut(BaseModel):
    _id: str
    conv_id: int
    role: Literal["user", "assistant", "system", "admin"]
    text: str
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    # Optional sender identity enrichment
    sender_wallet: Optional[str] = None
    sender_privy_id: Optional[str] = None
    # Optional minimal profile snapshot
    sender_profile: Optional[Dict[str, Any]] = None
    # Optional display fields for UI convenience
    sender_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None

class ConversationOut(BaseModel):
    conv_id: int
    status: Literal["open", "closed"]
    mode: Literal["bot", "human"]
    assigned_admin: Optional[str] = None
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    updated_at: datetime
    # Optional enrichment for UI
    user_profile: Optional[Dict[str, Any]] = None
    user_promotions: Optional[Dict[str, Any]] = None

class AdminConversationListItem(BaseModel):
    conv_id: int
    last_text: Optional[str] = None
    status: Literal["open", "closed"]
    mode: Literal["bot", "human"]
    assigned_admin: Optional[str] = None
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    updated_at: datetime
    # Optional enrichment for admin list
    user_profile: Optional[Dict[str, Any]] = None
    user_promotions: Optional[Dict[str, Any]] = None


class AdminParticipantOut(BaseModel):
    role: Literal["user", "admin", "assistant"]
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
