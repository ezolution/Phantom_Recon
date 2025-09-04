"""
Statistics endpoints
"""

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.auth import get_current_active_user
from app.models.user import User
from app.core.database import get_db
from app.models.ioc import IOC, IOCScore, RiskBand
from app.models.enrichment import EnrichmentResult

router = APIRouter()


@router.get("/overview")
async def get_overview_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get overview statistics"""
    
    # Total IOCs
    result = await db.execute(select(func.count(IOC.id)))
    total_iocs = result.scalar()
    
    # IOCs by risk band
    result = await db.execute(
        select(IOCScore.risk_band, func.count(IOCScore.id))
        .group_by(IOCScore.risk_band)
    )
    risk_bands = dict(result.all())
    
    # IOCs by type
    result = await db.execute(
        select(IOC.type, func.count(IOC.id))
        .group_by(IOC.type)
    )
    ioc_types = dict(result.all())
    
    # IOCs from last 7 days
    from datetime import datetime, timedelta
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(func.count(IOC.id))
        .where(IOC.created_at >= seven_days_ago)
    )
    last_7d_iocs = result.scalar()
    
    # Providers used
    result = await db.execute(
        select(EnrichmentResult.provider, func.count(EnrichmentResult.id))
        .group_by(EnrichmentResult.provider)
    )
    providers = dict(result.all())
    
    return {
        "total_iocs": total_iocs,
        "risk_bands": risk_bands,
        "ioc_types": ioc_types,
        "last_7d_iocs": last_7d_iocs,
        "providers": providers
    }
