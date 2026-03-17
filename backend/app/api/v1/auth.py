"""
认证路由 — 登录 / 登出 / 当前用户
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_async_session
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user_payload
from app.models.user import SysUser
from app.schemas.auth import LoginRequest, TokenResponse, UserProfile
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """用户登录，返回 JWT Token"""
    result = await session.execute(
        select(SysUser).where(SysUser.username == body.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    token = create_access_token(
        subject=user.id,
        tenant_id=user.tenant_id,
    )
    return ApiResponse(data=TokenResponse(access_token=token))


@router.get("/profile", response_model=ApiResponse[UserProfile])
async def get_profile(
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_async_session),
):
    """获取当前登录用户信息"""
    user_id = int(payload["sub"])
    result = await session.execute(
        select(SysUser).where(SysUser.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    return ApiResponse(
        data=UserProfile(
            id=user.id,
            username=user.username,
            real_name=user.real_name,
            role_name=user.role.name if user.role else None,
            tenant_id=user.tenant_id,
        )
    )
