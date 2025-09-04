"""
Enrichment pipeline for processing IOCs
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.ioc import IOC, IOCScore, RiskBand
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
                
                # Store enrichment result
                enrichment_result = EnrichmentResult(
                    ioc_id=ioc.id,
                    provider=provider_name,
                    raw_json=enrichment_data.get("raw_json"),
                    verdict=enrichment_data.get("verdict", "unknown"),
                    first_seen=enrichment_data.get("first_seen"),
                    last_seen=enrichment_data.get("last_seen"),
                    actor=enrichment_data.get("actor"),
                    family=enrichment_data.get("family"),
                    confidence=enrichment_data.get("confidence"),
                    evidence=enrichment_data.get("evidence"),
                    http_status=enrichment_data.get("http_status")
                )
                
                db.add(enrichment_result)
                results[provider_name] = enrichment_data
                
            except Exception as e:
                logger.error(
                    "Provider enrichment failed",
                    ioc_id=ioc.id,
                    provider=provider_name,
                    error=str(e)
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
        
        try:
            # Get all IOCs for this job's upload
            result = await db.execute(
                select(IOC).where(IOC.id.in_(
                    select(IOC.id).where(IOC.created_at >= job.upload.created_at)
                ))
            )
            iocs = result.scalars().all()
            
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
                error=str(e)
            )
            
            # Update job status to error
            job.status = JobStatus.ERROR
            job.error_message = str(e)
            job.finished_at = datetime.utcnow()
            await db.commit()
