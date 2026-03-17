"""
项目管理 Service — Project + ProjectParams CRUD

Tenant 隔离：所有查询注入 tenant_id 过滤。
"""
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import Project, ProjectParams
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectParamsCreate,
)


class ProjectService:
    """项目 CRUD 服务"""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ========== Project CRUD ==========

    async def list_projects(self, tenant_id: int) -> list[Project]:
        """获取租户下所有项目"""
        result = await self.session.execute(
            select(Project)
            .where(Project.tenant_id == tenant_id)
            .options(selectinload(Project.params))
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_project(self, project_id: int, tenant_id: int) -> Optional[Project]:
        """获取单个项目（含参数）"""
        result = await self.session.execute(
            select(Project)
            .where(Project.id == project_id, Project.tenant_id == tenant_id)
            .options(selectinload(Project.params))
        )
        return result.scalar_one_or_none()

    async def create_project(
        self, data: ProjectCreate, tenant_id: int, user_id: int
    ) -> Project:
        """创建项目（可选附带初始参数）"""
        project = Project(
            mine_id=data.mine_id,
            face_name=data.face_name,
            description=data.description,
            tenant_id=tenant_id,
            created_by=user_id,
        )
        self.session.add(project)
        await self.session.flush()  # 获取 project.id

        # 同时创建参数记录
        if data.params:
            params = ProjectParams(
                project_id=project.id,
                tenant_id=tenant_id,
                created_by=user_id,
                **data.params.model_dump(exclude_none=True),
            )
        else:
            # 空参数占位
            params = ProjectParams(
                project_id=project.id,
                tenant_id=tenant_id,
                created_by=user_id,
            )
        self.session.add(params)
        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def update_project(
        self, project_id: int, tenant_id: int, data: ProjectUpdate
    ) -> Optional[Project]:
        """更新项目基本信息"""
        project = await self.get_project(project_id, tenant_id)
        if not project:
            return None
        update_data = data.model_dump(exclude_none=True)
        for k, v in update_data.items():
            setattr(project, k, v)
        await self.session.commit()
        await self.session.refresh(project)
        return project

    async def delete_project(self, project_id: int, tenant_id: int) -> bool:
        """删除项目（含参数级联）"""
        project = await self.get_project(project_id, tenant_id)
        if not project:
            return False
        await self.session.delete(project)
        await self.session.commit()
        return True

    # ========== ProjectParams CRUD ==========

    async def get_params(self, project_id: int, tenant_id: int) -> Optional[ProjectParams]:
        """获取项目参数"""
        result = await self.session.execute(
            select(ProjectParams)
            .join(Project)
            .where(ProjectParams.project_id == project_id, Project.tenant_id == tenant_id)
        )
        return result.scalar_one_or_none()

    async def upsert_params(
        self, project_id: int, tenant_id: int, data: ProjectParamsCreate, user_id: int
    ) -> ProjectParams:
        """创建或更新项目参数（Upsert 语义）"""
        existing = await self.get_params(project_id, tenant_id)
        update_data = data.model_dump(exclude_none=True)

        if existing:
            for k, v in update_data.items():
                setattr(existing, k, v)
            await self.session.commit()
            await self.session.refresh(existing)
            return existing
        else:
            params = ProjectParams(
                project_id=project_id,
                tenant_id=tenant_id,
                created_by=user_id,
                **update_data,
            )
            self.session.add(params)
            await self.session.commit()
            await self.session.refresh(params)
            return params

    async def get_project_count(self, tenant_id: int) -> int:
        """统计项目数量"""
        result = await self.session.execute(
            select(func.count(Project.id)).where(Project.tenant_id == tenant_id)
        )
        return result.scalar() or 0
