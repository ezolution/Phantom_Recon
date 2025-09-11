"""
Statistics endpoints
"""

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from fastapi import Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

# Removed authentication dependencies
from app.core.database import get_db
from app.core.config import settings
from app.models.ioc import IOC, IOCScore, RiskBand
from app.models.enrichment import EnrichmentResult
from app.services.virustotal_adapter import VirusTotalAdapter
from app.services.urlscan_adapter import URLScanAdapter
from app.services.osint_adapter import OSINTAdapter
from app.services.crowdstrike_adapter import CrowdStrikeAdapter
from app.services.flashpoint_adapter import FlashpointAdapter
from app.services.recorded_future_adapter import RecordedFutureAdapter
from app.services.base_adapter import BaseAdapter

router = APIRouter()
@router.get("/provider-status")
async def provider_status() -> Any:
    """Return provider readiness and configuration status."""
    adapters = {
        "virustotal": VirusTotalAdapter(),
        "urlscan": URLScanAdapter(),
        "osint": OSINTAdapter(),
        "crowdstrike": CrowdStrikeAdapter(),
        "flashpoint": FlashpointAdapter(),
        "recorded_future": RecordedFutureAdapter(),
    }
    status: dict[str, dict] = {}
    for name, adapter in adapters.items():
        ready = True
        reason = None
        # Simple readiness heuristic based on presence of API keys when required
        if name == "virustotal" and not settings.VIRUSTOTAL_API_KEY:
            ready, reason = False, "API key missing"
        if name == "urlscan" and not settings.URLSCAN_API_KEY:
            ready, reason = False, "API key missing"
        if name == "crowdstrike" and not (settings.CROWDSTRIKE_CLIENT_ID and settings.CROWDSTRIKE_CLIENT_SECRET):
            ready, reason = False, "Client credentials missing"
        if name == "flashpoint" and not settings.FLASHPOINT_API_KEY:
            ready, reason = False, "API key missing"
        if name == "recorded_future" and not settings.RECORDED_FUTURE_API_KEY:
            ready, reason = False, "API key missing"
        status[name] = {
            "ready": ready,
            "reason": reason,
        }
    return status


@router.post("/cache/ttl")
async def set_cache_ttl(positive_ttl_seconds: int = 86400, negative_ttl_seconds: int = 21600) -> Any:
    """Set global cache TTLs for provider adapters (seconds)."""
    BaseAdapter.set_cache_ttls(positive_ttl_seconds, negative_ttl_seconds)
    return {"ok": True, "positive_ttl_seconds": positive_ttl_seconds, "negative_ttl_seconds": negative_ttl_seconds}

