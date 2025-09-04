"""
VirusTotal API adapter
"""

from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings
from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class VirusTotalAdapter(BaseAdapter):
    """VirusTotal API adapter"""
    
    def __init__(self):
        super().__init__("virustotal")
        self.api_key = settings.VIRUSTOTAL_API_KEY
        self.base_url = "https://www.virustotal.com/api/v3"
        
        if not self.api_key:
            logger.warning("VirusTotal API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "X-Apikey": self.api_key,
            "Accept": "application/json"
        }
    
    def _get_endpoint(self, ioc_type: str) -> str:
        """Get API endpoint for IOC type"""
        endpoints = {
            "url": "/urls",
            "domain": "/domains",
            "ipv4": "/ip_addresses",
            "sha256": "/files",
            "md5": "/files"
        }
        return endpoints.get(ioc_type, "/files")
    
    def _extract_confidence(self, raw_data: Dict[str, Any]) -> Optional[int]:
        """Extract confidence from VirusTotal data"""
        stats = raw_data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        total = malicious + suspicious + stats.get("undetected", 0)
        
        if total > 0:
            confidence = min(100, int((malicious + suspicious) / total * 100))
            return confidence
        
        return None
    
    def _extract_actors_families(self, raw_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract actor and family from VirusTotal data"""
        attributes = raw_data.get("data", {}).get("attributes", {})
        
        # Get threat classification
        threat_classification = attributes.get("popular_threat_classification", {})
        if threat_classification:
            # Get the most common classification
            classifications = threat_classification.get("suggested_threat_label", [])
            if classifications:
                # Parse threat label for actor/family
                threat_label = classifications[0]
                # Simple parsing - could be improved
                if ":" in threat_label:
                    family, actor = threat_label.split(":", 1)
                    return actor.strip(), family.strip()
                else:
                    return None, threat_label.strip()
        
        return None, None
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with VirusTotal data"""
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
        
        endpoint = self._get_endpoint(ioc_type)
        url = f"{self.base_url}{endpoint}/{ioc_value}"
        
        try:
            response = await self._make_request(url, headers=self._get_headers())
            
            if response.status_code == 200:
                raw_data = response.json()
                attributes = raw_data.get("data", {}).get("attributes", {})
                
                # Extract verdict from last analysis stats
                stats = attributes.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)
                
                if malicious > 0:
                    verdict = "malicious"
                elif suspicious > 0:
                    verdict = "suspicious"
                else:
                    verdict = "benign"
                
                # Extract confidence
                confidence = self._extract_confidence(raw_data)
                
                # Extract actor and family
                actor, family = self._extract_actors_families(raw_data)
                
                # Build evidence
                evidence_parts = []
                if malicious > 0:
                    evidence_parts.append(f"{malicious} engines detected as malicious")
                if suspicious > 0:
                    evidence_parts.append(f"{suspicious} engines detected as suspicious")
                
                evidence = "; ".join(evidence_parts) if evidence_parts else "No detections"
                
                return {
                    "verdict": verdict,
                    "confidence": confidence,
                    "actor": actor,
                    "family": family,
                    "evidence": evidence,
                    "http_status": response.status_code,
                    "raw_json": raw_data
                }
            
            elif response.status_code == 404:
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": "Not found in VirusTotal",
                    "http_status": response.status_code,
                    "raw_json": None
                }
            
            else:
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": f"API error: {response.status_code}",
                    "http_status": response.status_code,
                    "raw_json": None
                }
                
        except Exception as e:
            logger.error(
                "VirusTotal enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
