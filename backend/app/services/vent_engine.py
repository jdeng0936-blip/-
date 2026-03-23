"""
通风计算引擎 — 无状态纯函数

核心公式（依据《煤矿安全规程》通风章节）：
  V1: Q_gas = 100 × q_gas × K_g  (瓦斯涌出法)
  V2: Q_people = 4 × N            (人数法，每人 4 m³/min)
  V3: Q_explosive = 25 × A^(1/3)  (炸药法)
  V4: Q_required = max(V1, V2, V3)
  V5: 风速验算 v = Q / (60 × S), 要求 0.25 ≤ v ≤ 4.0 m/s
"""
import math

from app.schemas.vent import VentCalcInput, VentCalcResult, VentWarning


# 瓦斯等级 → 涌出安全系数（国标基准）
GAS_K_FACTOR: dict[str, float] = {
    "低瓦斯": 1.5,
    "高瓦斯": 2.0,
    "突出": 2.5,
}

# ===== 集团加严参数（华阳集团《采掘运技术管理规定》）=====
# 瓦斯备用风量系数下限：高突矿井此值小于1.7时取1.7
GROUP_MIN_K_GAS: dict[str, float] = {
    "突出": 1.7,
}
# 突出煤层掘进工作面最低配风量
GROUP_MIN_AIRFLOW: dict[str, float] = {
    "突出": 400.0,  # m³/min
}
# 突出煤层全风压最低风速
GROUP_MIN_WIND_SPEED: dict[str, float] = {
    "突出": 0.25,  # m/s
}

# 局扇选型表（按需风量区间）
FAN_TABLE = [
    (0,   100,  "FBD-5.0/2×5.5",  11.0),
    (100, 200,  "FBD-5.6/2×11",   22.0),
    (200, 350,  "FBD-6.3/2×15",   30.0),
    (350, 500,  "FBD-6.3/2×22",   44.0),
    (500, 800,  "FBD-7.1/2×30",   60.0),
    (800, 9999, "FBD-8.0/2×55",   110.0),
]


