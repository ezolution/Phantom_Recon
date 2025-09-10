"""
IOC endpoints
"""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, exists
from sqlalchemy.orm import selectinload

# Removed authentication dependencies
from app.core.database import get_db
from app.models.ioc import IOC, IOCScore
from app.models.enrichment import EnrichmentResult
from app.schemas.ioc import IOC as IOCSchema, IOCWithDetails, IOCSearch
from app.schemas.enrichment import EnrichmentResult as EnrichmentResultSchema
from app.models.upload import Upload
from app.services.enrichment_pipeline import EnrichmentPipeline
from sqlalchemy import update

router = APIRouter()
@router.get("/campaigns")
async def get_campaigns(
    db: AsyncSession = Depends(get_db),
):
    """List campaigns with IOC counts and last activity."""
    # Count IOCs per campaign (non-null)
    result = await db.execute(
        select(IOC.campaign_id, func.count(IOC.id), func.max(IOC.last_seen))
        .where(IOC.campaign_id.is_not(None))
        .group_by(IOC.campaign_id)
        .order_by(func.count(IOC.id).desc())
    )
    rows = result.all()
    campaigns = [
        {"campaign_id": cid, "ioc_count": int(cnt), "last_seen": last.isoformat() if last else None}
        for cid, cnt, last in rows
    ]
    return {"campaigns": campaigns}

@router.get("/campaigns/{campaign_id}")
async def get_campaign_details(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
):
    """IOC aggregation and simple timeline for a campaign."""
    # IOCs
    res = await db.execute(
        select(IOC).options(selectinload(IOC.enrichment_results), selectinload(IOC.scores))
        .where(IOC.campaign_id == campaign_id)
        .order_by(IOC.created_at.desc())
    )
    iocs = res.scalars().all()

    # Timeline (per day)
    res = await db.execute(
        select(func.date(IOC.created_at), func.count(IOC.id))
        .where(IOC.campaign_id == campaign_id)
        .group_by(func.date(IOC.created_at))
        .order_by(func.date(IOC.created_at))
    )
    timeline = [{"date": d, "count": int(c)} for d, c in res.all()]

    return {
        "campaign_id": campaign_id,
        "ioc_count": len(iocs),
        "timeline": timeline,
        "iocs": iocs,
    }


