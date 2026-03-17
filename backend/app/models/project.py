"""
规程项目 + 项目参数模型
"""
from sqlalchemy import String, Integer, Float, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, AuditMixin


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"           # 草稿
    MATCHING = "matching"     # 匹配中
    GENERATING = "generating" # 生成中
    COMPLETED = "completed"   # 已完成
    FAILED = "failed"         # 生成失败


class Project(AuditMixin, Base):
    """规程编制项目"""
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mine_id: Mapped[int] = mapped_column(Integer, ForeignKey("sys_mine.id"), nullable=False, comment="矿井ID")
    face_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="工作面名称")
    status: Mapped[str] = mapped_column(
        String(20), default=ProjectStatus.DRAFT.value, comment="项目状态"
    )
    description: Mapped[str] = mapped_column(Text, nullable=True, comment="备注说明")

    params = relationship("ProjectParams", back_populates="project", uselist=False, lazy="selectin")
    documents = relationship("GeneratedDoc", back_populates="project", lazy="selectin")


class ProjectParams(AuditMixin, Base):
    """项目输入参数"""
    __tablename__ = "project_params"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("project.id"), unique=True, nullable=False)

    # --- 地质条件 ---
    rock_class: Mapped[str] = mapped_column(String(10), nullable=True, comment="围岩级别(I/II/III/IV/V)")
    coal_thickness: Mapped[float] = mapped_column(Float, nullable=True, comment="煤层厚度(m)")
    coal_dip_angle: Mapped[float] = mapped_column(Float, nullable=True, comment="煤层倾角(°)")
    gas_level: Mapped[str] = mapped_column(String(20), nullable=True, comment="瓦斯等级(低/高/突出)")
    hydro_type: Mapped[str] = mapped_column(String(50), nullable=True, comment="水文地质类型")
    geo_structure: Mapped[str] = mapped_column(String(200), nullable=True, comment="地质构造特征")
    spontaneous_combustion: Mapped[str] = mapped_column(String(20), nullable=True, comment="自燃倾向性")

    # --- 巷道参数 ---
    roadway_type: Mapped[str] = mapped_column(String(30), nullable=True, comment="巷道类型(进风巷/回风巷/...)")
    excavation_type: Mapped[str] = mapped_column(String(20), nullable=True, comment="掘进类型(煤巷/岩巷/半煤岩巷)")
    section_form: Mapped[str] = mapped_column(String(20), nullable=True, comment="断面形式(矩形/拱形/梯形)")
    section_width: Mapped[float] = mapped_column(Float, nullable=True, comment="断面宽(m)")
    section_height: Mapped[float] = mapped_column(Float, nullable=True, comment="断面高(m)")
    excavation_length: Mapped[float] = mapped_column(Float, nullable=True, comment="掘进长度(m)")
    service_years: Mapped[int] = mapped_column(Integer, nullable=True, comment="服务年限")

    # --- 设备配置 ---
    dig_method: Mapped[str] = mapped_column(String(20), nullable=True, comment="掘进方式(综掘/炮掘/手工)")
    dig_equipment: Mapped[str] = mapped_column(String(100), nullable=True, comment="掘进设备型号")
    transport_method: Mapped[str] = mapped_column(String(100), nullable=True, comment="运输方式")

    project = relationship("Project", back_populates="params")
