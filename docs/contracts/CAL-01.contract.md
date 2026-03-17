# CAL-01 支护计算校验器 — 开发契约

> **状态**：✅ 已实现  
> **模块编号**：CAL-01  
> **优先级**：P1（DOC 文档生成的前置计算层）  
> **依赖**：`models/project.py`(ProjectParams✅)

---

## 1. 业务目标

根据围岩级别及巷道断面参数，自动计算锚杆/锚索受力强度；若人工指定值低于《规范》要求，**触发红色预警并阻断**。

### 核心公式

| # | 计算项 | 公式 | 来源 |
|---|--------|------|------|
| F1 | 顶板锚杆锚固力 | `Q = K × γ × S × L` | GB/T 35056 |
| F2 | 锚杆间排距验算 | `a ≤ L_f / (K × n)` | 锚杆支护规范 |
| F3 | 锚索破断力校核 | `P_b ≥ K_s × Q_单根` | 安全规程 |
| F4 | 巷道断面净面积 | `S = W × H`（矩形）或 `π/8 × W²`（拱形修正） | 几何计算 |
| F5 | 支护密度校核 | `N = S_top / (a × b)` | 支护设计规范 |

> K = 安全系数，γ = 岩石容重，S = 支护面积，L = 锚杆长度
> L_f = 有效锚固长度，n = 同排锚杆数
> K_s = 锚索安全系数

### 合规拦截逻辑

```
if 用户指定锚杆间距 > 计算最大允许间距:
    return ❌ 预警("锚杆间距超限，当前值 {a}mm > 允许值 {a_max}mm")

if 用户指定锚索数量 < 计算最少锚索数:
    return ❌ 预警("锚索不足，当前 {n}根 < 最少 {n_min}根")
```

---

## 2. 数据模型

### 无需新增 ORM 模型

计算引擎为**无状态纯函数**，输入 ProjectParams + 工程参数，输出计算结果。
结果存入 `Project.calc_result`（JSON 字段，后续扩展时加入）。

### 需在 Project 模型新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `calc_result` | JSON | 计算校验结果快照（选填） |
| `calc_warnings` | JSON | 合规预警列表 |

---

## 3. API 契约

> 前缀：`/api/v1/calc`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/calc/support` | 支护计算（输入参数 → 返回计算结果 + 合规预警） | ✅ JWT |
| `POST` | `/calc/support/verify` | 支护参数合规校核（用户手动指定值 vs 计算下限） | ✅ JWT |

### Schema

```python
class SupportCalcInput(BaseModel):
    """支护计算输入参数"""
    rock_class: Literal["I","II","III","IV","V"]
    section_form: Literal["矩形","拱形","梯形"]
    section_width: float    # 巷道宽度 m
    section_height: float   # 巷道高度 m
    rock_density: float = 2.5  # 岩石容重 t/m³
    bolt_length: float = 2.4   # 锚杆长度 m
    bolt_diameter: float = 22  # 锚杆直径 mm
    cable_count: int = 0       # 锚索数量
    cable_strength: float = 260  # 锚索破断力 kN

class SupportCalcResult(BaseModel):
    """支护计算结果"""
    section_area: float      # 净断面积 m²
    bolt_force: float        # 单根锚杆锚固力 kN
    max_bolt_spacing: float  # 最大允许间距 mm
    min_cable_count: int     # 最少锚索数量
    support_density: float   # 支护密度 根/m²
    safety_factor: float     # 安全系数
    is_compliant: bool       # 是否合规
    warnings: list[CalcWarning]  # 预警列表

class CalcWarning(BaseModel):
    """合规预警"""
    level: Literal["error","warning","info"]
    field: str
    message: str
    current_value: float
    required_value: float
```

---

## 4. 前端规格

### 页面：`/dashboard/calc`

| 区域 | 组件 | 说明 |
|------|------|------|
| 左侧 | 参数输入表单（围岩/断面/锚杆/锚索参数） | shadcn Input + Select |
| 右侧上 | 计算结果卡片组（净断面/锚固力/间距/密度/安全系数） | Card + 数值高亮 |
| 右侧下 | 合规状态面板（✅ 合规 / ❌ 不合规 + 预警列表） | Alert 颜色区分 |

---

## 5. 验收清单

- [ ] 矩形/拱形断面面积计算正确
- [ ] 锚杆锚固力公式按 GB/T 35056 实现
- [ ] 锚杆间距校核（超限→红色预警）
- [ ] 锚索数量校核（不足→红色预警）
- [ ] 安全系数 ≥ 1.5 判定合规
- [ ] I-V 类围岩对应不同安全系数
- [ ] 计算结果 JSON 可存入 Project
- [ ] 前端参数输入 + 结果展示 + 预警列表
- [ ] 单元测试覆盖 5 个核心公式边界用例
