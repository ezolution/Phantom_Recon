"""
Recorded Future API adapter
"""

from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings
from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class RecordedFutureAdapter(BaseAdapter):
    """Recorded Future API adapter"""
    
    def __init__(self):
        super().__init__("recorded_future")
        self.api_key = settings.RECORDED_FUTURE_API_KEY
        self.base_url = "https://api.recordedfuture.com/v2"
        
        if not self.api_key:
            logger.warning("Recorded Future API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "X-RFToken": self.api_key,
            "Accept": "application/json"
        }
    
    def _extract_verdict(self, raw_data: Dict[str, Any]) -> str:
        """Extract verdict from Recorded Future data"""
        # Recorded Future provides risk scores and rules
        risk_score = raw_data.get("risk", {}).get("score", 0)
        
        if risk_score >= 80:
            return "malicious"
        elif risk_score >= 40:
            return "suspicious"
        else:
            return "benign"
    
    def _extract_actors_families(self, raw_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract actor and family from Recorded Future data"""
        # Recorded Future provides entity information
        actor = None
        family = None
        
        # Check for threat actors
        if raw_data.get("threat_actors"):
            actors = raw_data["threat_actors"]
            if isinstance(actors, list) and actors:
                actor = actors[0].get("name")
        
        # Check for malware families
        if raw_data.get("malware_families"):
            families = raw_data["malware_families"]
            if isinstance(families, list) and families:
                family = families[0].get("name")
        
        return actor, family
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with Recorded Future data"""
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
        
        # Map IOC type to Recorded Future entity type
        entity_type_map = {
            "url": "URL",
            "domain": "Domain",
            "ipv4": "IPAddress",
            "sha256": "Hash",
            "md5": "Hash",
            "email": "EmailAddress"
        }
        
        rf_type = entity_type_map.get(ioc_type)
        if not rf_type:
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"Unsupported IOC type: {ioc_type}",
                "http_status": None,
                "raw_json": None
            }
        
        try:
            # Search for entity
            search_url = f"{self.base_url}/{rf_type.lower()}/{ioc_value}"
            
            response = await self._make_request(
                search_url,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                entity = data.get("data", {})
                
                if entity:
                    # Extract verdict
                    verdict = self._extract_verdict(entity)
                    
                    # Extract actor and family
                    actor, family = self._extract_actors_families(entity)
                    
                    # Build evidence
                    evidence_parts = []
                    if entity.get("risk", {}).get("score"):
                        evidence_parts.append(f"Risk Score: {entity['risk']['score']}")
                    if entity.get("risk", {}).get("rules"):
                        rules = entity["risk"]["rules"]
                        if isinstance(rules, list):
                            evidence_parts.append(f"Risk Rules: {len(rules)}")
                    if entity.get("timestamps", {}).get("firstSeen"):
                        evidence_parts.append("First Seen: Available")
                    if entity.get("timestamps", {}).get("lastSeen"):
                        evidence_parts.append("Last Seen: Available")
                    
                    evidence = "; ".join(evidence_parts) if evidence_parts else "Recorded Future intelligence available"
                    
                    return {
                        "verdict": verdict,
                        "confidence": entity.get("risk", {}).get("score"),
                        "actor": actor,
                        "family": family,
                        "evidence": evidence,
                        "http_status": response.status_code,
                        "raw_json": entity
                    }
                else:
                    return {
                        "verdict": "unknown",
                        "confidence": None,
                        "actor": None,
                        "family": None,
                        "evidence": "Not found in Recorded Future intelligence",
                        "http_status": response.status_code,
                        "raw_json": None
                    }
            
            elif response.status_code == 404:
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": "Not found in Recorded Future intelligence",
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
                "Recorded Future enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
