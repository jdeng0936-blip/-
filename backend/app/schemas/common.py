"""
统一 API 响应格式 — Pydantic V2 Schema
"""
from typing import Any, Optional, Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一响应体

    所有 API 都返回此格式：
    { "code": 0, "message": "ok", "data": ... }
    """
    code: int = 0
    message: str = "ok"
    data: Optional[T] = None


class PaginatedData(BaseModel, Generic[T]):
    """分页数据包装"""
    items: List[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
