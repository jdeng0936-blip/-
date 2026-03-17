# DAT-05 规则引擎 — 开发契约

> **状态**：✅ 已实现  
> **模块编号**：DAT-05  
> **优先级**：P0（系统大脑，主链路瓶颈）  
> **依赖**：DAT-01(标准库✅)、`models/rule.py`(骨架✅)、`models/project.py`(ProjectParams✅)

---

## 1. 业务目标

实现"**地质条件 → 掘进参数 → 规程段落**"的精准联动映射。

核心链路：
```
ProjectParams(17字段) → Match Engine(条件评估) → RuleAction(命中结论) → ChapterSnippet(规程段落)
```

### 两层架构（规范红线第 4 条：严禁硬编码 if-else）

| 层 | 处理范围 | 本阶段范围 |
|----|---------|-----------|
| **结构化规则层** | 确定性条件（围岩=III、瓦斯=高） → 条件表匹配 | ✅ 本次实现 |
| **LLM 路由层** | 模糊推理（复杂地质+多因素交叉） → AI-02 | 🔲 预留接口，后续实现 |

---

## 2. 运算符覆盖矩阵

> [!IMPORTANT]
> 以下矩阵基于 `ProjectParams` 的 17 个字段逐一分析，确保运算符集合足以覆盖采矿工程参数。

### 2.1 运算符定义

| 运算符 | 语义 | 值格式 | 示例 |
|--------|------|--------|------|
| `eq` | 等于 | `"III"` | 围岩级别 = III |
| `ne` | 不等于 | `"突出"` | 瓦斯等级 ≠ 突出 |
| `gt` | 大于 | `"3.5"` | 煤层厚度 > 3.5m |
| `lt` | 小于 | `"25"` | 煤层倾角 < 25° |
| `gte` | 大于等于 | `"4.0"` | 断面宽 ≥ 4.0m |
| `lte` | 小于等于 | `"200"` | 掘进长度 ≤ 200m |
| `in` | 在列表中 | `'["矩形","拱形"]'` | 断面形式 ∈ {矩形, 拱形} |
| `between` | 区间范围 | `'[15, 45]'` | 煤层倾角 ∈ [15°, 45°] |
| `contains` | 包含子串 | `"断层"` | 地质构造 包含 "断层" |

### 2.2 字段-运算符适用矩阵

| ProjectParams 字段 | 数据类型 | 适用运算符 | 典型规则示例 |
|---|---|---|---|
| `rock_class` | 枚举 str | `eq` `ne` `in` | 围岩=IV → 采用锚网索联合支护 |
| `coal_thickness` | float | `gt` `lt` `gte` `lte` `between` | 煤厚>3.5m → 分层掘进方案 |
| `coal_dip_angle` | float | `gt` `lt` `between` | 倾角∈[25,45] → 倾斜巷道措施 |
| `gas_level` | 枚举 str | `eq` `ne` `in` | 瓦斯=突出 → 防突专项措施 |
| `hydro_type` | str | `eq` `in` `contains` | 含"复杂"→ 防治水专项 |
| `geo_structure` | str | `contains` | 含"断层"→ 过断层措施 |
| `spontaneous_combustion` | 枚举 str | `eq` `in` | =容易自燃 → 防灭火措施 |
| `roadway_type` | 枚举 str | `eq` `in` | =进风巷 → 进风巷通风方案 |
| `excavation_type` | 枚举 str | `eq` `in` | =煤巷 → 煤巷掘进工艺 |
| `section_form` | 枚举 str | `eq` `in` | =拱形 → 拱形断面支护参数 |
| `section_width` | float | `gt` `lt` `gte` `lte` `between` | 宽≥5.0m → 大断面支护方案 |
| `section_height` | float | `gt` `lt` `gte` `lte` `between` | 高>4.0m → 高断面施工措施 |
| `excavation_length` | float | `gt` `lt` `between` | 长>500m → 长距离通风方案 |
| `service_years` | int | `gt` `lt` `between` | >5年 → 永久支护标准 |
| `dig_method` | 枚举 str | `eq` `in` | =综掘 → 综掘机配套方案 |
| `dig_equipment` | str | `eq` `contains` | 含"EBZ" → EBZ 系列操作规程 |
| `transport_method` | str | `eq` `contains` | =皮带 → 皮带运输安全措施 |

> [!TIP]
> 新增的 `gte`、`lte`、`contains` 三个运算符相比 V1.0 WBS 的 5 个运算符，补齐了浮点精确边界和文本模糊匹配的空缺。最终 **9 个运算符** 覆盖全部 17 个参数字段。

---

## 3. 数据模型

### 已有模型（骨架阶段已建）

| 模型 | 表名 | 核心字段 |
|------|------|---------|
| `RuleGroup` | `rule_group` | name, description + AuditMixin |
| `Rule` | `rule` | group_id, name, category, priority, is_active, version |
| `RuleCondition` | `rule_condition` | rule_id, field, operator, value |
| `RuleAction` | `rule_action` | rule_id, target_chapter, snippet_id, params_override(JSON) |

**无需新增表**，模型已覆盖完整。

---

## 4. API 契约

### 4.1 规则管理 CRUD

