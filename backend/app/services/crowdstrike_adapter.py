"""
CrowdStrike Intel API adapter
"""

from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings
from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class CrowdStrikeAdapter(BaseAdapter):
    """CrowdStrike Intel API adapter"""
    
    def __init__(self):
        super().__init__("crowdstrike")
        self.client_id = settings.CROWDSTRIKE_CLIENT_ID
        self.client_secret = settings.CROWDSTRIKE_CLIENT_SECRET
        self.base_url = "https://api.crowdstrike.com"
        self.access_token = None
        
        if not self.client_id or not self.client_secret:
            logger.warning("CrowdStrike API credentials not configured")
    
    async def _get_access_token(self) -> Optional[str]:
        """Get OAuth2 access token"""
        if self.access_token:
            return self.access_token
        
        if not self.client_id or not self.client_secret:
            return None
        
        try:
            token_url = f"{self.base_url}/oauth2/token"
            data = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(token_url, data=data)
                
                if response.status_code in (200, 201):
                    token_data = response.json()
                    self.access_token = token_data.get("access_token")
                    return self.access_token
                else:
                    logger.error(
                        "CrowdStrike token request failed",
                        status_code=response.status_code,
                        response=response.text
                    )
                    return None
                    
        except Exception as e:
            logger.error("CrowdStrike token error", error=str(e))
            return None
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json"
        }
    
    def _extract_verdict(self, raw_data: Dict[str, Any]) -> str:
        """Extract verdict from CrowdStrike data (best-effort)."""
        # Prefer malicious_confidence textual level
        conf = (raw_data.get("malicious_confidence") or "").lower()
        if conf in {"high", "very-high", "critical"}:
            return "malicious"
        if conf in {"medium", "moderate"}:
            return "suspicious"
        if conf in {"low", "unknown", "unverified"}:
            # Fall through to label checks
            pass
        
        # Look at labels/tags
        labels = raw_data.get("labels") or raw_data.get("tags") or []
        labels_lc = [str(x).lower() for x in labels]
        if any("malicious" in x or "malware" in x for x in labels_lc):
            return "malicious"
        if any("suspicious" in x for x in labels_lc):
            return "suspicious"
        
        return "benign"
    
    def _extract_actors_families(self, raw_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract actor and family from CrowdStrike data (robust to schema)."""
        actor: Optional[str] = None
        family: Optional[str] = None
        
        # Actors may be an array or object
        if isinstance(raw_data.get("actors"), list) and raw_data["actors"]:
            actor = str(raw_data["actors"][0])
        elif isinstance(raw_data.get("actor"), dict):
            actor = raw_data["actor"].get("name")
        elif isinstance(raw_data.get("actor"), str):
            actor = raw_data.get("actor")
        
        # Families may be array or object
        if isinstance(raw_data.get("malware_families"), list) and raw_data["malware_families"]:
            family = str(raw_data["malware_families"][0])
        elif isinstance(raw_data.get("malware_family"), dict):
            family = raw_data["malware_family"].get("name")
        elif isinstance(raw_data.get("family"), str):
            family = raw_data.get("family")
        
        return actor, family
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with CrowdStrike data"""
        if not self.client_id or not self.client_secret:
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": "API credentials not configured",
                "http_status": None,
                "raw_json": None
            }
        
        # Get access token
        token = await self._get_access_token()
        if not token:
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": "Failed to obtain access token",
                "http_status": 401,
                "raw_json": None
            }
        
        # Map IOC type to CrowdStrike indicator type
        indicator_type_map = {
            "url": "url",
            "domain": "domain",
            "ipv4": "ip_address",
            "sha256": "file_hash",
            "md5": "file_hash",
            "email": "email_address"
        }
        
        cs_type = indicator_type_map.get(ioc_type)
        if not cs_type:
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
            # Search for indicators (use indicator field; optionally constrain by type)
            search_url = f"{self.base_url}/intel/combined/indicators/v1"
            filter_parts = [f"indicator:'{ioc_value}'"]
            if cs_type:
                filter_parts.append(f"type:'{cs_type}'")
            params = {"filter": "+".join(filter_parts), "limit": 1}
            
            response = await self._make_request(
                search_url, 
                headers=self._get_headers(),
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                resources = data.get("resources", []) or data.get("errors", []) and []
                
                if resources:
                    indicator = resources[0]
                    
                    # Extract verdict
                    verdict = self._extract_verdict(indicator)
                    
                    # Extract actor and family
                    actor, family = self._extract_actors_families(indicator)
                    
                    # Dates
                    first_seen = indicator.get("published_date") or indicator.get("first_seen")
                    last_seen = indicator.get("last_updated") or indicator.get("last_seen")
                    
                    # Build evidence
                    evidence_parts = []
                    if indicator.get("malicious_confidence"):
                        evidence_parts.append(f"Malicious confidence: {indicator['malicious_confidence']}")
                    if indicator.get("confidence"):
                        evidence_parts.append(f"Confidence: {indicator['confidence']}")
                    labels = indicator.get("labels") or []
                    if labels:
                        evidence_parts.append("Labels: " + ", ".join(map(str, labels)))
                    
                    evidence = "; ".join(evidence_parts) if evidence_parts else "CrowdStrike intelligence available"
                    
                    return {
                        "verdict": verdict,
                        "confidence": indicator.get("confidence"),
                        "actor": actor,
                        "family": family,
                        "evidence": evidence,
                        "http_status": response.status_code,
                        "raw_json": indicator,
                        "first_seen": first_seen,
                        "last_seen": last_seen
                    }
                else:
                    return {
                        "verdict": "unknown",
                        "confidence": None,
                        "actor": None,
                        "family": None,
                        "evidence": "Not found in CrowdStrike intelligence",
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
                "CrowdStrike enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
