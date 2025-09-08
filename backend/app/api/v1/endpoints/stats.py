"""
Statistics endpoints
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

# Removed authentication dependencies
from app.core.database import get_db
from app.core.config import settings
from app.models.ioc import IOC, IOCScore, RiskBand
from app.models.enrichment import EnrichmentResult

router = APIRouter()


@router.get("/overview")
async def get_overview_stats(
    db: AsyncSession = Depends(get_db),
    # Removed authentication
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
    
    # Providers used (any results)
    result = await db.execute(
        select(EnrichmentResult.provider, func.count(EnrichmentResult.id))
        .group_by(EnrichmentResult.provider)
    )
    providers = dict(result.all())

    # Providers that returned successful (2xx) results at least once
    result = await db.execute(
        select(func.count(func.distinct(EnrichmentResult.provider)))
        .where(EnrichmentResult.http_status >= 200)
        .where(EnrichmentResult.http_status < 300)
    )
    providers_successful_count = result.scalar() or 0

    # Providers configured via environment variables
    configured: List[str] = []
    if settings.VIRUSTOTAL_API_KEY:
        configured.append("virustotal")
    if settings.URLSCAN_API_KEY:
        configured.append("urlscan")
    if settings.CROWDSTRIKE_CLIENT_ID and settings.CROWDSTRIKE_CLIENT_SECRET:
        configured.append("crowdstrike")
    if settings.FLASHPOINT_API_KEY:
        configured.append("flashpoint")
    if settings.RECORDED_FUTURE_API_KEY:
        configured.append("recorded_future")
    # Note: OSINT requires no key; exclude from configured-by-env count
    
    return {
        "total_iocs": total_iocs,
        "risk_bands": risk_bands,
        "ioc_types": ioc_types,
        "last_7d_iocs": last_7d_iocs,
        "providers": providers,
        "providers_configured": configured,
        "providers_configured_count": len(configured),
        "providers_successful_count": providers_successful_count,
    }
