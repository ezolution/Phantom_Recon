"""
URLScan.io API adapter (search-only)
"""

import asyncio
import time
from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings
from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class URLScanAdapter(BaseAdapter):
    """URLScan.io API adapter

    Search-only policy: we NEVER submit new scans to avoid tipping off adversaries
    or leaking sensitive indicators. If no prior result is found, we return a
    safe 'unknown' verdict with a clear evidence note.
    """
    
    def __init__(self):
        super().__init__("urlscan")
        self.api_key = settings.URLSCAN_API_KEY
        self.base_url = "https://urlscan.io/api/v1"
        
        if not self.api_key:
            logger.warning("URLScan API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "API-Key": self.api_key,
            "Content-Type": "application/json"
        }
    
    async def _submit_scan(self, url: str) -> Optional[str]:
        """(Disabled) Submit URL for scanning.
        Retained for reference but not used due to search-only policy.
        """
        logger.info("URLScan submit suppressed due to search-only policy", url=url)
        return None
    
    async def _get_scan_result(self, scan_id: str) -> Optional[Dict[str, Any]]:
        """Get scan result"""
        result_url = f"{self.base_url}/result/{scan_id}/"
        
        try:
            response = await self._make_request(result_url)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(
                    "URLScan result fetch failed",
                    scan_id=scan_id,
                    status_code=response.status_code
                )
                return None
                
        except Exception as e:
            logger.error("URLScan result error", scan_id=scan_id, error=str(e))
            return None
    
    async def _search_existing(self, url: str) -> Optional[Dict[str, Any]]:
        """Search for existing scan results"""
        search_url = f"{self.base_url}/search/"
        
        params = {
            "q": f"page.url:{url}",
            "size": 1
        }
        
        try:
            response = await self._make_request(search_url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                if results:
                    return results[0]
                    
        except Exception as e:
            logger.error("URLScan search error", error=str(e))
            
        return None
    
    def _extract_verdict(self, result_data: Dict[str, Any]) -> str:
        """Extract verdict from URLScan result"""
        # Check for malicious indicators
        verdicts = result_data.get("verdicts", {})
        
        # Check overall verdict
        overall = verdicts.get("overall", {})
        if overall.get("malicious"):
            return "malicious"
        
        # Check URL verdict
        url_verdict = verdicts.get("urls", {})
        if url_verdict.get("malicious"):
            return "malicious"
        
        # Check domain verdict
        domain_verdict = verdicts.get("domains", {})
        if domain_verdict.get("malicious"):
            return "malicious"
        
        # Check for suspicious indicators
        if (overall.get("suspicious") or 
            url_verdict.get("suspicious") or 
            domain_verdict.get("suspicious")):
            return "suspicious"
        
        return "benign"
    
    def _extract_confidence(self, result_data: Dict[str, Any]) -> Optional[int]:
        """Extract confidence from URLScan result"""
        verdicts = result_data.get("verdicts", {})
        overall = verdicts.get("overall", {})
        
        # Simple confidence based on verdict strength
        if overall.get("malicious"):
            return 90
        elif overall.get("suspicious"):
            return 60
        else:
            return 10
    
    def _extract_evidence(self, result_data: Dict[str, Any]) -> str:
        """Extract evidence from URLScan result"""
        evidence_parts = []
        
        # Get page info
        page = result_data.get("page", {})
        if page:
            title = page.get("title", "")
            if title:
                evidence_parts.append(f"Page title: {title}")
        
        # Get verdict details
        verdicts = result_data.get("verdicts", {})
        overall = verdicts.get("overall", {})
        
        if overall.get("malicious"):
            evidence_parts.append("Overall verdict: malicious")
        elif overall.get("suspicious"):
            evidence_parts.append("Overall verdict: suspicious")
        
        # Get screenshot URL if available
        task = result_data.get("task", {})
        screenshot_url = task.get("screenshotURL")
        if screenshot_url:
            evidence_parts.append(f"Screenshot: {screenshot_url}")
        
        return "; ".join(evidence_parts) if evidence_parts else "No specific evidence"
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with URLScan data (search-only)"""
        if not self.api_key:
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": "API key not configured",
                "http_status": None,
                "raw_json": None
            }
        
        # Only support URL and domain types
        if ioc_type not in ["url", "domain"]:
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"Unsupported IOC type: {ioc_type}",
                "http_status": None,
                "raw_json": None
            }
        
        # Normalize URL
        url = f"https://{ioc_value}" if ioc_type == "domain" else ioc_value
        
        try:
            # Search for existing results only (no submission)
            existing_result = await self._search_existing(url)
            if existing_result:
                verdict = self._extract_verdict(existing_result)
                confidence = self._extract_confidence(existing_result)
                evidence = self._extract_evidence(existing_result)
                
                return {
                    "verdict": verdict,
                    "confidence": confidence,
                    "actor": None,
                    "family": None,
                    "evidence": evidence,
                    "http_status": 200,
                    "raw_json": existing_result
                }
            
            # No prior result; do not submit
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": "No prior URLScan result found; submission disabled by policy",
                "http_status": 204,
                "raw_json": None
            }
            
        except Exception as e:
            logger.error(
                "URLScan enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
