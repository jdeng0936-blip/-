"""
规则引擎 Schema — Pydantic V2

覆盖 9 种运算符枚举：eq/ne/gt/lt/gte/lte/in/between/contains
"""
from typing import Optional, Literal
from pydantic import BaseModel


# ========== 运算符枚举类型 ==========

OperatorType = Literal["eq", "ne", "gt", "lt", "gte", "lte", "in", "between", "contains"]

# ProjectParams 可匹配字段
ParamFieldType = Literal[
    "rock_class", "coal_thickness", "coal_dip_angle",
    "gas_level", "hydro_type", "geo_structure",
    "spontaneous_combustion", "roadway_type", "excavation_type",
    "section_form", "section_width", "section_height",
    "excavation_length", "service_years",
    "dig_method", "dig_equipment", "transport_method",
]

# 规则类型
RuleCategoryType = Literal["支护", "装备", "安全", "断面", "通风"]


# ========== 规则组 ==========

class RuleGroupCreate(BaseModel):
    """新建规则组"""
    name: str
    description: Optional[str] = None


class RuleGroupUpdate(BaseModel):
    """更新规则组"""
    name: Optional[str] = None
    description: Optional[str] = None


class RuleGroupOut(BaseModel):
    """规则组响应"""
    id: int
    name: str
    description: Optional[str] = None
    rule_count: int = 0

    model_config = {"from_attributes": True}


# ========== 条件与结论 ==========

class ConditionItem(BaseModel):
    """规则条件项"""
    field: ParamFieldType
    operator: OperatorType
    value: str  # JSON 序列化值


class ActionItem(BaseModel):
    """规则结论项"""
    target_chapter: str
    snippet_id: Optional[int] = None
    params_override: Optional[dict] = None


class ConditionOut(BaseModel):
    """条件响应"""
    id: int
    field: str
    operator: str
    value: str

    model_config = {"from_attributes": True}


class ActionOut(BaseModel):
    """结论响应"""
    id: int
    target_chapter: str
    snippet_id: Optional[int] = None
    params_override: Optional[dict] = None

    model_config = {"from_attributes": True}


# ========== 规则 ==========

class RuleCreateRequest(BaseModel):
    """新建规则（含条件+结论，事务原子操作）"""
    group_id: int
    name: str
    category: RuleCategoryType
    priority: int = 0
    conditions: list[ConditionItem]
    actions: list[ActionItem]


class RuleUpdateRequest(BaseModel):
    """更新规则"""
    name: Optional[str] = None
    category: Optional[RuleCategoryType] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    conditions: Optional[list[ConditionItem]] = None
    actions: Optional[list[ActionItem]] = None


class RuleOut(BaseModel):
    """规则响应（含条件+结论）"""
    id: int
    group_id: int
    name: str
    category: str
    priority: int
    is_active: bool
    version: int
    conditions: list[ConditionOut] = []
    actions: list[ActionOut] = []

    model_config = {"from_attributes": True}


# ========== 匹配结果 ==========

class MatchedRule(BaseModel):
    """匹配命中的规则"""
    rule_id: int
    rule_name: str
    category: str
    priority: int
    conditions: list[ConditionOut]
    actions: list[ActionOut]


class MatchResult(BaseModel):
    """匹配结果汇总"""
    project_id: int
    matched_rules: list[MatchedRule]
    total_matched: int
    matched_chapters: list[str]  # 去重后的命中章节列表
