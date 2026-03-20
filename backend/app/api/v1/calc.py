"""
计算校验 API 路由 — 支护计算 / 通风 / 循环 / 锚索 / 批量合规 / 规则冲突

无状态纯函数（锚索/合规），规则冲突需要数据库会话。
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_async_session
from app.core.deps import get_current_user_payload
from app.schemas.common import ApiResponse
from app.schemas.calc import SupportCalcInput, SupportCalcResult
from app.schemas.vent import VentCalcInput, VentCalcResult
from app.schemas.cycle import CycleCalcInput, CycleCalcResult
from app.services.calc_engine import SupportCalcEngine
from app.services.vent_engine import VentCalcEngine
from app.services.cycle_engine import CycleCalcEngine
from app.services.cable_engine import CableCalcInput, CableCalcResult, CableCalcEngine
from app.services.compliance_engine import ComplianceInput, ComplianceResult, ComplianceEngine
from app.services.conflict_detector import ConflictResult, ConflictDetector

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


@router.post("/cable", response_model=ApiResponse[CableCalcResult])
async def calc_cable(
    body: CableCalcInput,
    payload: dict = Depends(get_current_user_payload),
):
    """锚索受力计算 — 松动圈理论 + 预紧力校核"""
    result = CableCalcEngine.calculate(body)
    return ApiResponse(data=result)


@router.post("/compliance", response_model=ApiResponse[ComplianceResult])
async def calc_compliance(
    body: ComplianceInput,
    payload: dict = Depends(get_current_user_payload),
):
    """批量合规校验 — 断面/支护/通风/安全四维度校核"""
    result = ComplianceEngine.check(body)
    return ApiResponse(data=result)


@router.get("/rule-conflicts", response_model=ApiResponse[ConflictResult])
async def check_rule_conflicts(
    group_id: Optional[int] = Query(None, description="规则组ID，不填则检测全部"),
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_async_session),
):
    """规则冲突检测 — 分析规则库中的逻辑冲突"""
    detector = ConflictDetector(session)
    result = await detector.detect(group_id=group_id)
    return ApiResponse(data=result)


@router.post("/compliance/project/{project_id}", response_model=ApiResponse[ComplianceResult])
async def calc_project_compliance(
    project_id: int,
    payload: dict = Depends(get_current_user_payload),
    session: AsyncSession = Depends(get_async_session),
):
    """按项目ID自动提取参数执行合规审查（无需前端手动填参数）"""
    from sqlalchemy import text

    tenant_id = int(payload.get("tenant_id", 0)) if payload else 0
    row = await session.execute(text(
        "SELECT pp.rock_class, pp.gas_level, pp.coal_thickness, "
        "pp.spontaneous_combustion, pp.section_form, pp.section_width, "
        "pp.section_height, pp.excavation_length "
        "FROM project_params pp "
        "JOIN project p ON p.id = pp.project_id "
        "WHERE pp.project_id = :pid AND p.tenant_id = :tid"
    ), {"pid": project_id, "tid": tenant_id})
    r = row.mappings().first()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(404, "项目不存在或无参数")

    inp = ComplianceInput(
        rock_class=r["rock_class"] or "III",
        gas_level=r["gas_level"] or "低瓦斯",
        coal_thickness=float(r["coal_thickness"] or 3.0),
        spontaneous_combustion=r["spontaneous_combustion"] or "不易自燃",
        section_form=r["section_form"] or "矩形",
        section_width=float(r["section_width"] or 4.5),
        section_height=float(r["section_height"] or 3.2),
        excavation_length=float(r["excavation_length"] or 600),
    )
    result = ComplianceEngine.check(inp)
    return ApiResponse(data=result)
