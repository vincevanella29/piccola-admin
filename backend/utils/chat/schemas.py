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
    media_urls: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class AdminReplyRequest(BaseModel):
    text: str
    image_url: Optional[str] = None
    media_urls: Optional[List[str]] = None

class AdminToggleRequest(BaseModel):
    # For future extensibility
    reason: Optional[str] = None

class ChatMessageOut(BaseModel):
    _id: str
    conv_id: int
    role: Literal["user", "assistant", "system", "admin"]
    text: str
    image_url: Optional[str] = None
    media_urls: Optional[List[str]] = None
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


# ─── Community Chat: Channels ──────────────────────────────────────

class ChannelCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: Optional[str] = None  # auto-generated from name if omitted
    channel_type: Literal["text", "announcement"] = "text"
    section_filter: Optional[str] = None  # e.g. "cocina", "delivery"
    description: Optional[str] = None
    icon: Optional[str] = None  # emoji or icon key
    is_public: bool = True
    min_role_level: int = 6  # default: active workers and above

class ChannelUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_public: Optional[bool] = None
    min_role_level: Optional[int] = None
    section_filter: Optional[str] = None

class ChannelOut(BaseModel):
    slug: str
    name: str
    channel_type: Literal["text", "announcement"] = "text"
    section_filter: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_public: bool = True
    min_role_level: int = 6
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    member_count: int = 0
    unread_count: int = 0
    pinned_message_ids: List[str] = []

class ChannelMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    reply_to: Optional[str] = None  # message _id being replied to
    mentions: List[str] = []  # list of wallet addresses or "@nonna"
    media_urls: List[str] = []

class ChannelMessageOut(BaseModel):
    id: str
    channel_slug: str
    sender_wallet: Optional[str] = None
    sender_privy_id: Optional[str] = None
    sender_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    sender_cargo: Optional[str] = None
    sender_seccion: Optional[str] = None
    sender_role_level: Optional[int] = None
    text: str
    payload: Optional[Dict[str, Any]] = None
    media_urls: List[str] = []
    mentions: List[str] = []
    reply_to: Optional[str] = None
    reply_preview: Optional[Dict[str, Any]] = None  # {text, sender_name} of parent
    reactions: Dict[str, List[str]] = {}  # emoji -> [wallet1, wallet2, ...]
    is_pinned: bool = False
    created_at: datetime


# ─── Community Chat: Groups ───────────────────────────────────────

class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = None
    is_section_based: bool = False  # auto-join by section/cargo
    allowed_secciones: List[str] = []
    allowed_cargos: List[str] = []

class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    is_section_based: Optional[bool] = None
    allowed_secciones: Optional[List[str]] = None
    allowed_cargos: Optional[List[str]] = None

class GroupMemberRequest(BaseModel):
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    role: Literal["owner", "mod", "member"] = "member"

class GroupMemberOut(BaseModel):
    wallet: Optional[str] = None
    privy_id: Optional[str] = None
    role: Literal["owner", "mod", "member"] = "member"
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cargo: Optional[str] = None
    seccion: Optional[str] = None
    joined_at: Optional[datetime] = None

class GroupOut(BaseModel):
    group_id: str
    name: str
    icon: Optional[str] = None
    is_section_based: bool = False
    allowed_secciones: List[str] = []
    allowed_cargos: List[str] = []
    owner_wallet: Optional[str] = None
    created_at: Optional[datetime] = None
    member_count: int = 0
    unread_count: int = 0
    members: List[GroupMemberOut] = []

class GroupMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    reply_to: Optional[str] = None
    mentions: List[str] = []
    media_urls: List[str] = []

class GroupMessageOut(BaseModel):
    id: str
    group_id: str
    sender_wallet: Optional[str] = None
    sender_privy_id: Optional[str] = None
    sender_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    sender_cargo: Optional[str] = None
    sender_seccion: Optional[str] = None
    text: str
    payload: Optional[Dict[str, Any]] = None
    media_urls: List[str] = []
    mentions: List[str] = []
    reply_to: Optional[str] = None
    reply_preview: Optional[Dict[str, Any]] = None
    reactions: Dict[str, List[str]] = {}
    created_at: datetime


# ─── Reactions ────────────────────────────────────────────────────

class ReactionRequest(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=10)

class DmSendRequest(BaseModel):
    peer: str
    text: str
