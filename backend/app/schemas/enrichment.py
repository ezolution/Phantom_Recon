"""
Enrichment result schemas
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel


class Verdict(str, Enum):
    """Verdict enumeration"""
    UNKNOWN = "unknown"
    BENIGN = "benign"
    SUSPICIOUS = "suspicious"
    MALICIOUS = "malicious"


class EnrichmentResultCreate(BaseModel):
    """Enrichment result creation schema"""
    ioc_id: int
    provider: str
    raw_json: Optional[Dict[str, Any]] = None
    verdict: Verdict = Verdict.UNKNOWN
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    actor: Optional[str] = None
    family: Optional[str] = None
    confidence: Optional[int] = None
    evidence: Optional[str] = None
    http_status: Optional[int] = None


class EnrichmentResult(BaseModel):
    """Enrichment result response schema"""
    id: int
    ioc_id: int
    provider: str
    raw_json: Optional[Dict[str, Any]] = None
    verdict: Verdict
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    actor: Optional[str] = None
    family: Optional[str] = None
    confidence: Optional[int] = None
    evidence: Optional[str] = None
    http_status: Optional[int] = None
    queried_at: datetime
    
    class Config:
        from_attributes = True
