# DAT-01 标准化基础库 — 开发契约

> **状态**：✅ 已实现  
> **模块编号**：DAT-01  
> **优先级**：P0（所有模块的数据底座）

---

## 1. 业务目标

建立国家/行业技术规范的结构化知识库，支持规范文档的 CRUD 管理和条款树形浏览。为后续规则引擎（DAT-05）和 AI 检索（AI-01）提供数据源。

### 覆盖的规范类型

| 类型 | 示例 |
|------|------|
| 法律法规 | 《煤矿安全规程》 |
| 技术规范 | 《锚杆支护技术规范》GB/T 35056 |
| 集团标准 | 华阳集团内部技术标准 |
| 安全规程 | 《防治煤与瓦斯突出细则》 |

---

## 2. 数据模型

### 2.1 已有模型（骨架阶段已建）

- `StdDocument` — 规范文档主表  
- `StdClause` — 条款树（parent_id 自引用，`WITH RECURSIVE` 遍历）

### 2.2 需补充的字段

无需新增表，但 `StdClause` 需确认以下字段覆盖完整：

| 字段 | 类型 | 说明 |
|------|------|------|
| `document_id` | FK | 所属文档 |
| `parent_id` | int | 父条款（树形） |
| `clause_no` | str | 条款编号 |
| `title` | str | 条款标题 |
| `content` | text | 条款正文 |
| `level` | int | 层级深度 |

---

## 3. API 契约

> 前缀：`/api/v1/standards`

### 3.1 规范文档 CRUD

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/standards` | 文档列表（分页 + 筛选） | ✅ JWT + tenant_id |
| `POST` | `/standards` | 新建文档 | ✅ |
| `GET` | `/standards/{id}` | 文档详情（含条款树） | ✅ |
| `PUT` | `/standards/{id}` | 更新文档基础信息 | ✅ |
| `DELETE` | `/standards/{id}` | 删除文档（级联删条款） | ✅ 管理员 |

### 3.2 条款管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `GET` | `/standards/{id}/clauses` | 获取条款树 | ✅ |
| `POST` | `/standards/{id}/clauses` | 新增条款 | ✅ |
| `PUT` | `/clauses/{clause_id}` | 更新条款 | ✅ |
| `DELETE` | `/clauses/{clause_id}` | 删除条款（级联删子条款） | ✅ |

### 3.3 请求/响应 Schema

```python
# --- 请求 ---
class StdDocumentCreate(BaseModel):
    title: str
    doc_type: Literal["法律法规", "技术规范", "集团标准", "安全规程"]
    version: str | None = None
    publish_date: date | None = None

class StdClauseCreate(BaseModel):
    parent_id: int | None = None
    clause_no: str | None = None
    title: str | None = None
    content: str
    level: int = 0

# --- 响应 ---
class StdDocumentOut(BaseModel):
    id: int
    title: str
    doc_type: str
    version: str | None
    publish_date: date | None
    is_current: bool
    clause_count: int  # 条款数量聚合

class StdClauseTree(BaseModel):
    id: int
    clause_no: str | None
    title: str | None
    content: str | None
    level: int
    children: list["StdClauseTree"] = []
```

---

## 4. 前端规格

### 4.1 页面：`/dashboard/standards`

| 区域 | 组件 | 交互 |
|------|------|------|
| 顶栏 | 搜索框 + 类型筛选下拉 + "新增文档"按钮 | 实时搜索 |
| 主体 | **TanStack Table** 文档列表（标题/类型/版本/发布日期/条款数/操作） | 分页、排序 |
| 操作列 | 查看 · 编辑 · 删除 | 删除需二次确认 |

### 4.2 页面：`/dashboard/standards/[id]`

| 区域 | 组件 | 交互 |
|------|------|------|
| 左侧 | 条款树（树形导航，可展开/折叠） | 点击条款高亮右侧内容 |
| 右侧 | 条款正文详情面板 | 支持编辑 |
| 底部 | "新增子条款"按钮 | 弹窗表单 |

---

## 5. 验收检查清单

- [ ] `GET /standards` 返回分页数据，支持 `doc_type` 筛选和 `title` 模糊搜索
- [ ] `POST /standards` 创建文档，自动注入 `tenant_id` 和 `created_by`
- [ ] `GET /standards/{id}` 返回文档详情 + 嵌套条款树
- [ ] 条款 CRUD 正常，删除条款级联删除子条款
- [ ] 所有接口强制 JWT 认证 + tenant_id 隔离
- [ ] 前端标准库列表页可增删改查
- [ ] 前端条款树可展开/折叠/编辑
- [ ] 单元测试覆盖核心 Service 方法
