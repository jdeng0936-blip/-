"""
支护计算 Schema — Pydantic V2
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class SupportCalcInput(BaseModel):
    """支护计算输入参数"""
    rock_class: Literal["I", "II", "III", "IV", "V"] = Field(
        description="围岩级别"
    )
    section_form: Literal["矩形", "拱形", "梯形"] = Field(
        description="断面形式"
    )
    section_width: float = Field(gt=0, description="巷道净宽 m")
    section_height: float = Field(gt=0, description="巷道净高 m")
    rock_density: float = Field(default=2.5, gt=0, description="岩石容重 t/m³")

    # 锚杆参数
    bolt_length: float = Field(default=2.4, gt=0, description="锚杆长度 m")
    bolt_diameter: float = Field(default=22, gt=0, description="锚杆直径 mm")
    bolt_spacing: Optional[float] = Field(
        default=None, description="用户指定锚杆间距 mm（用于合规校核）"
    )
    bolt_row_spacing: Optional[float] = Field(
        default=None, description="用户指定锚杆排距 mm（用于合规校核）"
    )

    # 锚索参数
    cable_count: int = Field(default=0, ge=0, description="用户指定锚索数量")
    cable_strength: float = Field(
        default=260, gt=0, description="单根锚索破断力 kN"
    )


class CalcWarning(BaseModel):
    """合规预警项"""
    level: Literal["error", "warning", "info"]
    field: str
    message: str
    current_value: float
    required_value: float


class SupportCalcResult(BaseModel):
    """支护计算结果"""
    # 断面
    section_area: float = Field(description="净断面积 m²")

    # 锚杆
    bolt_force: float = Field(description="单根锚杆锚固力 kN")
    max_bolt_spacing: float = Field(description="最大允许锚杆间距 mm")
    max_bolt_row_spacing: float = Field(description="最大允许锚杆排距 mm")
    recommended_bolt_count_per_row: int = Field(description="推荐每排锚杆数")

    # 锚索
    min_cable_count: int = Field(description="最少锚索数量")
    total_support_load: float = Field(description="总支护载荷 kN")

    # 校核
    support_density: float = Field(description="支护密度 根/m²")
    safety_factor: float = Field(description="安全系数")
    is_compliant: bool = Field(description="是否合规")
    warnings: list[CalcWarning] = Field(default_factory=list)
