"""
AI 对话 API 路由 — SSE 流式输出 + 非流式

架构红线：单向流式输出用 SSE
"""
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.deps import get_current_user_payload
from app.schemas.common import ApiResponse
from app.schemas.ai import ChatRequest, ChatResponse
from app.services.ai_router import AIRouter

router = APIRouter(prefix="/ai", tags=["AI 智能路由"])

# 复用单例
_ai_router = None


def get_ai_router() -> AIRouter:
    global _ai_router
    if _ai_router is None:
        _ai_router = AIRouter()
    return _ai_router


@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    payload: dict = Depends(get_current_user_payload),
):
    """AI 对话 — 自然语言驱动计算引擎

    支持两种模式：
    - stream=true → SSE 流式输出（默认）
    - stream=false → 完整 JSON 响应
    """
    ai = get_ai_router()

    # 构建历史消息
    history = [{"role": m.role, "content": m.content} for m in body.history]

    if body.stream:
        # SSE 流式输出
        return StreamingResponse(
            ai.chat_stream(body.message, history),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    else:
        # 非流式
        reply = await ai.chat(body.message, history)
        return ApiResponse(data=ChatResponse(reply=reply))
