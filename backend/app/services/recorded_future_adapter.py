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
        
        try:
            # Build candidate risk endpoints (per official patterns) and try in order
            candidates: list[tuple[str, str, dict]] = []
            if ioc_type == "ipv4":
                candidates.extend([
                    ("GET", f"{self.base_url}/ip/risk", {"ip": ioc_value}),
                    ("GET", f"{self.base_url}/ip/{ioc_value}", {}),
                ])
            elif ioc_type == "domain":
                candidates.extend([
                    ("GET", f"{self.base_url}/domain/risk", {"domain": ioc_value}),
                    ("GET", f"{self.base_url}/domain/{ioc_value}", {}),
                ])
            elif ioc_type == "url":
                candidates.extend([
                    ("GET", f"{self.base_url}/url/risk", {"url": ioc_value}),
                    ("GET", f"{self.base_url}/url/{ioc_value}", {}),
                ])
            elif ioc_type in ("sha256", "md5"):
                candidates.extend([
                    ("GET", f"{self.base_url}/hash/risk", {"hash": ioc_value}),
                    ("GET", f"{self.base_url}/hash/{ioc_value}", {}),
                ])
            elif ioc_type == "email":
                candidates.extend([
                    ("GET", f"{self.base_url}/email/risk", {"email": ioc_value}),
                    ("GET", f"{self.base_url}/email/{ioc_value}", {}),
                ])
            else:
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": f"Unsupported IOC type: {ioc_type}",
                    "http_status": None,
                    "raw_json": None
                }

            last_status = None
            last_body: Any = None
            for method, url, params in candidates:
                resp = await self._make_request(url, headers=self._get_headers(), method=method, params=params if params else None)  # type: ignore
                last_status = resp.status_code
                if resp.status_code == 200:
                    raw = resp.json() or {}
                    entity = raw.get("data") or raw  # support both shapes
                    # Extract risk
                    risk = entity.get("risk") or {}
                    risk_score = risk.get("score", 0)
                    verdict = self._extract_verdict({"risk": {"score": risk_score}})
                    # Extract actor/family from evidenceDetails if present
                    actor = None
                    family = None
                    ev = risk.get("evidenceDetails") or entity.get("evidenceDetails") or []
                    if isinstance(ev, list):
                        for item in ev:
                            if not actor and isinstance(item, dict) and item.get("threatActor"):
                                actor = item.get("threatActor")
                            if not family and isinstance(item, dict) and item.get("malware"):
                                family = item.get("malware")
                            if actor and family:
                                break
                    if not actor or not family:
                        a2, f2 = self._extract_actors_families(entity)
                        actor = actor or a2
                        family = family or f2
                    # Timestamps
                    ts = entity.get("timestamps") or {}
                    first_seen = ts.get("firstSeen")
                    last_seen = ts.get("lastSeen")
                    # Evidence summary
                    evidence_parts = []
                    if risk_score:
                        evidence_parts.append(f"Risk Score: {risk_score}")
                    rules = risk.get("rules")
                    if isinstance(rules, list):
                        evidence_parts.append(f"Risk Rules: {len(rules)}")
                    if first_seen:
                        evidence_parts.append("First Seen: Available")
                    if last_seen:
                        evidence_parts.append("Last Seen: Available")
                    evidence = "; ".join(evidence_parts) if evidence_parts else "Recorded Future intelligence available"

                    return {
                        "verdict": verdict,
                        "confidence": risk_score,
                        "actor": actor,
                        "family": family,
                        "evidence": evidence,
                        "http_status": resp.status_code,
                        "raw_json": entity,
                        "first_seen": first_seen,
                        "last_seen": last_seen,
                    }
                else:
                    try:
                        last_body = resp.text
                    except Exception:
                        last_body = None

            # No 200 responses
            if last_status == 404:
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": "Not found in Recorded Future intelligence",
                    "http_status": last_status,
                    "raw_json": None,
                }
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"API error: {last_status}",
                "http_status": last_status,
                "raw_json": last_body,
            }
                
        except Exception as e:
            logger.error(
                "Recorded Future enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
