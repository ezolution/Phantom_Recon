"""
Job endpoints
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Removed authentication dependencies
from app.core.database import get_db
from app.models.job import Job, JobStatus
from app.models.upload import Upload
from app.schemas.job import Job as JobSchema, JobSummary
from app.services.enrichment_pipeline import EnrichmentPipeline
from app.core.database import AsyncSessionLocal

router = APIRouter()


@router.get("/{job_id}", response_model=JobSummary)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    # Removed authentication
) -> Any:
    """Get job status and summary"""
    
    result = await db.execute(
        select(Job).where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # No authentication required - allow access to all jobs
    
    # Calculate progress
    progress_percentage = 0.0
    if job.total_iocs > 0:
        progress_percentage = (job.processed_iocs / job.total_iocs) * 100
    
    return JobSummary(
        job=job,
        progress_percentage=progress_percentage
    )


@router.post("/{job_id}/enrich")
async def start_enrichment(
    job_id: int,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Start or force enrichment for a job"""
    
    result = await db.execute(
        select(Job).where(Job.id == job_id)
    )
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )
    
    # Update job status to queued if not already running
    if job.status not in [JobStatus.RUNNING, JobStatus.DONE]:
        job.status = JobStatus.QUEUED
        await db.commit()
    
    # Launch background enrichment without Celery
    async def _bg():
        async with AsyncSessionLocal() as session:
            pipeline = EnrichmentPipeline()
            await pipeline.process_job(job_id, session)
    
    import asyncio
    try:
        asyncio.create_task(_bg())
    except Exception:
        pass
    
    return {"message": "Enrichment job started"}
