"""
图纸管理模型
"""
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, AuditMixin


class DrawingTemplate(AuditMixin, Base):
    """图纸模板"""
    __tablename__ = "drawing_template"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, comment="图纸名称")
    category: Mapped[str] = mapped_column(String(30), nullable=False, comment="分类(断面图/支护图/布置图/作业图表/安全图)")
    file_url: Mapped[str] = mapped_column(String(500), nullable=False, comment="图纸文件 OSS 地址")
    file_format: Mapped[str] = mapped_column(String(10), nullable=True, comment="文件格式(dwg/pdf/png/jpg)")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="版本号")
    is_current: Mapped[bool] = mapped_column(Integer, default=True, comment="是否当前有效")


class DrawingBinding(Base):
    """图纸-条件绑定关系"""
    __tablename__ = "drawing_binding"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    drawing_id: Mapped[int] = mapped_column(Integer, ForeignKey("drawing_template.id"), nullable=False)
    condition_field: Mapped[str] = mapped_column(String(50), nullable=False, comment="绑定字段(rock_class/section_form/...)")
    condition_value: Mapped[str] = mapped_column(String(100), nullable=False, comment="绑定值")
