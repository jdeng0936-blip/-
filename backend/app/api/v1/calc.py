"""
计算校验 API 路由 — 支护计算 + 合规校核

无状态纯函数，不依赖数据库会话。
"""
from fastapi import APIRouter, Depends

from app.core.deps import get_current_user_payload
from app.schemas.common import ApiResponse
from app.schemas.calc import SupportCalcInput, SupportCalcResult
from app.schemas.vent import VentCalcInput, VentCalcResult
from app.schemas.cycle import CycleCalcInput, CycleCalcResult
from app.services.calc_engine import SupportCalcEngine
from app.services.vent_engine import VentCalcEngine
from app.services.cycle_engine import CycleCalcEngine

router = APIRouter(prefix="/calc", tags=["计算校验"])


@router.post("/support", response_model=ApiResponse[SupportCalcResult])
async def calc_support(
    body: SupportCalcInput,
    payload: dict = Depends(get_current_user_payload),
):
    """支护计算"""
    result = SupportCalcEngine.calculate(body)
    return ApiResponse(data=result)


@router.post("/ventilation", response_model=ApiResponse[VentCalcResult])
async def calc_ventilation(
    body: VentCalcInput,
    payload: dict = Depends(get_current_user_payload),
):
    """通风计算"""
    result = VentCalcEngine.calculate(body)
    return ApiResponse(data=result)


@router.post("/cycle", response_model=ApiResponse[CycleCalcResult])
async def calc_cycle(
    body: CycleCalcInput,
    payload: dict = Depends(get_current_user_payload),
):
    """循环作业计算 — 工序编排 + 日/月进尺 + 正规循环率"""
    result = CycleCalcEngine.calculate(body)
    return ApiResponse(data=result)
