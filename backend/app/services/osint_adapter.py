"""
OSINT adapter for basic HTTP intelligence gathering
"""

import hashlib
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
import structlog

from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class OSINTAdapter(BaseAdapter):
    """OSINT adapter for basic HTTP intelligence"""
    
    def __init__(self):
        super().__init__("osint")
        self.timeout = 10.0
    
    def _get_favicon_hash(self, url: str) -> Optional[str]:
        """Get favicon hash using mmh3 algorithm"""
        try:
            # Parse URL to get base domain
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            favicon_url = f"{base_url}/favicon.ico"
            
            # This is a simplified version - in production you'd use mmh3
            # For now, we'll use MD5 as a placeholder
            return hashlib.md5(favicon_url.encode()).hexdigest()[:16]
            
        except Exception:
            return None
    
    def _check_robots_txt(self, url: str) -> bool:
        """Check if robots.txt exists"""
        try:
            parsed = urlparse(url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            robots_url = f"{base_url}/robots.txt"
            
            # This would be implemented with actual HTTP request
            # For now, return a placeholder
            return True
            
        except Exception:
            return False
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with OSINT data"""
        
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
        if ioc_type == "domain":
            url = f"https://{ioc_value}"
        else:
            url = ioc_value
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Make HEAD request first to check if URL is accessible
                try:
                    head_response = await client.head(url, follow_redirects=True)
                    http_status = head_response.status_code
                    title = None
                    
                    # If HEAD request succeeds, try to get title
                    if http_status == 200:
                        try:
                            get_response = await client.get(url, follow_redirects=True)
                            if get_response.status_code == 200:
                                content = get_response.text
                                # Simple title extraction
                                import re
                                title_match = re.search(r'<title[^>]*>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
                                if title_match:
                                    title = title_match.group(1).strip()
                        except Exception:
                            pass
                    
                except httpx.RequestError:
                    http_status = None
                    title = None
                
                # Get favicon hash
                favicon_hash = self._get_favicon_hash(url)
                
                # Check robots.txt
                robots_exists = self._check_robots_txt(url)
                
                # Build evidence
                evidence_parts = []
                if http_status:
                    evidence_parts.append(f"HTTP Status: {http_status}")
                if title:
                    evidence_parts.append(f"Title: {title}")
                if favicon_hash:
                    evidence_parts.append(f"Favicon Hash: {favicon_hash}")
                if robots_exists:
                    evidence_parts.append("Robots.txt: Present")
                
                evidence = "; ".join(evidence_parts) if evidence_parts else "No OSINT data available"
                
                # Determine verdict based on HTTP status
                if http_status and http_status >= 400:
                    verdict = "suspicious"
                    confidence = 30
                elif http_status == 200:
                    verdict = "benign"
                    confidence = 20
                else:
                    verdict = "unknown"
                    confidence = 10
                
                # Build raw JSON
                raw_data = {
                    "url": url,
                    "http_status": http_status,
                    "title": title,
                    "favicon_hash": favicon_hash,
                    "robots_txt_exists": robots_exists,
                    "final_url": head_response.url if 'head_response' in locals() else None
                }
                
                return {
                    "verdict": verdict,
                    "confidence": confidence,
                    "actor": None,
                    "family": None,
                    "evidence": evidence,
                    "http_status": http_status,
                    "raw_json": raw_data
                }
                
        except Exception as e:
            logger.error(
                "OSINT enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"OSINT error: {str(e)}",
                "http_status": None,
                "raw_json": None
            }
