"""
Forensic adapter (WHOIS/RDAP, ASN/GeoIP, Reverse DNS)
No API key required; uses public endpoints best-effort.
"""

from typing import Any, Dict, Optional
from datetime import datetime, timezone
import socket

import structlog

from app.services.base_adapter import BaseAdapter

logger = structlog.get_logger(__name__)


def _parse_iso(dt: Optional[str]) -> Optional[datetime]:
    if not dt:
        return None
    try:
        # Ensure timezone-aware then convert to naive UTC for DB consistency
        d = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        if d.tzinfo is not None:
            d = d.astimezone(timezone.utc).replace(tzinfo=None)
        return d
    except Exception:
        return None


class ForensicAdapter(BaseAdapter):
    """Forensic enrichment: WHOIS/RDAP + ASN/GeoIP + Reverse DNS"""

    def __init__(self) -> None:
        super().__init__("forensic")

    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        # Only meaningful for domain / ipv4
        if ioc_type not in ("domain", "ipv4"):
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"Unsupported type for forensic: {ioc_type}",
                "http_status": None,
                "raw_json": None,
            }

        http_status: Optional[int] = None
        raw: Dict[str, Any] = {}
        evidence_parts = []

        try:
            if ioc_type == "domain":
                # RDAP domain (aggregated via rdap.org)
                rdap_url = f"https://rdap.org/domain/{ioc_value}"
                resp = await self._make_request(rdap_url, headers={})
                http_status = resp.status_code
                if resp.status_code == 200:
                    djson = resp.json() or {}
                    raw["rdap_domain"] = djson
                    # Events -> registration date / last changed
                    created = None
                    last_changed = None
                    events = djson.get("events") or []
                    if isinstance(events, list):
                        for ev in events:
                            if ev.get("eventAction") in ("registration", "registered") and not created:
                                created = ev.get("eventDate")
                            if ev.get("eventAction") in ("last changed", "last changed by"):
                                last_changed = ev.get("eventDate")
                    created_dt = _parse_iso(created)
                    registrar = None
                    entities = djson.get("entities") or []
                    if isinstance(entities, list):
                        for e in entities:
                            roles = e.get("roles") or []
                            if any(r in roles for r in ("registrar", "registrant")):
                                vcard = e.get("vcardArray") or []
                                try:
                                    # vcardArray = ["vcard", [["fn",{},,"Registrar Name"], ...]]
                                    for item in vcard[1]:
                                        if item[0] == "fn":
                                            registrar = item[3]
                                            break
                                except Exception:
                                    pass
                    age_days = None
                    if created_dt:
                        age_days = max(0, (datetime.utcnow() - created_dt).days)
                    if registrar:
                        evidence_parts.append(f"Registrar: {registrar}")
                    if created_dt:
                        evidence_parts.append(f"Registered: {created_dt.date().isoformat()} ({age_days}d)")
                    raw.update({
                        "registrar": registrar,
                        "registered_on": created_dt.isoformat() + "Z" if created_dt else None,
                        "registrar_age_days": age_days,
                    })

            if ioc_type == "ipv4":
                # RDAP IP
                rdap_ip = f"https://rdap.org/ip/{ioc_value}"
                ip_resp = await self._make_request(rdap_ip, headers={})
                http_status = http_status or ip_resp.status_code
                if ip_resp.status_code == 200:
                    ipjson = ip_resp.json() or {}
                    raw["rdap_ip"] = ipjson
                    asn = ipjson.get("asn") or None
                    org = ipjson.get("name") or ipjson.get("org") or None
                    if asn:
                        evidence_parts.append(f"ASN: {asn}")
                    if org:
                        evidence_parts.append(f"Org: {org}")
                    raw.update({"asn": asn, "org": org})

                # GeoIP
                geo_url = f"https://ipapi.co/{ioc_value}/json/"
                geo_resp = await self._make_request(geo_url, headers={})
                http_status = http_status or geo_resp.status_code
                if geo_resp.status_code == 200:
                    geo = geo_resp.json() or {}
                    raw["geoip"] = geo
                    country = geo.get("country_name") or geo.get("country")
                    city = geo.get("city")
                    if country:
                        evidence_parts.append(f"Geo: {country}{', ' + city if city else ''}")
                    raw.update({"country": country, "city": city})

                # rDNS
                rdns = None
                try:
                    rdns = socket.gethostbyaddr(ioc_value)[0]
                except Exception:
                    rdns = None
                if rdns:
                    evidence_parts.append(f"rDNS: {rdns}")
                raw["rdns"] = rdns

            evidence = "; ".join(evidence_parts) if evidence_parts else "Forensic metadata available"

            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": evidence,
                "http_status": http_status or 200,
                "raw_json": raw,
            }
        except Exception as e:
            logger.warning("Forensic enrichment error", provider=self.provider_name, error=str(e))
            return {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"Error: {str(e)}",
                "http_status": 500,
                "raw_json": None,
            }


