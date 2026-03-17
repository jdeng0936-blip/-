"""
循环作业计算引擎 — 无状态纯函数

核心公式：
  C1: 循环进尺 — 钻爆法: hole_depth × utilization_rate / 综掘: cut_depth
  C2: 单循环时间 — 各工序之和
  C3: 日循环数 — 有效工时 / 单循环时间
  C4: 月进尺 — 日循环数 × 循环进尺 × 月工作日
  C5: 正规循环率 — 实际循环 / 计划循环 × 100%
"""
import math

from app.schemas.cycle import CycleCalcInput, CycleCalcResult, CycleWarning


class CycleCalcEngine:
    """循环作业计算引擎"""

    @staticmethod
    def calculate(input_data: CycleCalcInput) -> CycleCalcResult:
        warnings: list[CycleWarning] = []
        is_compliant = True

        # ===== C1: 循环进尺 =====
        if input_data.dig_method == "钻爆法":
            cycle_advance = round(input_data.hole_depth * input_data.utilization_rate, 2)
        else:
            cycle_advance = round(input_data.cut_depth, 2)

        # ===== C2: 单循环时间 =====
        if input_data.dig_method == "钻爆法":
            cycle_time = (
                input_data.t_drilling + input_data.t_charging +
                input_data.t_blasting + input_data.t_ventilation +
                input_data.t_mucking + input_data.t_support + input_data.t_other
            )
        else:
            # 综掘无打眼/装药/放炮/通风，用截割+出矸+支护
            cycle_time = (
                input_data.t_mucking + input_data.t_support + input_data.t_other
            )

        # ===== C3: 日有效工时 & 日循环数 =====
        total_hours = input_data.shifts_per_day * input_data.hours_per_shift
        effective_hours = round(total_hours * input_data.effective_rate, 2)
        effective_minutes = effective_hours * 60

        if cycle_time > 0:
            cycles_per_day = effective_minutes / cycle_time
        else:
            cycles_per_day = 0

        # 取整（向下取整，不能超过实际可用时间）
        cycles_per_day_int = math.floor(cycles_per_day)
        cycles_per_day_final = max(cycles_per_day_int, 1)

        # ===== C4: 日进尺 & 月进尺 =====
        daily_advance = round(cycles_per_day_final * cycle_advance, 2)
        monthly_advance = round(daily_advance * input_data.work_days_per_month, 2)

        # ===== C5: 正规循环率 =====
        # 按理论最大循环数计算
        max_theoretical = effective_minutes / cycle_time if cycle_time > 0 else 0
        cycle_rate = round((cycles_per_day_final / max_theoretical * 100)
                           if max_theoretical > 0 else 0, 1)

        # ===== 合规校核 =====

        # 单循环时间过长
        if cycle_time > 480:
            warnings.append(CycleWarning(
                level="warning", field="cycle_time",
                message=f"单循环时间 {cycle_time} min > 480 min（8小时），效率偏低",
                current_value=cycle_time, required_value=480,
            ))

        # 月进尺校核
        if input_data.design_monthly_advance is not None:
            if monthly_advance < input_data.design_monthly_advance:
                warnings.append(CycleWarning(
                    level="error", field="monthly_advance",
                    message=(
                        f"计算月进尺 {monthly_advance}m "
                        f"< 设计要求 {input_data.design_monthly_advance}m，"
                        f"需优化工序或增加班次"
                    ),
                    current_value=monthly_advance,
                    required_value=input_data.design_monthly_advance,
                ))
                is_compliant = False

        # 循环进尺过小提示
        if cycle_advance < 0.6:
            warnings.append(CycleWarning(
                level="info", field="cycle_advance",
                message=f"循环进尺 {cycle_advance}m 偏小，建议增大截割/炮眼深度",
                current_value=cycle_advance, required_value=0.6,
            ))

        return CycleCalcResult(
            cycle_advance=cycle_advance,
            cycle_time=round(cycle_time, 1),
            cycles_per_day=cycles_per_day_final,
            daily_advance=daily_advance,
            monthly_advance=monthly_advance,
            effective_hours=effective_hours,
            cycle_rate=cycle_rate,
            is_compliant=is_compliant,
            warnings=warnings,
        )
