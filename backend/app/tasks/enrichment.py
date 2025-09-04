"""
Celery tasks for enrichment processing
"""

import asyncio
from typing import Any

import structlog
from celery import current_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.enrichment_pipeline import EnrichmentPipeline

logger = structlog.get_logger(__name__)


@celery_app.task(bind=True)
def process_enrichment_job(self, job_id: int) -> Any:
    """Process enrichment job asynchronously"""
    
    async def _process_job():
        """Async job processing"""
        async with AsyncSessionLocal() as db:
            pipeline = EnrichmentPipeline()
            await pipeline.process_job(job_id, db)
    
    try:
        # Run async task
        asyncio.run(_process_job())
        
        logger.info("Enrichment job completed", job_id=job_id)
        return {"status": "completed", "job_id": job_id}
        
    except Exception as e:
        logger.error("Enrichment job failed", job_id=job_id, error=str(e))
        
        # Update task state
        current_task.update_state(
            state="FAILURE",
            meta={"error": str(e), "job_id": job_id}
        )
        
        raise
