"""
Flashpoint API adapter
"""

from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings
from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


class FlashpointAdapter(BaseAdapter):
    """Flashpoint API adapter"""
    
    def __init__(self):
        super().__init__("flashpoint")
        self.api_key = settings.FLASHPOINT_API_KEY
        # Prefer env override; default to public API host
        self.base_url = settings.FLASHPOINT_BASE_URL or "https://api.flashpoint.io"
        
        if not self.api_key:
            logger.warning("Flashpoint API key not configured")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get API headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    
    def _extract_verdict(self, raw_data: Dict[str, Any]) -> str:
        """Extract verdict from Flashpoint data"""
        # Flashpoint provides risk scores and threat indicators
        risk_score = raw_data.get("risk_score", 0)
        
        if risk_score >= 80:
            return "malicious"
        elif risk_score >= 40:
            return "suspicious"
        else:
            return "benign"
    
    def _extract_actors_families(self, raw_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract actor and family from Flashpoint data"""
        # Flashpoint provides actor and malware family information
        actor = None
        family = None
        
        # Check for actor information
        if raw_data.get("actors"):
            actors = raw_data["actors"]
            if isinstance(actors, list) and actors:
                actor = actors[0].get("name")
        
        # Check for malware family
        if raw_data.get("malware_families"):
            families = raw_data["malware_families"]
            if isinstance(families, list) and families:
                family = families[0].get("name")
        
        return actor, family
    
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with Flashpoint data"""
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
        
        # Map IOC type to Flashpoint indicator type
        indicator_type_map = {
            "url": "url",
            "domain": "domain",
            "ipv4": "ip_address",
            "sha256": "file_hash",
            "md5": "file_hash",
            "email": "email_address"
        }
        
        fp_type = indicator_type_map.get(ioc_type)
        if not fp_type:
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
            # 1) Preferred REST route from Ignite docs: /technical-intelligence/v2/indicators
            try:
                # Construct q expressions likely supported by v2 search
                q_expressions = []
                if ioc_type == "sha256":
                    q_expressions.append(f"hashes.sha256:{ioc_value}")
                if ioc_type == "md5":
                    q_expressions.append(f"hashes.md5:{ioc_value}")
                # Generic value match for most types
                q_expressions.append(f"value:{ioc_value}")

                rest_candidates = []
                # v2 primary using q expressions
                for q in q_expressions:
                    rest_candidates.append((f"{self.base_url}/technical-intelligence/v2/indicators", {"q": q, "size": 1}))
                # also try simpler params in case deployment supports them
                rest_candidates.extend([
                    (f"{self.base_url}/technical-intelligence/v2/indicators", {"value": ioc_value, "size": 1}),
                    (f"{self.base_url}/technical-intelligence/v2/indicators", {"ioc_value": ioc_value, "size": 1}),
                    # v1 fallback (legacy params differ across deployments)
                    (f"{self.base_url}/technical-intelligence/v1/indicators", {"value": ioc_value, "size": 1}),
                    (f"{self.base_url}/technical-intelligence/v1/indicators", {"ioc_value": ioc_value, "size": 1}),
                ])
                for rest_url, params in rest_candidates:
                    rest_resp = await self._make_request(rest_url, headers=self._get_headers(), method="GET", params=params)  # type: ignore
                    if rest_resp.status_code == 200:
                        data = rest_resp.json() or {}
                        items = data.get("items") or []
                        if items:
                            # Prefer exact value match if present
                            ind = next((it for it in items if it.get("value") == ioc_value), items[0])
                            score_field = ind.get("score")
                            if isinstance(score_field, dict):
                                verdict_source = score_field.get("value")
                            else:
                                verdict_source = score_field or ind.get("severity")
                            # Normalize string verdicts; fallback to numeric risk score mapping
                            if isinstance(verdict_source, str):
                                verdict = self._normalize_verdict(verdict_source)
                            else:
                                verdict = self._extract_verdict({"risk_score": ind.get("risk_score", 0)})
                            actor, family = self._extract_actors_families(ind)
                            evidence_parts = []
                            if isinstance(score_field, dict) and score_field.get("value"):
                                evidence_parts.append(f"Score: {score_field['value']}")
                            elif score_field:
                                evidence_parts.append(f"Score: {score_field}")
                            if ind.get("created_at"):
                                evidence_parts.append(f"Created: {ind['created_at']}")
                            evidence = "; ".join(evidence_parts) or "Flashpoint intelligence available"
                            first_seen = ind.get("first_seen_at") or ind.get("first_scored_at") or ind.get("created_at")
                            last_seen = ind.get("last_seen_at") or (score_field.get("last_scored_at") if isinstance(score_field, dict) else None) or ind.get("modified_at") or ind.get("updated_at")
                            return {
                                "verdict": verdict,
                                "confidence": None,
                                "actor": actor,
                                "family": family,
                                "evidence": evidence,
                                "http_status": rest_resp.status_code,
                                "raw_json": ind,
                                "first_seen": first_seen,
                                "last_seen": last_seen,
                            }
            except Exception:
                pass

            # 1b) Fallback within v2: page through latest indicators and match client-side
            try:
                page_size = 50
                max_pages = 20  # scan up to 1000 items recent-first
                v2_scan_attempted = False
                for page_idx in range(max_pages):
                    params = {
                        "size": page_size,
                        "from": page_idx * page_size,
                        "include_total_count": "false",
                        "sort": "last_seen_at:desc",
                    }
                    list_url = f"{self.base_url}/technical-intelligence/v2/indicators"
                    resp = await self._make_request(list_url, headers=self._get_headers(), method="GET", params=params)  # type: ignore
                    if resp.status_code != 200:
                        break
                    v2_scan_attempted = True
                    data = resp.json() or {}
                    items = data.get("items") or []
                    if not items:
                        break
                    # Find exact value match
                    matched = next((it for it in items if str(it.get("value")) == ioc_value), None)
                    if matched:
                        score_field = matched.get("score")
                        if isinstance(score_field, dict):
                            verdict_source = score_field.get("value")
                        else:
                            verdict_source = score_field or matched.get("severity")
                        verdict = self._normalize_verdict(verdict_source) if isinstance(verdict_source, str) else self._extract_verdict({"risk_score": matched.get("risk_score", 0)})
                        actor, family = self._extract_actors_families(matched)
                        evidence_parts = []
                        if isinstance(score_field, dict) and score_field.get("value"):
                            evidence_parts.append(f"Score: {score_field['value']}")
                        elif score_field:
                            evidence_parts.append(f"Score: {score_field}")
                        if matched.get("created_at"):
                            evidence_parts.append(f"Created: {matched['created_at']}")
                        evidence = "; ".join(evidence_parts) or "Flashpoint intelligence available"
                        first_seen = matched.get("first_seen_at") or matched.get("first_scored_at") or matched.get("created_at")
                        last_seen = matched.get("last_seen_at") or (score_field.get("last_scored_at") if isinstance(score_field, dict) else None) or matched.get("modified_at") or matched.get("updated_at")
                        return {
                            "verdict": verdict,
                            "confidence": None,
                            "actor": actor,
                            "family": family,
                            "evidence": evidence,
                            "http_status": resp.status_code,
                            "raw_json": matched,
                            "first_seen": first_seen,
                            "last_seen": last_seen,
                        }
                # If we got here without returning, remember we scanned but found no match
                v2_not_found_evidence = None
                if v2_scan_attempted:
                    v2_not_found_evidence = f"Not found in recent {page_size * max_pages} v2 indicators"
            except Exception:
                pass

            # 2) Fallback: ES-style search endpoints (deployment dependent)
            # Try multiple known routes until one works
            routes = [
                ("POST", f"{self.base_url}/intel/indicators/search"),
                ("POST", f"{self.base_url}/indicators/search"),
                ("POST", f"{self.base_url}/indicators/_search"),
            ]
            payload = {
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"type": fp_type}},
                            {"term": {"value": ioc_value}}
                        ]
                    }
                },
                "size": 1
            }
            last_resp = None
            for method, url in routes:
                response = await self._make_request(url, headers=self._get_headers(), method=method, json=payload)
                last_resp = response
                if response.status_code != 404:
                    break
            
            if last_resp and last_resp.status_code == 200:
                data = last_resp.json()
                hits = data.get("hits", {}).get("hits", [])
                
                if hits:
                    indicator = hits[0].get("_source", {})
                    
                    # Extract verdict
                    verdict = self._extract_verdict(indicator)
                    
                    # Extract actor and family
                    actor, family = self._extract_actors_families(indicator)
                    
                    # Build evidence
                    evidence_parts = []
                    if indicator.get("risk_score"):
                        evidence_parts.append(f"Risk Score: {indicator['risk_score']}")
                    if indicator.get("sightings"):
                        evidence_parts.append(f"Sightings: {len(indicator['sightings'])}")
                    if indicator.get("tags"):
                        tags = [tag.get("name", "") for tag in indicator["tags"]]
                        evidence_parts.append(f"Tags: {', '.join(tags[:3])}")
                    
                    evidence = "; ".join(evidence_parts) if evidence_parts else "Flashpoint intelligence available"
                    
                    return {
                        "verdict": verdict,
                        "confidence": indicator.get("confidence_score"),
                        "actor": actor,
                        "family": family,
                        "evidence": evidence,
                        "http_status": last_resp.status_code,
                        "raw_json": indicator
                    }
                else:
                    evidence = "Not found in Flashpoint intelligence"
                    try:
                        if v2_not_found_evidence:
                            evidence = f"{evidence}; {v2_not_found_evidence}"
                    except Exception:
                        pass
                    return {
                        "verdict": "unknown",
                        "confidence": None,
                        "actor": None,
                        "family": None,
                        "evidence": evidence,
                        "http_status": last_resp.status_code,
                        "raw_json": None
                    }
            
            else:
                evidence = f"API error: {last_resp.status_code if last_resp else 'unknown'}"
                try:
                    if v2_not_found_evidence:
                        evidence = f"{evidence}; {v2_not_found_evidence}"
                except Exception:
                    pass
                return {
                    "verdict": "unknown",
                    "confidence": None,
                    "actor": None,
                    "family": None,
                    "evidence": evidence,
                    "http_status": last_resp.status_code if last_resp else None,
                    "raw_json": None
                }
                
        except Exception as e:
            logger.error(
                "Flashpoint enrichment error",
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            raise
