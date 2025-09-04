"""
IOC (Indicator of Compromise) models
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Table
from sqlalchemy.orm import relationship

from app.core.database import Base


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


# Association table for IOC-Tag many-to-many relationship
IOC_Tag = Table(
    "ioc_tags",
    Base.metadata,
    Column("ioc_id", Integer, ForeignKey("iocs.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class IOC(Base):
    """IOC (Indicator of Compromise) model"""
    
    __tablename__ = "iocs"
    
    id = Column(Integer, primary_key=True, index=True)
    value = Column(String(500), nullable=False, index=True)
    type = Column(String(20), nullable=False, index=True)
    classification = Column(String(20), default=Classification.UNKNOWN, nullable=False)
    source_platform = Column(String(50), nullable=False)
    email_id = Column(String(100), nullable=True)
    campaign_id = Column(String(100), nullable=True)
    user_reported = Column(Boolean, default=False, nullable=False)
    first_seen = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    enrichment_results = relationship("EnrichmentResult", back_populates="ioc")
    scores = relationship("IOCScore", back_populates="ioc")
    tags = relationship("Tag", secondary=IOC_Tag, back_populates="iocs")


class IOCScore(Base):
    """IOC scoring model"""
    
    __tablename__ = "ioc_scores"
    
    id = Column(Integer, primary_key=True, index=True)
    ioc_id = Column(Integer, ForeignKey("iocs.id"), nullable=False)
    risk_score = Column(Integer, nullable=False, index=True)  # 0-100
    attribution_score = Column(Integer, nullable=False)  # 0-100
    risk_band = Column(String(20), nullable=False, index=True)
    computed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    ioc = relationship("IOC", back_populates="scores")


class Tag(Base):
    """Tag model for IOC categorization"""
    
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    kind = Column(String(20), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    iocs = relationship("IOC", secondary=IOC_Tag, back_populates="tags")
