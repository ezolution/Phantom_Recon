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
    
    # Attribution by provider (distinct actors/families)
    result = await db.execute(
        select(EnrichmentResult.provider, func.count(func.distinct(EnrichmentResult.actor)))
        .where(EnrichmentResult.actor.is_not(None))
        .group_by(EnrichmentResult.provider)
    )
    actors_by_provider = dict(result.all())

    result = await db.execute(
        select(EnrichmentResult.provider, func.count(func.distinct(EnrichmentResult.family)))
        .where(EnrichmentResult.family.is_not(None))
        .group_by(EnrichmentResult.provider)
    )
    families_by_provider = dict(result.all())

    attribution_by_provider = {}
    for p in set(list(actors_by_provider.keys()) + list(families_by_provider.keys())):
        attribution_by_provider[p] = {
            "actors": int(actors_by_provider.get(p, 0) or 0),
            "families": int(families_by_provider.get(p, 0) or 0),
        }

    # Unique actors in last 7 days
    result = await db.execute(
        select(func.distinct(EnrichmentResult.actor))
        .where(EnrichmentResult.actor.is_not(None))
        .where(EnrichmentResult.queried_at >= seven_days_ago)
    )
    unique_actors_7d = [row[0] for row in result.all() if row[0] is not None]

    # Top actors/families per provider (by frequency)
    result = await db.execute(
        select(EnrichmentResult.provider, EnrichmentResult.actor, func.count(EnrichmentResult.id))
        .where(EnrichmentResult.actor.is_not(None))
        .group_by(EnrichmentResult.provider, EnrichmentResult.actor)
    )
    rows = result.all()
    top_actors_by_provider: dict[str, list[dict]] = {}
    for p, name, cnt in rows:
        if not p:
            continue
        top_actors_by_provider.setdefault(p, []).append({"name": name, "count": int(cnt)})
    for p, lst in top_actors_by_provider.items():
        lst.sort(key=lambda x: x["count"], reverse=True)
        top_actors_by_provider[p] = lst[:5]

    result = await db.execute(
        select(EnrichmentResult.provider, EnrichmentResult.family, func.count(EnrichmentResult.id))
        .where(EnrichmentResult.family.is_not(None))
        .group_by(EnrichmentResult.provider, EnrichmentResult.family)
    )
    rows = result.all()
    top_families_by_provider: dict[str, list[dict]] = {}
    for p, name, cnt in rows:
        if not p:
            continue
        top_families_by_provider.setdefault(p, []).append({"name": name, "count": int(cnt)})
    for p, lst in top_families_by_provider.items():
        lst.sort(key=lambda x: x["count"], reverse=True)
        top_families_by_provider[p] = lst[:5]

    return {
        "total_iocs": total_iocs,
        "risk_bands": risk_bands,
        "ioc_types": ioc_types,
        "last_7d_iocs": last_7d_iocs,
        "providers": providers,
        "providers_configured": configured,
        "providers_configured_count": len(configured),
        "providers_successful_count": providers_successful_count,
        "attribution_by_provider": attribution_by_provider,
        "attribution_samples": {
            "actors": top_actors_by_provider,
            "families": top_families_by_provider,
        },
        "unique_actors_7d": unique_actors_7d,
        "unique_actors_7d_count": len(unique_actors_7d),
    }


@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Analytics data for charts: 7-day trend, verdict mix, pending counts, top sources."""
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    day_starts = [(now - timedelta(days=i)).date() for i in range(6, -1, -1)]

    # 7-day IOC creation trend
    trend: list[dict] = []
    for d in day_starts:
        d_start = datetime(d.year, d.month, d.day)
        d_end = d_start + timedelta(days=1)
        res = await db.execute(select(func.count(IOC.id)).where(IOC.created_at >= d_start, IOC.created_at < d_end))
        trend.append({"date": d.isoformat(), "count": res.scalar() or 0})

    # Risk band distribution from IOCScore (final scores)
    res = await db.execute(
        select(IOCScore.risk_band, func.count(IOCScore.id)).group_by(IOCScore.risk_band)
    )
    risk_bands = dict(res.all())

    # Pending IOCs (no score yet)
    res = await db.execute(select(func.count(IOC.id)).where(~IOC.id.in_(select(IOCScore.ioc_id))))
    pending_count = res.scalar() or 0

    # Top sources
    res = await db.execute(select(IOC.source_platform, func.count(IOC.id)).group_by(IOC.source_platform).order_by(func.count(IOC.id).desc()))
    sources = [{"source": k, "count": v} for k, v in res.all()]

    return {
        "trend_7d": trend,
        "risk_bands": risk_bands,
        "pending_iocs": pending_count,
        "sources": sources,
    }
