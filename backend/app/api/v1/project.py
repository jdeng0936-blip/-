"""
项目管理 API 路由 — Project CRUD + ProjectParams 读写
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user_payload, get_tenant_id
from app.schemas.common import ApiResponse
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    ProjectParamsCreate, ProjectParamsOut,
)
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["项目管理"])


@router.get("", response_model=ApiResponse[list[ProjectOut]])
async def list_projects(
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """获取当前租户的项目列表"""
    svc = ProjectService(session)
    projects = await svc.list_projects(tenant_id)
    return ApiResponse(data=[ProjectOut.from_orm_with_mine(p) for p in projects])


@router.get("/{project_id}", response_model=ApiResponse[ProjectOut])
async def get_project(
    project_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """获取项目详情（含参数）"""
    svc = ProjectService(session)
    project = await svc.get_project(project_id, tenant_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return ApiResponse(data=ProjectOut.from_orm_with_mine(project))


@router.post("", response_model=ApiResponse[ProjectOut])
async def create_project(
    body: ProjectCreate,
    tenant_id: int = Depends(get_tenant_id),
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_async_session),
):
    """创建项目（可附带初始参数）"""
    user_id = int(payload.get("sub", 0))
    svc = ProjectService(session)
    project = await svc.create_project(body, tenant_id, user_id)
    return ApiResponse(data=ProjectOut.from_orm_with_mine(project))


@router.put("/{project_id}", response_model=ApiResponse[ProjectOut])
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """更新项目基本信息"""
    svc = ProjectService(session)
    project = await svc.update_project(project_id, tenant_id, body)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return ApiResponse(data=ProjectOut.from_orm_with_mine(project))


@router.delete("/{project_id}", response_model=ApiResponse)
async def delete_project(
    project_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """删除项目"""
    svc = ProjectService(session)
    ok = await svc.delete_project(project_id, tenant_id)
    if not ok:
        raise HTTPException(status_code=404, detail="项目不存在")
    return ApiResponse(data={"deleted": True})


@router.get("/{project_id}/params", response_model=ApiResponse[ProjectParamsOut])
async def get_params(
    project_id: int,
    tenant_id: int = Depends(get_tenant_id),
    session: AsyncSession = Depends(get_async_session),
):
    """获取项目参数"""
    svc = ProjectService(session)
    params = await svc.get_params(project_id, tenant_id)
    if not params:
        raise HTTPException(status_code=404, detail="参数未填写")
    return ApiResponse(data=ProjectParamsOut.model_validate(params))


@router.put("/{project_id}/params", response_model=ApiResponse[ProjectParamsOut])
async def upsert_params(
    project_id: int,
    body: ProjectParamsCreate,
    tenant_id: int = Depends(get_tenant_id),
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_async_session),
):
    """创建或更新项目参数（Upsert）"""
    user_id = int(payload.get("sub", 0))
    svc = ProjectService(session)
    params = await svc.upsert_params(project_id, tenant_id, body, user_id)
    return ApiResponse(data=ProjectParamsOut.model_validate(params))
