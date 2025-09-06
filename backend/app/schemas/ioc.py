"""
IOC schemas
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class IOCType(str, Enum):
    """IOC type enumeration"""
    URL = "url"
    DOMAIN = "domain"
    IPV4 = "ipv4"
    SHA256 = "sha256"
    MD5 = "md5"
    EMAIL = "email"
    SUBJECT_KEYWORD = "subject_keyword"


class Classification(str, Enum):
    """IOC classification enumeration"""
    MALICIOUS = "malicious"
    SUSPICIOUS = "suspicious"
    BENIGN = "benign"
    UNKNOWN = "unknown"


class RiskBand(str, Enum):
    """Risk band enumeration"""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class TagKind(str, Enum):
    """Tag kind enumeration"""
    ACTOR = "actor"
    FAMILY = "family"
    TTP = "ttp"
    CAMPAIGN = "campaign"
    LABEL = "label"


class IOCCreate(BaseModel):
    """IOC creation schema"""
    value: str
    type: IOCType
    classification: Classification = Classification.UNKNOWN
    source_platform: str
    email_id: Optional[str] = None
    campaign_id: Optional[str] = None
    user_reported: bool = False
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    notes: Optional[str] = None


class IOCBase(BaseModel):
    """Base IOC schema"""
    value: str
    type: IOCType
    classification: Classification
    source_platform: str
    email_id: Optional[str] = None
    campaign_id: Optional[str] = None
    user_reported: bool = False
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    notes: Optional[str] = None


class IOC(IOCBase):
    """IOC response schema"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class IOCScore(BaseModel):
    """IOC score schema"""
    id: int
    ioc_id: int
    risk_score: int
    attribution_score: int
    risk_band: RiskBand
    computed_at: datetime
    
    class Config:
        from_attributes = True


class TagCreate(BaseModel):
    """Tag creation schema"""
    name: str
    kind: TagKind
    description: Optional[str] = None


class Tag(BaseModel):
    """Tag schema"""
    id: int
    name: str
    kind: TagKind
    description: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class IOCSearch(BaseModel):
    """IOC search parameters"""
    q: Optional[str] = None
    type: Optional[IOCType] = None
    risk_min: Optional[int] = None
    risk_max: Optional[int] = None
    provider: Optional[str] = None
    actor: Optional[str] = None
    family: Optional[str] = None
    first_seen_from: Optional[datetime] = None
    last_seen_to: Optional[datetime] = None
    classification: Optional[Classification] = None
    source_platform: Optional[str] = None
    page: int = 1
    page_size: int = 50


class IOCWithDetails(IOC):
    """IOC with enrichment details"""
    latest_score: Optional[IOCScore] = None
    enrichment_results: List[dict] = []  # Use dict instead of EnrichmentResult to avoid circular import
    tags: List[Tag] = []