class VentCalcEngine:
    """通风计算引擎 — 无状态纯函数"""

    @staticmethod
    def calculate(input_data: VentCalcInput) -> VentCalcResult:
        """执行通风计算 + 合规校核"""
        warnings: list[VentWarning] = []
        is_compliant = True

        K_g = GAS_K_FACTOR.get(input_data.gas_level, 1.5)
        S = input_data.section_area

        # ===== V1: 瓦斯涌出法 =====
        q_gas = round(100 * input_data.gas_emission * K_g, 2)

        # ===== V2: 下井人数法 =====
        q_people = round(4.0 * input_data.max_workers, 2)

        # ===== V3: 炸药消耗法 =====
        if input_data.explosive_per_cycle > 0:
            q_explosive = round(25 * input_data.explosive_per_cycle ** (1 / 3), 2)
        else:
            q_explosive = 0.0

        # ===== V4: 取最大值 =====
        q_required = max(q_gas, q_people, q_explosive)

        # ===== 集团加严：突出煤层最低配风量 =====
        group_min = GROUP_MIN_AIRFLOW.get(input_data.gas_level, 0)
        if group_min > 0 and q_required < group_min:
            q_required = group_min  # 集团标准兜底

        # ===== V5: 风速验算 =====
        # v = Q / (60 × S)
        wind_speed = q_required / (60 * S) if S > 0 else 0
        wind_speed_min = round(max(wind_speed, 0.25), 2)

        # 最高风速限制（煤巷 4.0 m/s，岩巷 4.0 m/s）
        wind_speed_max = 4.0

        # ===== 局扇选型 =====
        fan_model = "FBD-8.0/2×55"
        fan_power = 110.0
        for low, high, model, power in FAN_TABLE:
            if low <= q_required < high:
                fan_model = model
                fan_power = power
                break

        # ===== 合规校核 =====

        # 风速下限检查
        if wind_speed < 0.25:
            warnings.append(VentWarning(
                level="warning", field="wind_speed",
                message=f"计算风速 {round(wind_speed, 2)} m/s 低于最低标准 0.25 m/s，需增大供风量",
                current_value=round(wind_speed, 2),
                required_value=0.25,
            ))

        # 风速上限检查
        if wind_speed > wind_speed_max:
            warnings.append(VentWarning(
                level="error", field="wind_speed",
                message=f"计算风速 {round(wind_speed, 2)} m/s 超过上限 {wind_speed_max} m/s",
                current_value=round(wind_speed, 2),
                required_value=wind_speed_max,
            ))
            is_compliant = False

        # 用户设计供风量校核
        if input_data.design_air_volume is not None:
            if input_data.design_air_volume < q_required:
                warnings.append(VentWarning(
                    level="error", field="design_air_volume",
                    message=(
                        f"设计供风量不足：{input_data.design_air_volume} m³/min "
                        f"< 需风量 {q_required} m³/min"
                    ),
                    current_value=input_data.design_air_volume,
                    required_value=q_required,
                ))
                is_compliant = False

        # 用户设计风速校核
        if input_data.design_wind_speed is not None:
            if input_data.design_wind_speed < 0.25:
                warnings.append(VentWarning(
                    level="error", field="design_wind_speed",
                    message=f"设计风速 {input_data.design_wind_speed} m/s < 最低标准 0.25 m/s",
                    current_value=input_data.design_wind_speed,
                    required_value=0.25,
                ))
                is_compliant = False
            if input_data.design_wind_speed > wind_speed_max:
                warnings.append(VentWarning(
                    level="error", field="design_wind_speed",
                    message=f"设计风速 {input_data.design_wind_speed} m/s > 上限 {wind_speed_max} m/s",
                    current_value=input_data.design_wind_speed,
                    required_value=wind_speed_max,
                ))
                is_compliant = False

        # 高瓦斯/突出矿井提示
        if input_data.gas_level in ("高瓦斯", "突出"):
            warnings.append(VentWarning(
                level="warning", field="gas_level",
                message=f"{input_data.gas_level}矿井，须配备瓦斯监测及断电装置",
                current_value=K_g,
                required_value=1.5,
            ))

        # ===== 集团标准合规校核 =====

        # 集团加严：突出煤层最低配风量
        group_min_air = GROUP_MIN_AIRFLOW.get(input_data.gas_level, 0)
        if group_min_air > 0:
            if q_required < group_min_air:
                warnings.append(VentWarning(
                    level="error", field="q_required",
                    message=(
                        f"【集团标准】突出煤层掘进工作面配风量 {q_required} m³/min "
                        f"< 集团最低要求 {group_min_air} m³/min"
                    ),
                    current_value=q_required,
                    required_value=group_min_air,
                ))
                is_compliant = False
            else:
                warnings.append(VentWarning(
                    level="info", field="q_required",
                    message=(
                        f"【集团标准】突出煤层配风量 {q_required} m³/min "
                        f"≥ 集团最低要求 {group_min_air} m³/min ✓"
                    ),
                    current_value=q_required,
                    required_value=group_min_air,
                ))

        # 集团加严：瓦斯备用风量系数
        group_min_k = GROUP_MIN_K_GAS.get(input_data.gas_level, 0)
        if group_min_k > 0 and K_g < group_min_k:
            warnings.append(VentWarning(
                level="warning", field="gas_k_factor",
                message=(
                    f"【集团标准】瓦斯备用风量系数 {K_g} "
                    f"< 集团最低要求 {group_min_k}，建议调整"
                ),
                current_value=K_g,
                required_value=group_min_k,
            ))

        return VentCalcResult(
            q_gas=q_gas,
            q_people=q_people,
            q_explosive=q_explosive,
            q_required=round(q_required, 2),
            wind_speed_min=wind_speed_min,
            wind_speed_max=wind_speed_max,
            recommended_fan=fan_model,
            fan_power=fan_power,
            is_compliant=is_compliant,
            warnings=warnings,
        )

    @staticmethod
    def narrative(inp: VentCalcInput, res: VentCalcResult) -> str:
        """
        输出完整通风计算推导过程段落，供 AI 注入文档使用

        包含：瓦斯涌出法、人数法、炸药法、取大值、风速校核、局扇选型
        """
        K_g = GAS_K_FACTOR.get(inp.gas_level, 1.5)

        lines = []
        lines.append("一、掘进工作面需风量计算")
        lines.append("")
        lines.append("（一）按瓦斯涌出量计算")
        lines.append(f"  依据《煤矿安全规程》第XXX条，按瓦斯涌出量计算掘进工作面需风量。")
        lines.append(f"  Q瓦斯 = 100 × q × K")
        lines.append(f"  式中：q — 掘进工作面绝对瓦斯涌出量 = {inp.gas_emission} m³/min")
        lines.append(f"        K — 瓦斯涌出不均衡系数 = {K_g}（{inp.gas_level}矿井）")
        lines.append(f"  Q瓦斯 = 100 × {inp.gas_emission} × {K_g}")
        lines.append(f"       = {res.q_gas} m³/min")

        lines.append("")
        lines.append("（二）按下井人数计算")
        lines.append(f"  Q人数 = 4 × N")
        lines.append(f"  式中：N — 掘进工作面同时最多人数 = {inp.max_workers} 人")
        lines.append(f"  Q人数 = 4 × {inp.max_workers}")
        lines.append(f"       = {res.q_people} m³/min")

        lines.append("")
        lines.append("（三）按炸药消耗量计算")
        if inp.explosive_per_cycle > 0:
            lines.append(f"  Q炸药 = 25 × A^(1/3)")
            lines.append(f"  式中：A — 每次爆破炸药最大消耗量 = {inp.explosive_per_cycle} kg")
            lines.append(f"  Q炸药 = 25 × {inp.explosive_per_cycle}^(1/3)")
            lines.append(f"       = {res.q_explosive} m³/min")
        else:
            lines.append(f"  本工作面采用综掘方式，不使用炸药，Q炸药 = 0 m³/min")

        lines.append("")
        lines.append("（四）确定掘进工作面需风量")
        lines.append(f"  Q = max(Q瓦斯, Q人数, Q炸药)")
        lines.append(f"    = max({res.q_gas}, {res.q_people}, {res.q_explosive})")
        lines.append(f"    = {res.q_required} m³/min")

        # 集团标准兜底
        group_min = GROUP_MIN_AIRFLOW.get(inp.gas_level, 0)
        if group_min > 0:
            lines.append(f"  【集团标准】突出煤层最低配风量为 {group_min} m³/min")
            lines.append(f"  最终确定 Q = max({res.q_required}, {group_min}) = {max(res.q_required, group_min)} m³/min")

        lines.append("")
        lines.append("二、风速验算")
        lines.append(f"  巷道断面积 S = {inp.section_area} m²")
        lines.append(f"  V = Q/(60×S) = {res.q_required}/(60×{inp.section_area})")
        v = res.q_required / (60 * inp.section_area) if inp.section_area > 0 else 0
        lines.append(f"    = {round(v, 2)} m/s")
        lines.append(f"  依据《煤矿安全规程》：0.25 m/s ≤ V ≤ 4.0 m/s")
        if 0.25 <= v <= 4.0:
            lines.append(f"  校核结果：{round(v, 2)} m/s 满足要求 ✓")
        elif v < 0.25:
            lines.append(f"  校核结果：{round(v, 2)} m/s 低于下限 0.25 m/s，需增大供风量 ✗")
        else:
            lines.append(f"  校核结果：{round(v, 2)} m/s 超过上限 4.0 m/s ✗")

        lines.append("")
        lines.append("三、局部通风机选型")
        lines.append(f"  需风量 {res.q_required} m³/min")
        lines.append(f"  推荐型号：{res.recommended_fan}")
        lines.append(f"  额定功率：{res.fan_power} kW")
        lines.append(f"  必须实现双风机双电源自动切换，切换时间≤10秒。")

        lines.append("")
        lines.append("四、合规性校核结论")
        lines.append(f"  整体合规性：{'合规 ✓' if res.is_compliant else '不合规 ✗'}")
        for w in res.warnings:
            lines.append(f"  [{w.level.upper()}] {w.message}")

        return "\n".join(lines)

