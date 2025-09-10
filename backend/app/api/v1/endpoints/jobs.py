"""
Job endpoints
"""

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Removed authentication dependencies
from app.core.database import get_db
from app.models.job import Job, JobStatus
from app.models.upload import Upload
from app.models.ioc import IOCScore, RiskBand
from app.schemas.job import Job as JobSchema, JobSummary
from app.services.enrichment_pipeline import EnrichmentPipeline
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, update
from datetime import datetime
from app.models.upload import Upload

router = APIRouter()


@router.get("/", response_model=List[JobSummary])
async def list_jobs(
    limit: int = Query(20, ge=1, le=100, description="Max number of recent jobs to return"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """List recent jobs with progress metrics."""
    result = await db.execute(
        select(Job).order_by(Job.id.desc()).limit(limit)
    )
    jobs = result.scalars().all()
    summaries: List[JobSummary] = []
    for job in jobs:
        pct = 0.0
        if job.total_iocs > 0:
            pct = (job.processed_iocs / job.total_iocs) * 100
        summaries.append(JobSummary(job=job, progress_percentage=pct))
    return summaries

@router.get("/latest", response_model=JobSummary)
async def get_latest_job(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Get the most recent job status and summary"""
    result = await db.execute(
        select(Job).order_by(Job.id.desc()).limit(1)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No jobs found"
        )

    progress_percentage = 0.0
    if job.total_iocs > 0:
        progress_percentage = (job.processed_iocs / job.total_iocs) * 100

    return JobSummary(job=job, progress_percentage=progress_percentage)


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
    
    # Run enrichment inline using pure SQL updates to avoid relationship lazy loads
    async with AsyncSessionLocal() as session:
        # Set RUNNING
        await session.execute(
            update(Job)
            .where(Job.id == job_id)
            .values(status=JobStatus.RUNNING, started_at=datetime.utcnow(), processed_iocs=0, successful_iocs=0, failed_iocs=0)
        )
        await session.commit()

        # Get upload.created_at for this job
        res = await session.execute(
            select(Upload.created_at).join(Job, Upload.id == Job.upload_id).where(Job.id == job_id)
        )
        upload_created_at = res.scalar_one_or_none()

        if upload_created_at is None:
            await session.execute(
                update(Job).where(Job.id == job_id).values(status=JobStatus.ERROR, error_message="Upload not found", finished_at=datetime.utcnow())
            )
            await session.commit()
            return {"message": "Enrichment job failed: upload not found"}

        # Select IOCs to enrich
        from app.models.ioc import IOC
        res = await session.execute(select(IOC).where(IOC.created_at >= upload_created_at))
        iocs = res.scalars().all()

        pipeline = EnrichmentPipeline()
        successful = 0
        failed = 0
        processed = 0
        try:
            for ioc in iocs:
                try:
                    # Enrich
                    enrichment_results = await pipeline.enrich_ioc(ioc, session)

                    # Compute and persist scores (to populate latest_score in UI)
                    risk_score = pipeline.calculate_risk_score(enrichment_results)
                    attribution_score = pipeline.calculate_attribution_score(enrichment_results)
                    risk_band = pipeline.get_risk_band(risk_score)
                    session.add(IOCScore(
                        ioc_id=ioc.id,
                        risk_score=risk_score,
                        attribution_score=attribution_score,
                        risk_band=risk_band,
                    ))
                    successful += 1
                except Exception as e:
                    failed += 1
                finally:
                    processed += 1
                    await session.execute(
                        update(Job).where(Job.id == job_id).values(processed_iocs=processed)
                    )
                    await session.commit()

            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status=JobStatus.DONE,
                    finished_at=datetime.utcnow(),
                    total_iocs=len(iocs),
                    successful_iocs=successful,
                    failed_iocs=failed,
                    error_message=None,
                )
            )
            await session.commit()
            return {"message": "Enrichment job completed"}
        except Exception as e:
            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(status=JobStatus.ERROR, error_message=str(e), finished_at=datetime.utcnow())
            )
            await session.commit()
            return {"message": "Enrichment job failed"}
