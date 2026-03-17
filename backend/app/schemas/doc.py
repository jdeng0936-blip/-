"""
文档生成 Schema — Pydantic V2
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class DocGenerateRequest(BaseModel):
    """文档生成请求"""
    project_id: int
    include_calc: bool = Field(default=True, description="是否包含计算校验章节")
    include_warnings: bool = Field(default=True, description="是否标注合规预警")


class ChapterContent(BaseModel):
    """单个章节内容"""
    chapter_no: str
    title: str
    content: str
    source: Literal["rule_match", "calc_engine", "template", "manual"]
    has_warning: bool = False


class DocGenerateResult(BaseModel):
    """文档生成结果"""
    project_id: int
    project_name: str
    file_path: str = Field(description="生成的 .docx 文件路径")
    total_chapters: int
    total_warnings: int
    chapters: list[ChapterContent]
