"""
Cache Service
Provides in-memory caching for frequently accessed data like workflows and forms.
"""

import logging
from functools import lru_cache
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CacheService:
    """Service for caching frequently accessed data."""
    
    def __init__(self, max_size: int = 128, ttl_seconds: int = 300):
        """
        Initialize cache service.
        
        Args:
            max_size: Maximum number of items to cache (default: 128)
            ttl_seconds: Time-to-live for cache entries in seconds (default: 300 = 5 minutes)
        """
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Tuple[Any, datetime]] = {}
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        if key not in self._cache:
            self._misses += 1
            return None
        
        value, timestamp = self._cache[key]
        
        # Check if expired
        if datetime.utcnow() - timestamp > timedelta(seconds=self.ttl_seconds):
            del self._cache[key]
            self._misses += 1
            return None
        
        self._hits += 1
        return value
    
    def set(self, key: str, value: Any) -> None:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache
        """
        # Evict oldest entry if cache is full
        if len(self._cache) >= self.max_size and key not in self._cache:
            # Remove oldest entry
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]
        
        self._cache[key] = (value, datetime.utcnow())
    
    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()
        self._hits = 0
        self._misses = 0
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        total_requests = self._hits + self._misses
        hit_rate = self._hits / total_requests if total_requests > 0 else 0.0
        
        return {
            'size': len(self._cache),
            'max_size': self.max_size,
            'hits': self._hits,
            'misses': self._misses,
            'hit_rate': hit_rate,
            'ttl_seconds': self.ttl_seconds
        }
    
    def cached_workflow(self, workflow_id: str, loader_func: Callable[[str], Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get workflow with caching.
        
        Args:
            workflow_id: Workflow ID
            loader_func: Function to load workflow if not cached
            
        Returns:
            Workflow dictionary
        """
        cache_key = f"workflow:{workflow_id}"
        cached = self.get(cache_key)
        if cached is not None:
            return cached
        
        workflow = loader_func(workflow_id)
        self.set(cache_key, workflow)
        return workflow
    
    def cached_form(self, form_id: str, loader_func: Callable[[str], Optional[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
        """
        Get form with caching.
        
        Args:
            form_id: Form ID
            loader_func: Function to load form if not cached
            
        Returns:
            Form dictionary or None
        """
        cache_key = f"form:{form_id}"
        cached = self.get(cache_key)
        if cached is not None:
            return cached
        
        form = loader_func(form_id)
        if form is not None:
            self.set(cache_key, form)
        return form

