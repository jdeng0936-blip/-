"""
循环作业计算 Schema — Pydantic V2

核心计算：
  C1: 循环进尺 = 炮眼深度 × 利用率（钻爆法）/ 截割深度（综掘）
  C2: 单循环时间 = 打眼+装药+放炮+通风+出矸+支护
  C3: 日循环数 = 有效工时 / 单循环时间
  C4: 月进尺 = 日循环数 × 循环进尺 × 月工作日
  C5: 正规循环率验算
"""
from typing import Optional, Literal
from pydantic import BaseModel, Field


class CycleCalcInput(BaseModel):
    """循环作业计算输入参数"""
    dig_method: Literal["钻爆法", "综掘"] = Field(description="掘进方式")

    # 钻爆法参数
    hole_depth: float = Field(default=2.0, gt=0, description="炮眼深度 m")
    utilization_rate: float = Field(default=0.85, gt=0, le=1, description="炮眼利用率")

    # 综掘参数
    cut_depth: float = Field(default=0.8, gt=0, description="截割深度 m")

    # 工序时间（分钟）
    t_drilling: float = Field(default=60, ge=0, description="打眼时间 min")
    t_charging: float = Field(default=20, ge=0, description="装药时间 min")
    t_blasting: float = Field(default=15, ge=0, description="放炮+等待 min")
    t_ventilation: float = Field(default=30, ge=0, description="通风排烟 min")
    t_mucking: float = Field(default=90, ge=0, description="出矸时间 min")
    t_support: float = Field(default=60, ge=0, description="支护时间 min")
    t_other: float = Field(default=15, ge=0, description="其他辅助 min")

    # 工作制度
    shifts_per_day: int = Field(default=3, ge=1, le=4, description="日班次")
    hours_per_shift: float = Field(default=8, gt=0, description="班工作时 h")
    effective_rate: float = Field(default=0.75, gt=0, le=1, description="有效工时率")
    work_days_per_month: int = Field(default=26, gt=0, le=31, description="月工作日")

    # 设计指标（合规校核）
    design_monthly_advance: Optional[float] = Field(
        default=None, description="设计月进尺 m（用于校核）"
    )


class CycleWarning(BaseModel):
    """循环作业预警"""
    level: Literal["error", "warning", "info"]
    field: str
    message: str
    current_value: float
    required_value: float


class CycleCalcResult(BaseModel):
    """循环作业计算结果"""
    cycle_advance: float = Field(description="循环进尺 m")
    cycle_time: float = Field(description="单循环时间 min")
    cycles_per_day: float = Field(description="日循环数")
    daily_advance: float = Field(description="日进尺 m")
    monthly_advance: float = Field(description="月进尺 m")
    effective_hours: float = Field(description="日有效工时 h")
    cycle_rate: float = Field(description="正规循环率 %")
    is_compliant: bool
    warnings: list[CycleWarning] = Field(default_factory=list)