@router.post("/{ioc_id}/re-enrich")
async def re_enrich_ioc(
    ioc_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Re-run enrichment for a single IOC and recompute scores."""
    # Load IOC
    res = await db.execute(select(IOC).where(IOC.id == ioc_id))
    ioc = res.scalar_one_or_none()
    if not ioc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="IOC not found")

    pipeline = EnrichmentPipeline()
    # Enrich with all providers and store results (pipeline handles dedupe)
    enrichment_results = await pipeline.enrich_ioc(ioc, db)

    # Recompute scores
    risk_score = pipeline.calculate_risk_score(enrichment_results)
    attribution_score = pipeline.calculate_attribution_score(enrichment_results)
    risk_band = pipeline.get_risk_band(risk_score)
    db.add(IOCScore(
        ioc_id=ioc.id,
        risk_score=risk_score,
        attribution_score=attribution_score,
        risk_band=risk_band,
    ))
    await db.commit()
    return {"ok": True, "risk_score": risk_score, "attribution_score": attribution_score, "risk_band": risk_band}


@router.get("/", response_model=List[IOCWithDetails])
async def search_iocs(
    q: str = Query(None, description="Search query"),
    type: str = Query(None, description="IOC type filter"),
    risk_min: int = Query(None, ge=0, le=100, description="Minimum risk score (latest)"),
    risk_max: int = Query(None, ge=0, le=100, description="Maximum risk score (latest)"),
    risk_band: str = Query(None, description="Risk band (Low, Medium, High, Critical) for latest score"),
    provider: str = Query(None, description="Provider filter (enrichment results)"),
    actor: str = Query(None, description="Actor filter (substring, enrichment results)"),
    family: str = Query(None, description="Family filter (substring, enrichment results)"),
    classification: str = Query(None, description="Classification filter"),
    source_platform: str = Query(None, description="Source platform filter"),
    first_seen_from: str = Query(None, description="IOC first_seen >= ISO datetime"),
    last_seen_to: str = Query(None, description="IOC last_seen <= ISO datetime"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
    # Removed authentication
) -> Any:
    """Search and filter IOCs"""
    
    # Build query
    query = select(IOC).options(
        selectinload(IOC.enrichment_results),
        selectinload(IOC.scores),
        selectinload(IOC.tags)
    )
    
    # Apply filters
    conditions = []
    
    if q:
        conditions.append(
            or_(
                IOC.value.ilike(f"%{q}%"),
                IOC.email_id.ilike(f"%{q}%"),
                IOC.campaign_id.ilike(f"%{q}%")
            )
        )
    
    if type:
        conditions.append(IOC.type == type)
    
    if classification:
        conditions.append(IOC.classification == classification)
    
    if source_platform:
        conditions.append(IOC.source_platform == source_platform)
    
    # Date filters (best-effort parsing on DB side using ISO strings)
    if first_seen_from:
        conditions.append(IOC.first_seen.is_not(None))
        conditions.append(IOC.first_seen >= func.datetime(first_seen_from))
    if last_seen_to:
        conditions.append(IOC.last_seen.is_not(None))
        conditions.append(IOC.last_seen <= func.datetime(last_seen_to))

    # Risk filters (based on latest IOCScore only)
    if any(v is not None for v in [risk_min, risk_max, risk_band]):
        # Correlated subquery to pick latest score per-IOC
        latest_score_ts = (
            select(func.max(IOCScore.computed_at))
            .where(IOCScore.ioc_id == IOC.id)
            .correlate(IOC)
            .scalar_subquery()
        )
        score_exists = select(1).where(
            and_(
                IOCScore.ioc_id == IOC.id,
                IOCScore.computed_at == latest_score_ts,
            )
        )
        if risk_min is not None:
            score_exists = score_exists.where(IOCScore.risk_score >= risk_min)
        if risk_max is not None:
            score_exists = score_exists.where(IOCScore.risk_score <= risk_max)
        if risk_band is not None:
            score_exists = score_exists.where(IOCScore.risk_band == risk_band)
        conditions.append(exists(score_exists))

    # Provider/actor/family filters (exists in enrichment results)
    if any(v is not None and v != "" for v in [provider, actor, family]):
        enr_exists = select(1).where(EnrichmentResult.ioc_id == IOC.id)
        if provider:
            enr_exists = enr_exists.where(EnrichmentResult.provider == provider)
        if actor:
            # substring/ci match
            enr_exists = enr_exists.where(EnrichmentResult.actor.ilike(f"%{actor}%"))
        if family:
            enr_exists = enr_exists.where(EnrichmentResult.family.ilike(f"%{family}%"))
        conditions.append(exists(enr_exists))

    if conditions:
        query = query.where(and_(*conditions))
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    iocs = result.scalars().all()
    
    # Populate latest_score from most recent IOCScore (if present)
    for ioc in iocs:
        try:
            if hasattr(ioc, "scores") and ioc.scores:
                latest = max(ioc.scores, key=lambda s: getattr(s, "computed_at", None) or getattr(s, "id", 0))
                setattr(ioc, "latest_score", latest)
        except Exception:
            # best-effort; ignore if something unexpected
            pass
    
    return iocs


@router.get("/{ioc_id}", response_model=IOCWithDetails)
async def get_ioc_details(
    ioc_id: int,
    db: AsyncSession = Depends(get_db),
    # Removed authentication
) -> Any:
    """Get detailed IOC information"""
    
    result = await db.execute(
        select(IOC)
        .options(
            selectinload(IOC.enrichment_results),
            selectinload(IOC.scores),
            selectinload(IOC.tags)
        )
        .where(IOC.id == ioc_id)
    )
    ioc = result.scalar_one_or_none()
    
    if not ioc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IOC not found"
        )
    # Attach most recent score for details view
    try:
        if hasattr(ioc, "scores") and ioc.scores:
            latest = max(ioc.scores, key=lambda s: getattr(s, "computed_at", None) or getattr(s, "id", 0))
            setattr(ioc, "latest_score", latest)
    except Exception:
        pass
    return ioc
