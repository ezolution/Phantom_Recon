"""
Enrichment pipeline for processing IOCs
"""

from datetime import datetime, timedelta, timezone
import json
from typing import Any, Dict, List, Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.models.ioc import IOC, IOCScore, RiskBand
from app.models.upload import Upload
from app.models.enrichment import EnrichmentResult
from app.models.job import Job, JobStatus
from app.services.virustotal_adapter import VirusTotalAdapter
from app.services.urlscan_adapter import URLScanAdapter
from app.services.osint_adapter import OSINTAdapter
from app.services.crowdstrike_adapter import CrowdStrikeAdapter
from app.services.flashpoint_adapter import FlashpointAdapter
from app.services.recorded_future_adapter import RecordedFutureAdapter

logger = structlog.get_logger(__name__)


class EnrichmentPipeline:
    """Enrichment pipeline for processing IOCs"""
    
    def __init__(self):
        self.adapters = {
            "virustotal": VirusTotalAdapter(),
            "urlscan": URLScanAdapter(),
            "osint": OSINTAdapter(),
            "crowdstrike": CrowdStrikeAdapter(),
            "flashpoint": FlashpointAdapter(),
            "recorded_future": RecordedFutureAdapter()
        }
    
    async def enrich_ioc(self, ioc: IOC, db: AsyncSession) -> Dict[str, Any]:
        """Enrich a single IOC with all available providers"""
        results = {}
        
        for provider_name, adapter in self.adapters.items():
            try:
                logger.info(
                    "Enriching IOC",
                    ioc_id=ioc.id,
                    ioc_type=ioc.type,
                    ioc_value=ioc.value[:50] + "..." if len(ioc.value) > 50 else ioc.value,
                    provider=provider_name
                )
                
                # Enrich with provider
                enrichment_data = await adapter.enrich_with_cache(ioc.value, ioc.type)
                
                # Normalize datetime fields
                def _to_datetime(value: Any) -> Optional[datetime]:
                    if value is None:
                        return None
                    if isinstance(value, datetime):
                        # Ensure stored as naive UTC
                        if value.tzinfo is not None:
                            return value.astimezone(timezone.utc).replace(tzinfo=None)
                        return value
                    if isinstance(value, (int, float)):
                        # Treat as epoch seconds (UTC)
                        return datetime.utcfromtimestamp(value)
                    if isinstance(value, str):
                        try:
                            dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                            if dt.tzinfo is not None:
                                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                            return dt
                        except Exception:
                            return None
                    return None

                first_seen_dt = _to_datetime(enrichment_data.get("first_seen"))
                last_seen_dt = _to_datetime(enrichment_data.get("last_seen"))

                # Ensure raw_json is JSON-serializable (e.g., httpx.URL -> str)
                def _json_safe(value: Any) -> Any:
                    try:
                        json.dumps(value)
                        return value
                    except TypeError:
                        pass
                    # Strings that look like JSON -> parse to dict to satisfy schema
                    if isinstance(value, str):
                        try:
                            parsed = json.loads(value)
                            # Only accept dict/list; otherwise drop
                            if isinstance(parsed, (dict, list)):
                                return parsed
                        except Exception:
                            return None
                    # dicts
                    if isinstance(value, dict):
                        return {k: _json_safe(v) for k, v in value.items()}
                    # lists/tuples/sets
                    if isinstance(value, (list, tuple, set)):
                        return [_json_safe(v) for v in value]
                    # httpx.URL or similar objects -> str
                    try:
                        from httpx import URL  # type: ignore
                        if isinstance(value, URL):
                            return str(value)
                    except Exception:
                        pass
                    # fallback: stringify unknown objects
                    try:
                        return str(value)
                    except Exception:
                        return None

                raw_json_sanitized = _json_safe(enrichment_data.get("raw_json"))

                # Dedupe: keep only the latest result per provider per IOC
                try:
                    await db.execute(
                        delete(EnrichmentResult)
                        .where(
                            EnrichmentResult.ioc_id == ioc.id,
                            EnrichmentResult.provider == provider_name,
                        )
                    )
                except Exception:
                    # best-effort; if delete fails, we still insert latest row
                    pass

                # Store enrichment result
                enrichment_result = EnrichmentResult(
                    ioc_id=ioc.id,
                    provider=provider_name,
                    raw_json=raw_json_sanitized,
                    verdict=enrichment_data.get("verdict", "unknown"),
                    first_seen=first_seen_dt,
                    last_seen=last_seen_dt,
                    actor=enrichment_data.get("actor"),
                    family=enrichment_data.get("family"),
                    confidence=enrichment_data.get("confidence"),
                    evidence=enrichment_data.get("evidence"),
                    http_status=enrichment_data.get("http_status")
                )
                
                db.add(enrichment_result)
                # Commit after each provider to isolate failures
                try:
                    await db.commit()
                except Exception as commit_exc:
                    await db.rollback()
                    logger.error(
                        "Provider result commit failed",
                        ioc_id=ioc.id,
                        provider=provider_name,
                        error=str(commit_exc),
                        exc_info=True
                    )
                    # Skip adding a separate error record to avoid cascading failures
                    continue
                results[provider_name] = enrichment_data
                
            except Exception as e:
                logger.error(
                    "Provider enrichment failed",
                    ioc_id=ioc.id,
                    provider=provider_name,
                    error=str(e),
                    exc_info=True
                )
                
                # Store error result
                error_result = EnrichmentResult(
                    ioc_id=ioc.id,
                    provider=provider_name,
                    verdict="unknown",
                    evidence=f"Error: {str(e)}",
                    http_status=500
                )
                
                db.add(error_result)
                results[provider_name] = {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": f"Error: {str(e)}",
                    "http_status": 500,
                    "raw_json": None
                }
        
        await db.commit()
        return results
    
    def calculate_risk_score(self, enrichment_results: Dict[str, Any]) -> int:
        """Calculate risk score based on enrichment results"""
        score = 0
        
        # Base score starts at 0
        
        # Check for malicious verdicts
        malicious_count = 0
        suspicious_count = 0
        provider_agreement = 0
        
        for provider, result in enrichment_results.items():
            verdict = result.get("verdict", "unknown")
            confidence = result.get("confidence", 0) or 0
            
            if verdict == "malicious":
                malicious_count += 1
                score += 15
                provider_agreement += 1
            elif verdict == "suspicious":
                suspicious_count += 1
                score += 5
                provider_agreement += 1
        
        # Multiple provider agreement (≥3)
        if provider_agreement >= 3:
            score += 10
        
        # Active in last 7 days (simplified check)
        # In a real implementation, you'd check first_seen/last_seen dates
        # For now, we'll add this if any provider has recent data
        for provider, result in enrichment_results.items():
            if result.get("last_seen"):
                # Check if last_seen is within 7 days
                last_seen = result.get("last_seen")
                if isinstance(last_seen, str):
                    try:
                        last_seen_dt = datetime.fromisoformat(last_seen.replace('Z', '+00:00'))
                        if last_seen_dt > datetime.utcnow() - timedelta(days=7):
                            score += 10
                            break
                    except Exception:
                        pass
        
        # Linked to known actor/tool
        for provider, result in enrichment_results.items():
            if result.get("actor") or result.get("family"):
                score += 10
                break
        
        # Cap at 100
        return min(100, score)
    
    def calculate_attribution_score(self, enrichment_results: Dict[str, Any]) -> int:
        """Calculate attribution score based on enrichment results"""
        score = 0
        
        # Check for actor information
        actors = set()
        families = set()
        
        for provider, result in enrichment_results.items():
            actor = result.get("actor")
            family = result.get("family")
            
            if actor:
                actors.add(actor)
            if family:
                families.add(family)
        
        # Score based on attribution information
        if actors:
            score += 40
        if families:
            score += 30
        
        # Additional points for multiple sources confirming attribution
        if len(actors) > 1 or len(families) > 1:
            score += 20
        
        # Cap at 100
        return min(100, score)
    
    def get_risk_band(self, risk_score: int) -> RiskBand:
        """Get risk band from risk score"""
        if risk_score <= 24:
            return RiskBand.LOW
        elif risk_score <= 49:
            return RiskBand.MEDIUM
        elif risk_score <= 74:
            return RiskBand.HIGH
        else:
            return RiskBand.CRITICAL
    
    async def process_job(self, job_id: int, db: AsyncSession) -> None:
        """Process all IOCs in a job"""
        logger.info("Job start", job_id=job_id)
        # Get job
        result = await db.execute(select(Job).where(Job.id == job_id))
        job = result.scalar_one_or_none()
        
        if not job:
            logger.error("Job not found", job_id=job_id)
            return
        
        # Update job status to running
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        await db.commit()
        logger.info("Job set to running", job_id=job_id)
        
        try:
            # Get upload timestamp explicitly to avoid lazy-load in async context
            up_res = await db.execute(select(Upload.created_at).where(Upload.id == job.upload_id))
            upload_created_at = up_res.scalar_one_or_none()
            if upload_created_at is None:
                logger.error("Upload not found for job", job_id=job_id, upload_id=job.upload_id)
                iocs = []
            else:
                result = await db.execute(
                    select(IOC).where(IOC.created_at >= upload_created_at)
                )
                iocs = result.scalars().all()
            logger.info("IOCs selected for job", job_id=job_id, ioc_count=len(iocs))
            
            job.total_iocs = len(iocs)
            successful_iocs = 0
            failed_iocs = 0
            
            for ioc in iocs:
                try:
                    # Enrich IOC
                    enrichment_results = await self.enrich_ioc(ioc, db)
                    
                    # Calculate scores
                    risk_score = self.calculate_risk_score(enrichment_results)
                    attribution_score = self.calculate_attribution_score(enrichment_results)
                    risk_band = self.get_risk_band(risk_score)
                    
                    # Store scores
                    ioc_score = IOCScore(
                        ioc_id=ioc.id,
                        risk_score=risk_score,
                        attribution_score=attribution_score,
                        risk_band=risk_band
                    )
                    
                    db.add(ioc_score)
                    successful_iocs += 1
                    
                    logger.info(
                        "IOC enriched successfully",
                        ioc_id=ioc.id,
                        risk_score=risk_score,
                        attribution_score=attribution_score,
                        risk_band=risk_band
                    )
                    
                except Exception as e:
                    logger.error(
                        "IOC enrichment failed",
                        ioc_id=ioc.id,
                        error=str(e)
                    )
                    failed_iocs += 1
                
                # Update job progress
                job.processed_iocs += 1
                await db.commit()
            
            # Update job status
            job.status = JobStatus.DONE
            job.finished_at = datetime.utcnow()
            job.successful_iocs = successful_iocs
            job.failed_iocs = failed_iocs
            await db.commit()
            
            logger.info(
                "Job completed",
                job_id=job_id,
                total_iocs=job.total_iocs,
                successful_iocs=successful_iocs,
                failed_iocs=failed_iocs
            )
            
        except Exception as e:
            logger.error(
                "Job processing failed",
                job_id=job_id,
                error=str(e),
                exc_info=True
            )
            
            # Update job status to error
            job.status = JobStatus.ERROR
            job.error_message = str(e)
            job.finished_at = datetime.utcnow()
            await db.commit()
