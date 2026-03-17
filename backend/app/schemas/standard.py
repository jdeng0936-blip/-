"""
标准库 Schema — Pydantic V2
"""
from datetime import date
from typing import Optional, Literal
from pydantic import BaseModel


# ========== 规范文档 ==========

class StdDocumentCreate(BaseModel):
    """新建规范文档"""
    title: str
    doc_type: Literal["法律法规", "技术规范", "集团标准", "安全规程"]
    version: Optional[str] = None
    publish_date: Optional[date] = None
    file_url: Optional[str] = None


class StdDocumentUpdate(BaseModel):
    """更新规范文档"""
    title: Optional[str] = None
    doc_type: Optional[str] = None
    version: Optional[str] = None
    publish_date: Optional[date] = None
    is_current: Optional[bool] = None
    file_url: Optional[str] = None


class StdDocumentOut(BaseModel):
    """文档列表/详情响应"""
    id: int
    title: str
    doc_type: str
    version: Optional[str] = None
    publish_date: Optional[date] = None
    is_current: bool
    file_url: Optional[str] = None
    clause_count: int = 0

    model_config = {"from_attributes": True}


# ========== 条款 ==========

class StdClauseCreate(BaseModel):
    """新增条款"""
    parent_id: Optional[int] = None
    clause_no: Optional[str] = None
    title: Optional[str] = None
    content: str
    level: int = 0


class StdClauseUpdate(BaseModel):
    """更新条款"""
    clause_no: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    level: Optional[int] = None


class StdClauseOut(BaseModel):
    """条款基础响应"""
    id: int
    document_id: int
    parent_id: Optional[int] = None
    clause_no: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    level: int = 0

    model_config = {"from_attributes": True}


class StdClauseTree(BaseModel):
    """条款树形响应（递归嵌套）"""
    id: int
    clause_no: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    level: int = 0
    children: list["StdClauseTree"] = []

    model_config = {"from_attributes": True}


# ========== 查询参数 ==========

class StdDocumentQuery(BaseModel):
    """文档列表查询参数"""
    page: int = 1
    page_size: int = 20
    doc_type: Optional[str] = None
    title: Optional[str] = None
    is_current: Optional[bool] = None
