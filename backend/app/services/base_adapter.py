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
from redis import Redis

from app.core.config import settings

logger = structlog.get_logger(__name__)


class BaseAdapter(ABC):
    """Base class for threat intelligence provider adapters"""
    
    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        self.redis_client = Redis.from_url(settings.REDIS_URL)
        self.cache_ttl_positive = 24 * 60 * 60  # 24 hours
        self.cache_ttl_negative = 6 * 60 * 60   # 6 hours
        self.max_retries = 4
        self.timeout = 15.0
        
    def _get_cache_key(self, ioc_value: str, ioc_type: str) -> str:
        """Generate cache key for IOC"""
        key_data = f"{self.provider_name}:{ioc_type}:{ioc_value}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    async def _get_cached_result(self, ioc_value: str, ioc_type: str) -> Optional[Dict[str, Any]]:
        """Get cached result for IOC"""
        cache_key = self._get_cache_key(ioc_value, ioc_type)
        cached = self.redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
        return None
    
    async def _cache_result(self, ioc_value: str, ioc_type: str, result: Dict[str, Any], ttl: int):
        """Cache result for IOC"""
        cache_key = self._get_cache_key(ioc_value, ioc_type)
        self.redis_client.setex(cache_key, ttl, json.dumps(result))
    
    async def _make_request(self, url: str, headers: Dict[str, str] = None, **kwargs) -> httpx.Response:
        """Make HTTP request with retry logic"""
        if headers is None:
            headers = {}
        
        headers.update({
            "User-Agent": "Threat-Forge/1.0",
            "Accept": "application/json"
        })
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
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
