"""
规则引擎模型 — 规则组 / 规则 / 条件 / 结论

关系链：RuleGroup 1→N Rule 1→N RuleCondition
                         1→N RuleAction

级联策略：删除 RuleGroup 级联删 Rule，删除 Rule 级联删 Condition + Action。
"""
from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, AuditMixin


class RuleGroup(AuditMixin, Base):
    """规则组 — 按业务场景分类管理一组规则"""
    __tablename__ = "rule_group"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="规则组名称")
    description: Mapped[str] = mapped_column(Text, nullable=True, comment="规则组描述")

    # 级联删除：删除规则组时自动清空其下所有规则（含条件+结论）
    rules = relationship(
        "Rule",
        back_populates="group",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Rule(AuditMixin, Base):
    """规则定义 — 一条规则由多个条件(AND)和多个结论组成"""
    __tablename__ = "rule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule_group.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="规则名称")
    category: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="规则类型(支护/装备/安全/断面/通风)"
    )
    priority: Mapped[int] = mapped_column(
        Integer, default=0, comment="优先级(数值越大优先级越高)"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
    version: Mapped[int] = mapped_column(Integer, default=1, comment="版本号")

    group = relationship("RuleGroup", back_populates="rules")

    # 级联删除：删除规则时自动清空其下所有条件和结论
    conditions = relationship(
        "RuleCondition",
        back_populates="rule",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    actions = relationship(
        "RuleAction",
        back_populates="rule",
        lazy="selectin",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class RuleCondition(Base):
    """规则条件 — 同一规则内多个条件为 AND 关系"""
    __tablename__ = "rule_condition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule.id", ondelete="CASCADE"), nullable=False
    )
    field: Mapped[str] = mapped_column(
        String(50), nullable=False,
        comment="条件字段(rock_class/gas_level/coal_thickness 等 ProjectParams 字段)",
    )
    operator: Mapped[str] = mapped_column(
        String(10), nullable=False,
        comment="运算符(eq/ne/gt/lt/gte/lte/in/between/contains)",
    )
    value: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="条件值(JSON 序列化)"
    )

    rule = relationship("Rule", back_populates="conditions")


class RuleAction(Base):
    """规则结论 — 命中后关联的模板片段"""
    __tablename__ = "rule_action"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rule.id", ondelete="CASCADE"), nullable=False
    )
    target_chapter: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="目标章节编号"
    )
    snippet_id: Mapped[int] = mapped_column(
        Integer, nullable=True, comment="关联的章节内容片段 ID"
    )
    params_override: Mapped[dict] = mapped_column(
        JSON, nullable=True, comment="参数覆盖(JSON)"
    )

    rule = relationship("Rule", back_populates="actions")
