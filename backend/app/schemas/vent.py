"""
通风计算 Schema — Pydantic V2

核心计算：
  V1: 绝对瓦斯涌出量法 → 需风量
  V2: 下井人数法 → 需风量
  V3: 炸药消耗法 → 需风量
  V4: 取三者最大值 → 配风量
  V5: 局扇选型 + 风速合规验算
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class VentCalcInput(BaseModel):
    """通风计算输入参数"""
    # 瓦斯参数
    gas_emission: float = Field(gt=0, description="绝对瓦斯涌出量 m³/min")
    gas_level: Literal["低瓦斯", "高瓦斯", "突出"] = Field(description="瓦斯等级")

    # 断面参数
    section_area: float = Field(gt=0, description="巷道净断面积 m²")
    excavation_length: float = Field(gt=0, description="掘进长度 m")

    # 人员与炸药
    max_workers: int = Field(default=20, gt=0, description="同时最多下井人数")
    explosive_per_cycle: float = Field(default=0, ge=0, description="每循环炸药消耗 kg")

    # 用户期望值（合规校核）
    design_air_volume: Optional[float] = Field(
        default=None, description="用户设计供风量 m³/min（用于合规校核）"
    )
    design_wind_speed: Optional[float] = Field(
        default=None, description="用户设计风速 m/s（用于合规校核）"
    )


class VentWarning(BaseModel):
    """通风合规预警"""
    level: Literal["error", "warning", "info"]
    field: str
    message: str
    current_value: float
    required_value: float


class VentCalcResult(BaseModel):
    """通风计算结果"""
    # 三种方法需风量
    q_gas: float = Field(description="瓦斯涌出法需风量 m³/min")
    q_people: float = Field(description="下井人数法需风量 m³/min")
    q_explosive: float = Field(description="炸药消耗法需风量 m³/min")

    # 最终配风
    q_required: float = Field(description="最终需风量（取最大值）m³/min")
    wind_speed_min: float = Field(description="最低风速 m/s")
    wind_speed_max: float = Field(description="最高风速 m/s")
    recommended_fan: str = Field(description="推荐局扇型号")
    fan_power: float = Field(description="局扇功率 kW")

    # 合规
    is_compliant: bool
    warnings: list[VentWarning] = Field(default_factory=list)
