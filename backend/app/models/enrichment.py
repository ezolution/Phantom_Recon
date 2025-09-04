"""
Enrichment result model
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class Verdict(str, Enum):
    """Verdict enumeration"""
    UNKNOWN = "unknown"
    BENIGN = "benign"
    SUSPICIOUS = "suspicious"
    MALICIOUS = "malicious"


class EnrichmentResult(Base):
    """Enrichment result model"""
    
    __tablename__ = "enrichment_results"
    
    id = Column(Integer, primary_key=True, index=True)
    ioc_id = Column(Integer, ForeignKey("iocs.id"), nullable=False)
    provider = Column(String(50), nullable=False, index=True)
    raw_json = Column(JSONB, nullable=True)
    verdict = Column(String(20), default=Verdict.UNKNOWN, nullable=False)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    actor = Column(String(200), nullable=True)
    family = Column(String(200), nullable=True)
    confidence = Column(Integer, nullable=True)  # 0-100
    evidence = Column(Text, nullable=True)
    http_status = Column(Integer, nullable=True)
    queried_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    ioc = relationship("IOC", back_populates="enrichment_results")
