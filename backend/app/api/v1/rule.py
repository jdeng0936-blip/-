"""
规则引擎 API 路由 — 规则组/规则 CRUD + 匹配引擎

所有接口强制 JWT 认证 + tenant_id 隔离。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user_payload, get_tenant_id
from app.schemas.common import ApiResponse
from app.schemas.rule import (
    RuleGroupCreate,
    RuleGroupUpdate,
    RuleGroupOut,
    RuleCreateRequest,
    RuleUpdateRequest,
    RuleOut,
    MatchResult,
)
from app.services.rule_service import RuleService

router = APIRouter(prefix="/rules", tags=["规则引擎"])


# ========== 规则组 ==========

@router.get("/groups", response_model=ApiResponse[list[RuleGroupOut]])
async def list_groups(
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """获取规则组列表"""
    svc = RuleService(session)
    items = await svc.list_groups(tenant_id)
    return ApiResponse(data=items)


@router.post("/groups", response_model=ApiResponse[RuleGroupOut])
async def create_group(
    body: RuleGroupCreate,
    payload: dict = Depends(get_current_user_payload),
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """新建规则组"""
    svc = RuleService(session)
    group = await svc.create_group(body, tenant_id, int(payload["sub"]))
    return ApiResponse(data=RuleGroupOut(
        id=group.id,
        name=group.name,
        description=group.description,
        rule_count=0,
    ))


@router.put("/groups/{group_id}", response_model=ApiResponse[RuleGroupOut])
async def update_group(
    group_id: int,
    body: RuleGroupUpdate,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """更新规则组"""
    svc = RuleService(session)
    group = await svc.update_group(group_id, tenant_id, body)
    if not group:
        raise HTTPException(status_code=404, detail="规则组不存在")
    return ApiResponse(data=RuleGroupOut.model_validate(group))


@router.delete("/groups/{group_id}", response_model=ApiResponse)
async def delete_group(
    group_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """删除规则组（级联删除关联规则+条件+结论）"""
    svc = RuleService(session)
    success = await svc.delete_group(group_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="规则组不存在")
    return ApiResponse(message="删除成功")


# ========== 规则 ==========

@router.get("/groups/{group_id}/rules", response_model=ApiResponse[list[RuleOut]])
async def get_rules_by_group(
    group_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """获取规则组下所有规则（含条件+结论）"""
    svc = RuleService(session)
    rules = await svc.get_rules_by_group(group_id, tenant_id)
    return ApiResponse(data=rules)


@router.post("", response_model=ApiResponse[RuleOut])
async def create_rule(
    body: RuleCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """新建规则（含条件+结论，事务原子操作）"""
    svc = RuleService(session)
    try:
        rule = await svc.create_rule(body, tenant_id, int(payload["sub"]))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ApiResponse(data=RuleOut.model_validate(rule))


@router.put("/{rule_id}", response_model=ApiResponse[RuleOut])
async def update_rule(
    rule_id: int,
    body: RuleUpdateRequest,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """更新规则（可选更新条件+结论）"""
    svc = RuleService(session)
    rule = await svc.update_rule(rule_id, tenant_id, body)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return ApiResponse(data=RuleOut.model_validate(rule))


@router.delete("/{rule_id}", response_model=ApiResponse)
async def delete_rule(
    rule_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """删除规则（级联删除条件+结论）"""
    svc = RuleService(session)
    success = await svc.delete_rule(rule_id, tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="规则不存在")
    return ApiResponse(message="删除成功")


# ========== 匹配引擎（挂在 /projects 下） ==========

match_router = APIRouter(prefix="/projects", tags=["规则匹配"])


@match_router.post("/{project_id}/match", response_model=ApiResponse[MatchResult])
async def trigger_match(
    project_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """触发规则匹配（读取 ProjectParams → 遍历规则 → 返回命中结果）"""
    svc = RuleService(session)
    try:
        result = await svc.match_rules(project_id, tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ApiResponse(data=result)