@router.post("/cache/clear")
async def clear_cache() -> Any:
    """Clear in-process adapter cache (best-effort)."""
    removed = BaseAdapter.clear_cache()
    return {"ok": True, "removed": removed}


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
    """Analytics data for charts: 7-day trend, verdict mix, pending counts, top sources,
    recent clustering and targeting signal, top actors/families.
    """
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

    # Top sources (all-time)
    res = await db.execute(select(IOC.source_platform, func.count(IOC.id)).group_by(IOC.source_platform).order_by(func.count(IOC.id).desc()))
    sources = [{"source": k, "count": v} for k, v in res.all()]

    # Recent clustering windows
    last_72h = now - timedelta(hours=72)
    last_48h = now - timedelta(hours=48)
    last_7d = now - timedelta(days=7)

    # Clusters by campaign in last 72h
    res = await db.execute(
        select(IOC.campaign_id, func.count(IOC.id))
        .where(IOC.campaign_id.is_not(None))
        .where(IOC.created_at >= last_72h)
        .group_by(IOC.campaign_id)
        .order_by(func.count(IOC.id).desc())
    )
    by_campaign_72h_rows = res.all()
    by_campaign_72h = [
        {"campaign_id": cid, "count": int(cnt)} for cid, cnt in by_campaign_72h_rows[:5]
    ]
    top_campaign_count = int(by_campaign_72h[0]["count"]) if by_campaign_72h else 0

    # Clusters by source in last 72h
    res = await db.execute(
        select(IOC.source_platform, func.count(IOC.id))
        .where(IOC.created_at >= last_72h)
        .group_by(IOC.source_platform)
        .order_by(func.count(IOC.id).desc())
    )
    by_source_72h = [
        {"source": src, "count": int(cnt)} for src, cnt in res.all()[:5]
    ]

    # Unique actors last 48h
    res = await db.execute(
        select(func.count(func.distinct(EnrichmentResult.actor)))
        .where(EnrichmentResult.actor.is_not(None))
        .where(EnrichmentResult.queried_at >= last_48h)
    )
    unique_actors_48h = int(res.scalar() or 0)

    # Top actors/families last 7d
    res = await db.execute(
        select(EnrichmentResult.actor, func.count(EnrichmentResult.id))
        .where(EnrichmentResult.actor.is_not(None))
        .where(EnrichmentResult.queried_at >= last_7d)
        .group_by(EnrichmentResult.actor)
        .order_by(func.count(EnrichmentResult.id).desc())
    )
    top_actors_7d = [
        {"name": name, "count": int(cnt)} for name, cnt in res.all()[:10]
    ]

    res = await db.execute(
        select(EnrichmentResult.family, func.count(EnrichmentResult.id))
        .where(EnrichmentResult.family.is_not(None))
        .where(EnrichmentResult.queried_at >= last_7d)
        .group_by(EnrichmentResult.family)
        .order_by(func.count(EnrichmentResult.id).desc())
    )
    top_families_7d = [
        {"name": name, "count": int(cnt)} for name, cnt in res.all()[:10]
    ]

    # Targeting signal (0-100): surge vs baseline + unique actors + campaign clustering
    today_count = trend[-1]["count"] if trend else 0
    prev_days = [d["count"] for d in trend[:-1]] if len(trend) > 1 else []
    prev_avg = (sum(prev_days) / len(prev_days)) if prev_days else 0
    surge_component = 0
    if prev_avg > 0:
        ratio = today_count / prev_avg
        surge_component = min(60, int(ratio * 20))  # 3x -> 60
    elif today_count > 0:
        surge_component = 40  # first activity after no baseline

    actors_component = min(20, unique_actors_48h * 5)  # up to 20
    cluster_component = 0
    if top_campaign_count > 3:
        cluster_component = min(20, (top_campaign_count - 3) * 5)
    targeting_signal = min(100, surge_component + actors_component + cluster_component)

    return {
        "trend_7d": trend,
        "risk_bands": risk_bands,
        "pending_iocs": pending_count,
        "sources": sources,
        "top_actors_7d": top_actors_7d,
        "top_families_7d": top_families_7d,
        "clusters_recent": {
            "by_campaign_72h": by_campaign_72h,
            "by_source_72h": by_source_72h,
        },
        "unique_actors_48h": unique_actors_48h,
        "targeting_signal": targeting_signal,
    }


