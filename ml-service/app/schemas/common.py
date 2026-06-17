"""
Common Response Schemas
Generic API response wrapper used by all routers for consistent JSON structure.
"""

from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    """
    Standard API response wrapper.
    All router endpoints return this structure.
    """
    success: bool = True
    data: Optional[Any] = None
    error: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {"key": "value"},
                "error": None,
            }
        }
