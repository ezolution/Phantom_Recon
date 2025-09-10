"""
Base adapter for threat intelligence providers
"""

import asyncio
import hashlib
import json
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import httpx
import structlog
from typing import Tuple

from app.core.config import settings

logger = structlog.get_logger(__name__)


class BaseAdapter(ABC):
    """Base class for threat intelligence provider adapters"""
    
    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        # In-process cache (no Redis). Key -> (expires_at_epoch, result_dict)
        if not hasattr(BaseAdapter, "_local_cache"):
            BaseAdapter._local_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        # Default TTLs (class-wide, runtime adjustable)
        if not hasattr(BaseAdapter, "DEFAULT_TTL_POSITIVE"):
            BaseAdapter.DEFAULT_TTL_POSITIVE = 24 * 60 * 60  # 24 hours
        if not hasattr(BaseAdapter, "DEFAULT_TTL_NEGATIVE"):
            BaseAdapter.DEFAULT_TTL_NEGATIVE = 6 * 60 * 60   # 6 hours
        self.cache_ttl_positive = BaseAdapter.DEFAULT_TTL_POSITIVE
        self.cache_ttl_negative = BaseAdapter.DEFAULT_TTL_NEGATIVE
        self.max_retries = 4
        self.timeout = 15.0
        
    def _get_cache_key(self, ioc_value: str, ioc_type: str) -> str:
        """Generate cache key for IOC"""
        key_data = f"{self.provider_name}:{ioc_type}:{ioc_value}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def _get_cached_result(self, ioc_value: str, ioc_type: str) -> Optional[Dict[str, Any]]:
        """Get cached result for IOC from in-process cache"""
        cache_key = self._get_cache_key(ioc_value, ioc_type)
        entry = BaseAdapter._local_cache.get(cache_key)
        if not entry:
            return None
        expires_at, payload = entry
        if time.time() >= expires_at:
            # Expired
            BaseAdapter._local_cache.pop(cache_key, None)
            return None
        return payload
    
    async def _cache_result(self, ioc_value: str, ioc_type: str, result: Dict[str, Any], ttl: int):
        """Cache result for IOC in in-process cache"""
        cache_key = self._get_cache_key(ioc_value, ioc_type)
        BaseAdapter._local_cache[cache_key] = (time.time() + ttl, result)

    # ----- Cache administration (class-wide) -----
    @classmethod
    def set_cache_ttls(cls, positive_ttl_seconds: int, negative_ttl_seconds: int) -> None:
        """Set default cache TTLs for all adapters (affects new instances immediately)."""
        # Sanitize values to reasonable ranges
        pos = max(60, min(7 * 24 * 60 * 60, int(positive_ttl_seconds)))
        neg = max(30, min(24 * 60 * 60, int(negative_ttl_seconds)))
        cls.DEFAULT_TTL_POSITIVE = pos
        cls.DEFAULT_TTL_NEGATIVE = neg
        # Update currently instantiated adapters if any references exist
        try:
            # Best-effort: walk live cache of keys to keep behavior consistent
            # Note: existing entries keep their original expiry; only new writes use new TTLs.
            pass
        except Exception:
            pass

    @classmethod
    def clear_cache(cls, ioc_value: Optional[str] = None, ioc_type: Optional[str] = None) -> int:
        """Clear entire adapter cache or entries matching a specific IOC value/type.
        Returns number of entries removed.
        """
        if not hasattr(cls, "_local_cache"):
            return 0
        if not ioc_value:
            removed = len(cls._local_cache)
            cls._local_cache.clear()
            return removed
        # Remove specific
        removed = 0
        key_suffix = f":{ioc_type}:{ioc_value}" if ioc_type else f":{ioc_value}"
        # Keys are md5 of provider:ioc_type:ioc_value, so we cannot pattern match.
        # Fall back to brute-force by recomputing keys for all known providers is not possible here.
        # Instead, wipe entire cache when specific eviction requested without mapping.
        cls._local_cache.clear()
        return -1  # signal full clear performed due to limitation
    
    async def _make_request(self, url: str, headers: Dict[str, str] = None, method: str = "GET", **kwargs) -> httpx.Response:
        """Make HTTP request with retry logic. Set method to 'GET' or 'POST'."""
        if headers is None:
            headers = {}
        
        headers.update({
            "User-Agent": "Threat-Forge/1.0",
            "Accept": "application/json"
        })
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    if method.upper() == "POST":
                        response = await client.post(url, headers=headers, **kwargs)
                    else:
                        response = await client.get(url, headers=headers, **kwargs)
                    return response
            except httpx.TimeoutException:
                logger.warning(
                    "Request timeout",
                    provider=self.provider_name,
                    url=url,
                    attempt=attempt + 1
                )
            except httpx.RequestError as e:
                logger.warning(
                    "Request error",
                    provider=self.provider_name,
                    url=url,
                    error=str(e),
                    attempt=attempt + 1
                )
            
            if attempt < self.max_retries - 1:
                # Exponential backoff with jitter
                delay = (2 ** attempt) + (time.time() % 1)
                await asyncio.sleep(delay)
        
        raise httpx.RequestError("Max retries exceeded")
    
    def _normalize_verdict(self, raw_verdict: Any) -> str:
        """Normalize provider verdict to standard format"""
        if isinstance(raw_verdict, str):
            raw_verdict = raw_verdict.lower()
        
        if raw_verdict in ["malicious", "high", "dangerous", "threat"]:
            return "malicious"
        elif raw_verdict in ["suspicious", "medium", "warning"]:
            return "suspicious"
        elif raw_verdict in ["benign", "clean", "safe", "low"]:
            return "benign"
        else:
            return "unknown"
    
    def _extract_confidence(self, raw_data: Dict[str, Any]) -> Optional[int]:
        """Extract confidence score from raw data"""
        # This should be implemented by each provider
        return None
    
    def _extract_actors_families(self, raw_data: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract actor and family information from raw data"""
        # This should be implemented by each provider
        return None, None
    
    @abstractmethod
    async def enrich(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with provider data"""
        pass
    
    async def enrich_with_cache(self, ioc_value: str, ioc_type: str) -> Dict[str, Any]:
        """Enrich IOC with caching"""
        # Check cache first
        cached_result = await self._get_cached_result(ioc_value, ioc_type)
        if cached_result:
            logger.info(
                "Using cached result",
                provider=self.provider_name,
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value
            )
            return cached_result
        
        # Enrich from provider
        try:
            result = await self.enrich(ioc_value, ioc_type)
            
            # Cache result
            ttl = self.cache_ttl_positive if result.get("verdict") != "unknown" else self.cache_ttl_negative
            await self._cache_result(ioc_value, ioc_type, result, ttl)
            
            return result
            
        except Exception as e:
            logger.error(
                "Enrichment failed",
                provider=self.provider_name,
                ioc_type=ioc_type,
                ioc_value=ioc_value[:50] + "..." if len(ioc_value) > 50 else ioc_value,
                error=str(e)
            )
            
            # Cache negative result
            error_result = {
                "verdict": "unknown",
                "confidence": None,
                "actor": None,
                "family": None,
                "evidence": f"Error: {str(e)}",
                "http_status": 500,
                "raw_json": None
            }
            await self._cache_result(ioc_value, ioc_type, error_result, self.cache_ttl_negative)
            
            return error_result