> 前缀：`/api/v1/rules`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/rules/groups` | 规则组列表 | ✅ JWT + tenant_id |
| `POST` | `/rules/groups` | 新建规则组 | ✅ |
| `PUT` | `/rules/groups/{id}` | 更新规则组 | ✅ |
| `DELETE` | `/rules/groups/{id}` | 删除规则组（级联删规则） | ✅ 管理员 |
| `GET` | `/rules/groups/{id}/rules` | 获取规则组下所有规则（含条件+结论） | ✅ |
| `POST` | `/rules` | 新建规则（含条件+结论，事务原子操作） | ✅ |
| `PUT` | `/rules/{id}` | 更新规则（含条件+结论） | ✅ |
| `DELETE` | `/rules/{id}` | 删除规则 | ✅ |

### 4.2 匹配引擎

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/projects/{id}/match` | 触发规则匹配（读 ProjectParams → 遍历规则 → 返回命中结果） | ✅ |
| `GET` | `/projects/{id}/match-result` | 获取最近一次匹配结果 | ✅ |

### 4.3 核心 Schema

```python
# --- 规则创建（含条件+结论，一次提交） ---
class RuleCreateRequest(BaseModel):
    group_id: int
    name: str
    category: Literal["支护", "装备", "安全", "断面", "通风"]
    priority: int = 0
    conditions: list[ConditionItem]  # 条件列表（AND 关系）
    actions: list[ActionItem]        # 结论列表

class ConditionItem(BaseModel):
    field: str       # ProjectParams 字段名
    operator: Literal["eq","ne","gt","lt","gte","lte","in","between","contains"]
    value: str       # JSON 序列化值

class ActionItem(BaseModel):
    target_chapter: str       # 目标章节编号
    snippet_id: int | None    # 关联片段
    params_override: dict | None  # 参数覆盖

# --- 匹配结果 ---
class MatchResult(BaseModel):
    project_id: int
    matched_rules: list[MatchedRule]
    total_matched: int
    matched_chapters: list[str]  # 命中的章节编号列表

class MatchedRule(BaseModel):
    rule_id: int
    rule_name: str
    category: str
    priority: int
    actions: list[ActionItem]
```

---

## 5. Match Engine 核心逻辑

```python
# 伪代码 — 匹配引擎核心
def match(project_params: dict, rules: list[Rule]) -> list[MatchedRule]:
    results = []
    for rule in rules:
        if not rule.is_active:
            continue
        # ALL conditions must match (AND 逻辑)
        all_match = True
        for cond in rule.conditions:
            param_value = project_params.get(cond.field)
            if not evaluate(param_value, cond.operator, cond.value):
                all_match = False
                break
        if all_match:
            results.append(rule)
    # 按 priority 降序排列
    return sorted(results, key=lambda r: r.priority, reverse=True)
```

**evaluate 函数运算符实现**：

| 运算符 | 实现逻辑 |
|--------|---------|
| `eq` | `param == value` |
| `ne` | `param != value` |
| `gt/lt/gte/lte` | `float(param) op float(value)` |
| `in` | `param in json.loads(value)` |
| `between` | `low <= float(param) <= high` |
| `contains` | `value in str(param)` |

---

## 6. 前端规格

### 6.1 页面：`/dashboard/rules` — 规则管理

| 区域 | 组件 | 交互 |
|------|------|------|
| 左侧面板 | 规则组列表（可展开折叠） | 点击组 → 右侧显示该组规则 |
| 右侧顶部 | "新建规则"按钮 + 类型筛选 | — |
| 右侧主体 | 规则卡片列表（名称/类型/优先级/条件数/状态开关） | 点击卡片 → 展开编辑 |

### 6.2 规则编辑器（弹窗/抽屉）

| 区域 | 组件 | 说明 |
|------|------|------|
| 基本信息 | 名称 + 类型下拉 + 优先级数字输入 | — |
| 条件区域 | 动态表单行：`[字段下拉] [运算符下拉] [值输入]` + 增删按钮 | 字段下拉 = ProjectParams 17 字段 |
| 结论区域 | 动态表单行：`[目标章节] [关联片段选择]` + 增删按钮 | 片段从 ChapterSnippet 查询 |

### 6.3 页面：`/dashboard/projects/[id]/match` — 匹配结果

| 区域 | 组件 | 说明 |
|------|------|------|
| 顶部 | 项目信息摘要 + "重新匹配"按钮 | — |
| 主体 | 命中规则列表（按 priority 排序），每条展示：规则名/类型/命中条件高亮/关联章节 | — |
| 底部 | 命中章节列表汇总（去重） | 作为文档生成的输入 |

---

## 7. 架构红线检查清单

- [x] 所有规则查询注入 `tenant_id`（RuleGroup 继承 AuditMixin） ✅
- [x] 规则 CRUD 全部 JWT 认证 ✅
- [x] 条件存储为 JSON 字符串而非硬编码枚举（可扩展）✅
- [x] Match Engine 是纯函数，不涉及 LLM 调用（结构化层）✅
- [x] 预留 `category` 字段供未来 LLM Tool Calling 路由分发 ✅
- [x] 二进制零入库（规则无文件，不涉及）✅
- [x] 匹配结果通过 SSE 推送进度（大量规则时）— 预留 ✅

---

## 8. 验收检查清单

- [ ] 规则组 CRUD 正常，支持 tenant_id 隔离
- [ ] 规则创建支持同时提交条件+结论（事务原子）
- [ ] 9 个运算符全部正确实现（eq/ne/gt/lt/gte/lte/in/between/contains）
- [ ] Match Engine 对 ProjectParams 全字段可匹配
- [ ] 匹配结果按 priority 降序
- [ ] 前端规则管理页可增删改查
- [ ] 前端规则编辑器动态条件/结论表单可用
- [ ] 单元测试覆盖 9 个运算符的边界用例
