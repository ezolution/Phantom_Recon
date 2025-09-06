"""
IOC endpoints
"""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

# Removed authentication dependencies
from app.core.database import get_db
from app.models.ioc import IOC, IOCScore
from app.models.enrichment import EnrichmentResult
from app.schemas.ioc import IOC as IOCSchema, IOCWithDetails, IOCSearch
from app.schemas.enrichment import EnrichmentResult as EnrichmentResultSchema

router = APIRouter()


@router.get("/", response_model=List[IOCWithDetails])
async def search_iocs(
    q: str = Query(None, description="Search query"),
    type: str = Query(None, description="IOC type filter"),
    risk_min: int = Query(None, ge=0, le=100, description="Minimum risk score"),
    risk_max: int = Query(None, ge=0, le=100, description="Maximum risk score"),
    provider: str = Query(None, description="Provider filter"),
    actor: str = Query(None, description="Actor filter"),
    family: str = Query(None, description="Family filter"),
    classification: str = Query(None, description="Classification filter"),
    source_platform: str = Query(None, description="Source platform filter"),
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
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    iocs = result.scalars().all()
    
    # TODO: Apply risk score filtering and provider/actor/family filtering
    # This would require more complex joins with enrichment results
    
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
    
    return ioc
