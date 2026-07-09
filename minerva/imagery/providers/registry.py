"""
Provider Registry — يربط اسم المزود بـ class مناسب.
ADR-013: إضافة مزود جديد = سطر واحد هنا.
"""
from __future__ import annotations
from typing import Optional
from minerva.imagery.providers.base import ImageryProvider

_REGISTRY: dict[str, type] = {}

def _load_providers():
    """Lazy load to avoid import errors if dependencies missing."""
    global _REGISTRY
    if _REGISTRY:
        return
    try:
        from minerva.imagery.providers.planet import PlanetProvider
        _REGISTRY["planet"] = PlanetProvider
    except ImportError:
        pass
    # Future providers added here:
    # from minerva.imagery.providers.maxar import MaxarProvider
    # _REGISTRY["maxar"] = MaxarProvider

def get_provider(provider_id: str, **kwargs) -> Optional[ImageryProvider]:
    _load_providers()
    cls = _REGISTRY.get(provider_id)
    return cls(**kwargs) if cls else None

def all_providers(**kwargs) -> list[ImageryProvider]:
    _load_providers()
    result = []
    for pid, cls in _REGISTRY.items():
        try:
            result.append(cls(**kwargs))
        except Exception:
            pass
    return result
