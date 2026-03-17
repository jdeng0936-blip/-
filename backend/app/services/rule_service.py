"""
规则引擎 Service — CRUD + Match Engine

Match Engine 核心逻辑：
1. 读取项目参数 ProjectParams
2. 遍历所有启用规则
3. 逐条评估条件（9 种运算符，同一规则内为 AND 关系）
4. 收集命中规则的所有结论
5. 按 priority 降序排列并返回

所有查询强制注入 tenant_id 过滤（规范红线第 3 条）。
"""
import json
from typing import Optional
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.rule import RuleGroup, Rule, RuleCondition, RuleAction
from app.models.project import Project, ProjectParams
from app.schemas.rule import (
    RuleGroupCreate,
    RuleGroupUpdate,
    RuleCreateRequest,
    RuleUpdateRequest,
    ConditionItem,
    ActionItem,
    ConditionOut,
    ActionOut,
    RuleOut,
    MatchedRule,
    MatchResult,
)


class RuleService:
    """规则引擎 CRUD + 匹配服务"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========== 规则组 CRUD ==========

    async def list_groups(self, tenant_id: int) -> list[dict]:
        """获取规则组列表"""
        result = await self.session.execute(
            select(RuleGroup)
            .where(RuleGroup.tenant_id == tenant_id)
            .options(selectinload(RuleGroup.rules))
            .order_by(RuleGroup.id)
        )
        groups = result.scalars().all()
        return [
            {
                "id": g.id,
                "name": g.name,
                "description": g.description,
                "rule_count": len(g.rules),
            }
            for g in groups
        ]

    async def create_group(
        self, data: RuleGroupCreate, tenant_id: int, created_by: int
    ) -> RuleGroup:
        """新建规则组"""
        group = RuleGroup(
            name=data.name,
            description=data.description,
            tenant_id=tenant_id,
            created_by=created_by,
        )
        self.session.add(group)
        await self.session.flush()
        await self.session.refresh(group)
        return group

    async def update_group(
        self, group_id: int, tenant_id: int, data: RuleGroupUpdate
    ) -> Optional[RuleGroup]:
        """更新规则组"""
        group = await self._get_group(group_id, tenant_id)
        if not group:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(group, key, value)
        await self.session.flush()
        await self.session.refresh(group)
        return group

    async def delete_group(self, group_id: int, tenant_id: int) -> bool:
        """删除规则组（ORM 级联自动清理关联规则+条件+结论）"""
        group = await self._get_group(group_id, tenant_id)
        if not group:
            return False
        await self.session.delete(group)
        await self.session.flush()
        return True

    async def _get_group(self, group_id: int, tenant_id: int) -> Optional[RuleGroup]:
        """获取单个规则组（含 tenant_id 隔离）"""
        result = await self.session.execute(
            select(RuleGroup).where(
                RuleGroup.id == group_id,
                RuleGroup.tenant_id == tenant_id,
            )
        )
        return result.scalar_one_or_none()

    # ========== 规则 CRUD ==========

    async def get_rules_by_group(self, group_id: int, tenant_id: int) -> list[RuleOut]:
        """获取规则组下所有规则（含条件+结论）"""
        # 先验证组归属
        group = await self._get_group(group_id, tenant_id)
        if not group:
            return []

        result = await self.session.execute(
            select(Rule)
            .where(Rule.group_id == group_id)
            .options(selectinload(Rule.conditions), selectinload(Rule.actions))
            .order_by(Rule.priority.desc(), Rule.id)
        )
        rules = result.scalars().all()
        return [RuleOut.model_validate(r) for r in rules]

    async def create_rule(
        self, data: RuleCreateRequest, tenant_id: int, created_by: int
    ) -> Rule:
        """新建规则（含条件+结论，事务原子操作）"""
        # 验证规则组归属
        group = await self._get_group(data.group_id, tenant_id)
        if not group:
            raise ValueError("规则组不存在或无权访问")

        # 创建规则主体
        rule = Rule(
            group_id=data.group_id,
            name=data.name,
            category=data.category,
            priority=data.priority,
            tenant_id=tenant_id,
            created_by=created_by,
        )
        self.session.add(rule)
        await self.session.flush()

        # 批量创建条件
        for cond in data.conditions:
            self.session.add(RuleCondition(
                rule_id=rule.id,
                field=cond.field,
                operator=cond.operator,
                value=cond.value,
            ))

        # 批量创建结论
        for action in data.actions:
            self.session.add(RuleAction(
                rule_id=rule.id,
                target_chapter=action.target_chapter,
                snippet_id=action.snippet_id,
                params_override=action.params_override,
            ))

        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def update_rule(
        self, rule_id: int, tenant_id: int, data: RuleUpdateRequest
    ) -> Optional[Rule]:
        """更新规则（可选更新条件+结论）"""
        rule = await self._get_rule(rule_id, tenant_id)
        if not rule:
            return None

        # 更新基础字段
        basic_fields = data.model_dump(
            exclude_unset=True, exclude={"conditions", "actions"}
        )
        for key, value in basic_fields.items():
            setattr(rule, key, value)

        # 替换条件（Delete-Insert 策略）
        if data.conditions is not None:
            await self.session.execute(
                delete(RuleCondition).where(RuleCondition.rule_id == rule_id)
            )
            for cond in data.conditions:
                self.session.add(RuleCondition(
                    rule_id=rule_id,
                    field=cond.field,
                    operator=cond.operator,
                    value=cond.value,
                ))

        # 替换结论
        if data.actions is not None:
            await self.session.execute(
                delete(RuleAction).where(RuleAction.rule_id == rule_id)
            )
            for action in data.actions:
                self.session.add(RuleAction(
                    rule_id=rule_id,
                    target_chapter=action.target_chapter,
                    snippet_id=action.snippet_id,
                    params_override=action.params_override,
                ))

        # 版本号自增
        rule.version += 1
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def delete_rule(self, rule_id: int, tenant_id: int) -> bool:
        """删除规则（ORM 级联自动清理条件+结论）"""
        rule = await self._get_rule(rule_id, tenant_id)
        if not rule:
            return False
        await self.session.delete(rule)
        await self.session.flush()
        return True

    async def _get_rule(self, rule_id: int, tenant_id: int) -> Optional[Rule]:
        """获取单个规则（含 tenant_id 隔离）"""
        result = await self.session.execute(
            select(Rule)
            .where(Rule.id == rule_id, Rule.tenant_id == tenant_id)
            .options(selectinload(Rule.conditions), selectinload(Rule.actions))
        )
        return result.scalar_one_or_none()

    # ========== Match Engine 核心 ==========

    async def match_rules(
        self, project_id: int, tenant_id: int
    ) -> MatchResult:
        """
        规则匹配引擎

        流程：
        1. 读取项目参数
        2. 加载当前租户所有启用规则
        3. 逐条评估条件（AND 逻辑）
        4. 收集命中结论，按 priority 降序返回
        """
        # 1. 读取项目参数
        params = await self._load_project_params(project_id, tenant_id)
        if params is None:
            raise ValueError("项目不存在或参数未填写")

        # 转为字典便于字段查找
        params_dict = {
            c.key: getattr(params, c.key)
            for c in params.__table__.columns
            if c.key not in ("id", "project_id")
        }

        # 2. 加载所有启用规则
        result = await self.session.execute(
            select(Rule)
            .join(RuleGroup)
            .where(
                RuleGroup.tenant_id == tenant_id,
                Rule.is_active == True,  # noqa: E712
            )
            .options(selectinload(Rule.conditions), selectinload(Rule.actions))
        )
        all_rules = result.scalars().all()

        # 3. 逐条评估
        matched: list[MatchedRule] = []
        chapters_set: set[str] = set()

        for rule in all_rules:
            if self._evaluate_rule(params_dict, rule.conditions):
                matched.append(MatchedRule(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    category=rule.category,
                    priority=rule.priority,
                    conditions=[ConditionOut.model_validate(c) for c in rule.conditions],
                    actions=[ActionOut.model_validate(a) for a in rule.actions],
                ))
                for action in rule.actions:
                    chapters_set.add(action.target_chapter)

        # 4. 按 priority 降序排列
        matched.sort(key=lambda r: r.priority, reverse=True)

        return MatchResult(
            project_id=project_id,
            matched_rules=matched,
            total_matched=len(matched),
            matched_chapters=sorted(chapters_set),
        )

    def _evaluate_rule(
        self, params: dict, conditions: list[RuleCondition]
    ) -> bool:
        """评估单条规则的所有条件（AND 逻辑）"""
        for cond in conditions:
            param_value = params.get(cond.field)
            if param_value is None:
                return False  # 字段不存在或为空 → 不匹配
            if not self._evaluate_condition(param_value, cond.operator, cond.value):
                return False
        return True

    @staticmethod
    def _evaluate_condition(param_value, operator: str, cond_value: str) -> bool:
        """
        核心运算符评估器 — 9 种运算符实现

        参数:
            param_value: ProjectParams 中的实际值
            operator: 运算符标识
            cond_value: 规则条件中的期望值（JSON 序列化字符串）
        """
        try:
            if operator == "eq":
                return str(param_value) == cond_value

            elif operator == "ne":
                return str(param_value) != cond_value

            elif operator == "gt":
                return float(param_value) > float(cond_value)

            elif operator == "lt":
                return float(param_value) < float(cond_value)

            elif operator == "gte":
                return float(param_value) >= float(cond_value)

            elif operator == "lte":
                return float(param_value) <= float(cond_value)

            elif operator == "in":
                # cond_value 格式: '["矩形","拱形"]'
                allowed = json.loads(cond_value)
                return str(param_value) in allowed

            elif operator == "between":
                # cond_value 格式: '[15, 45]'
                bounds = json.loads(cond_value)
                if len(bounds) != 2:
                    return False
                return float(bounds[0]) <= float(param_value) <= float(bounds[1])

            elif operator == "contains":
                return cond_value in str(param_value)

            else:
                # 未知运算符 → 不匹配（安全降级）
                return False

        except (ValueError, TypeError, json.JSONDecodeError):
            # 类型转换失败 → 不匹配（安全降级）
            return False

    async def _load_project_params(
        self, project_id: int, tenant_id: int
    ) -> Optional[ProjectParams]:
        """加载项目参数（含 tenant_id 隔离）"""
        # 先验证项目归属
        proj_result = await self.session.execute(
            select(Project).where(
                Project.id == project_id,
                Project.tenant_id == tenant_id,
            )
        )
        project = proj_result.scalar_one_or_none()
        if not project:
            return None

        # 加载参数
        params_result = await self.session.execute(
            select(ProjectParams).where(ProjectParams.project_id == project_id)
        )
        return params_result.scalar_one_or_none()