@router.get("/heatmap")
async def get_actor_source_time_heatmap(
    days: int = Query(14, ge=1, le=90),
    top_actors: int = Query(10, ge=1, le=50),
    top_sources: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Actor vs Source over Time heatmap data.
    Returns the top N actors and sources within the window and a matrix of counts per day.
    """
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    window_start = now - timedelta(days=days)

    # Raw grouped counts: date, actor, source, count
    # We attribute by EnrichmentResult.actor (not null) and IOC.source_platform
    raw = await db.execute(
        select(
            func.date(IOC.created_at).label("d"),
            EnrichmentResult.actor.label("actor"),
            IOC.source_platform.label("source"),
            func.count(IOC.id).label("cnt"),
        )
        .join(EnrichmentResult, EnrichmentResult.ioc_id == IOC.id)
        .where(IOC.created_at >= window_start)
        .where(EnrichmentResult.actor.is_not(None))
        .group_by(func.date(IOC.created_at), EnrichmentResult.actor, IOC.source_platform)
    )
    rows = raw.fetchall()

    # Totals per actor and per source (to select top lists)
    actor_totals: dict[str, int] = {}
    source_totals: dict[str, int] = {}
    for d, actor, source, cnt in rows:
        if actor:
            actor_totals[actor] = actor_totals.get(actor, 0) + int(cnt)
        if source:
            source_totals[source] = source_totals.get(source, 0) + int(cnt)

    actors_sorted = sorted(actor_totals.items(), key=lambda x: x[1], reverse=True)[:top_actors]
    sources_sorted = sorted(source_totals.items(), key=lambda x: x[1], reverse=True)[:top_sources]
    actors = [a for a, _ in actors_sorted]
    sources = [s for s, _ in sources_sorted]

    # Build date axis
    dates = [(now - timedelta(days=i)).date().isoformat() for i in range(days - 1, -1, -1)]

    # Matrix entries filtered to top actors/sources
    entries = []
    for d, actor, source, cnt in rows:
        if actor in actors and source in sources:
            entries.append({
                "date": str(d),
                "actor": actor,
                "source": source,
                "count": int(cnt),
            })

    return {
        "dates": dates,
        "actors": actors,
        "sources": sources,
        "entries": entries,
        "actor_totals": actor_totals,
        "source_totals": source_totals,
        "window_days": days,
    }


@router.get("/trending")
async def get_trending(
    days: int = Query(30, ge=1, le=180),
    top_actors: int = Query(5, ge=1, le=20),
    top_campaigns: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Return time-series trending for actors and campaigns.
    Output: { dates: [...], actor_series: [{name, data[]}], campaign_series: [{name, data[]}]} where
    data[i] corresponds to dates[i].
    """
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    window_start = now - timedelta(days=days)
    date_axis = [(now - timedelta(days=i)).date() for i in range(days - 1, 0, -1)] + [now.date()]
    date_strs = [d.isoformat() for d in date_axis]

    # Actor daily counts
    actor_rows = await db.execute(
        select(
            func.date(IOC.created_at).label("d"),
            EnrichmentResult.actor.label("actor"),
            func.count(IOC.id).label("cnt"),
        )
        .join(EnrichmentResult, EnrichmentResult.ioc_id == IOC.id)
        .where(IOC.created_at >= window_start)
        .where(EnrichmentResult.actor.is_not(None))
        .group_by(func.date(IOC.created_at), EnrichmentResult.actor)
    )
    arows = actor_rows.fetchall()
    actor_totals: dict[str, int] = {}
    for d, a, cnt in arows:
        if a:
            actor_totals[a] = actor_totals.get(a, 0) + int(cnt)
    top_actor_names = [n for n, _ in sorted(actor_totals.items(), key=lambda x: x[1], reverse=True)[:top_actors]]

    # Build actor series
    actor_counts: dict[str, dict[str, int]] = {a: {} for a in top_actor_names}
    for d, a, cnt in arows:
        if a in actor_counts:
            actor_counts[a][str(d)] = int(cnt)
    actor_series = [
        {"name": a, "data": [actor_counts[a].get(ds, 0) for ds in date_strs]}
        for a in top_actor_names
    ]

    # Campaign daily counts
    camp_rows = await db.execute(
        select(
            func.date(IOC.created_at).label("d"),
            IOC.campaign_id.label("cid"),
            func.count(IOC.id).label("cnt"),
        )
        .where(IOC.created_at >= window_start)
        .where(IOC.campaign_id.is_not(None))
        .group_by(func.date(IOC.created_at), IOC.campaign_id)
    )
    crows = camp_rows.fetchall()
    camp_totals: dict[str, int] = {}
    for d, cid, cnt in crows:
        if cid:
            camp_totals[cid] = camp_totals.get(cid, 0) + int(cnt)
    top_campaign_ids = [n for n, _ in sorted(camp_totals.items(), key=lambda x: x[1], reverse=True)[:top_campaigns]]

    camp_counts: dict[str, dict[str, int]] = {c: {} for c in top_campaign_ids}
    for d, cid, cnt in crows:
        if cid in camp_counts:
            camp_counts[cid][str(d)] = int(cnt)
    campaign_series = [
        {"name": c, "data": [camp_counts[c].get(ds, 0) for ds in date_strs]}
        for c in top_campaign_ids
    ]

    return {
        "dates": date_strs,
        "actor_series": actor_series,
        "campaign_series": campaign_series,
        "window_days": days,
    }
