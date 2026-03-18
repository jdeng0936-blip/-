"""
项目管理 Schema — Pydantic V2

覆盖：Project CRUD + ProjectParams 读写
"""
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field


# ========== ProjectParams ==========

class ProjectParamsCreate(BaseModel):
    """创建/更新项目参数"""
    rock_class: Optional[str] = Field(None, description="围岩级别 I/II/III/IV/V")
    coal_thickness: Optional[float] = Field(None, description="煤层厚度 m")
    coal_dip_angle: Optional[float] = Field(None, description="煤层倾角 °")
    gas_level: Optional[str] = Field(None, description="瓦斯等级")
    hydro_type: Optional[str] = Field(None, description="水文地质类型")
    geo_structure: Optional[str] = Field(None, description="地质构造特征")
    spontaneous_combustion: Optional[str] = Field(None, description="自燃倾向性")
    roadway_type: Optional[str] = Field(None, description="巷道类型")
    excavation_type: Optional[str] = Field(None, description="掘进类型")
    section_form: Optional[str] = Field(None, description="断面形式")
    section_width: Optional[float] = Field(None, description="断面宽 m")
    section_height: Optional[float] = Field(None, description="断面高 m")
    excavation_length: Optional[float] = Field(None, description="掘进长度 m")
    service_years: Optional[int] = Field(None, description="服务年限")
    dig_method: Optional[str] = Field(None, description="掘进方式")
    dig_equipment: Optional[str] = Field(None, description="掘进设备型号")
    transport_method: Optional[str] = Field(None, description="运输方式")


class ProjectParamsOut(ProjectParamsCreate):
    """项目参数输出"""
    id: int
    project_id: int

    class Config:
        from_attributes = True


# ========== Project ==========

class ProjectCreate(BaseModel):
    """创建项目"""
    mine_id: Optional[int] = Field(1, description="矿井ID（可选，默认1）")
    mine_name: Optional[str] = Field(None, description="矿井名称（前端兼容字段）")
    face_name: str = Field(min_length=1, max_length=100, description="工作面名称")
    description: Optional[str] = Field(None, description="备注说明")
    dig_method: Optional[str] = Field(None, description="掘进方式（前端兼容字段）")
    params: Optional[ProjectParamsCreate] = Field(None, description="初始参数（可选）")


class ProjectUpdate(BaseModel):
    """更新项目"""
    face_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    status: Optional[str] = None


class ProjectOut(BaseModel):
    """项目输出"""
    id: int
    mine_id: int
    mine_name: Optional[str] = None
    face_name: str
    status: str
    description: Optional[str]
    tenant_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    params: Optional[ProjectParamsOut] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_mine(cls, project) -> "ProjectOut":
        """从 ORM 对象构造，提取关联矿井名称"""
        data = cls.model_validate(project)
        # 从 project.mine relationship 获取 mine_name
        if hasattr(project, 'mine') and project.mine:
            data.mine_name = project.mine.name
        return data
