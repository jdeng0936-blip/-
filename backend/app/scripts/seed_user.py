"""
种子数据初始化 — 开发环境创建默认管理员账号

运行方式：
  cd backend && python3 -m app.scripts.seed_user
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine, async_session_factory
from app.core.security import get_password_hash
from app.models.user import SysUser, SysRole


async def seed():
    """创建默认角色和管理员用户"""
    async with async_session_factory() as session:
        # 1. 创建默认角色
        result = await session.execute(
            select(SysRole).where(SysRole.name == "admin")
        )
        role = result.scalar_one_or_none()
        if not role:
            role = SysRole(name="admin", description="系统管理员")
            session.add(role)
            await session.flush()
            print("✅ 创建角色: admin")

        # 2. 创建默认管理员
        result = await session.execute(
            select(SysUser).where(SysUser.username == "admin")
        )
        user = result.scalar_one_or_none()
        if not user:
            user = SysUser(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                real_name="系统管理员",
                role_id=role.id,
                is_active=True,
                tenant_id=1,
            )
            session.add(user)
            print("✅ 创建管理员: admin / admin123")
        else:
            print("ℹ️  管理员用户已存在")

        await session.commit()
        print("🎉 种子数据初始化完成！")


if __name__ == "__main__":
    asyncio.run(seed())
