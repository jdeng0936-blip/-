# AI 驱动专业文档智能生成平台 — 团队技术手册

> 基于「掘进工作面规程智能生成平台」提炼，适用于所有"专业知识 + AI 生成 + 标准化文档"场景（标书、规程、报告、方案等）。
> 更新日期：2026-03-24

---

## 一、核心架构模式

所有项目遵循同一种范式：

```
用户参数输入
    ↓
RAG 三层融合检索（语义 + 知识库 + 结构化查表）
    ↓
领域计算引擎（业务特定的数值计算）
    ↓
AI 深度生成（参数 + RAG + 计算推导 + 范文 Few-Shot）
    ↓
Critic 质量闭环（打分 → <8分重写 → 一致性扫描）
    ↓
合规校验引擎（多维度自动检查）
    ↓
输出 Word/PDF 标准文档
    ↓
用户反馈 → 数据飞轮 → 持续进化
```

---

## 二、技术栈规范（强制）

| 层次 | 技术选型 | 说明 |
|------|---------|------|
| **后端** | Python 3.11 + FastAPI + Uvicorn | 全异步 `async/await`，禁止同步阻塞 |
| **前端** | Next.js 15 + React 19 + TypeScript | App Router，严格全类型 |
| **数据库** | PostgreSQL 16 + pgvector | 向量维度1536，用于语义检索 |
| **缓存** | Redis | WebSocket 状态、会话管理 |
| **AI 网关** | LiteLLM 中继代理 | 统一管理多模型，禁止直连 API |
| **可观测** | LangFuse | 追踪所有 LLM 调用链路 |
| **部署** | Docker + docker-compose | 环境一致，一键启动 |
| **API 校验** | Pydantic V2 | 所有输入输出严格 Schema |
| **鉴权** | JWT | 所有 API 强制鉴权 |
| **流式输出** | SSE (Server-Sent Events) | AI 对话实时流式输出 |

---

## 三、架构红线（团队必须遵守）

### 🔴 安全红线
```
❌ 禁止：在前端暴露任何 API Key / 数据库连接串
✅ 正确：API Key 存 .env，通过后端 LiteLLM 网关中转

❌ 禁止：二进制文件（docx/pdf/图片）入库 Git
✅ 正确：存 storage/outputs/，Git 忽略，生产环境上传 OSS/S3

❌ 禁止：直接把数据库全量数据灌入 Prompt
✅ 正确：pgvector语义检索 → 结构化查表 → LLM综合推理（三层流水线）
```

### 🔴 AI 架构红线
```
❌ 禁止：硬编码模型名（如 "gemini-2.5-flash"）
✅ 正确：通过 task_type 查 llm_registry.yaml 动态获取

❌ 禁止：用 if-else 做意图路由
✅ 正确：LLM Tool Calling 自主判断意图 + 调度工具

❌ 禁止：对安全关键参数（支护/通风/报价）直接采用 LLM 数值输出
✅ 正确：LLM 解析参数 → 计算引擎精确计算 → LLM 解读结果
```

### 🔴 数据隔离红线
```
❌ 禁止：任何 DB 查询或向量检索不带 tenant_id 过滤
✅ 正确：所有查询第一步注入 tenant_id，实现多租户数据完全隔离
```

### 🔴 代码质量红线
```
❌ 禁止：单元测试中发起真实 LLM API 调用
✅ 正确：Mock LLM 返回，计算引擎纯函数单测

❌ 禁止：在 ISR（中断/高频线程）中动态分配内存或阻塞等待
✅ 正确：使用静态分配 + 异步非阻塞
```

---

## 四、可复用核心模块详解

### 模块 1：LLM 模型注册表

**文件**：`llm_registry.yaml`

**作用**：所有模型配置统一管理，业务代码零硬编码。

```yaml
# llm_registry.yaml 模板
tasks:
  # 高精度推理任务（意图识别/合规审查/文档生成）
  tool_calling:
    models: ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gpt-5.1"]
    temperature: 0.1
    max_tokens: 1024
    note: "核心路由，优先用最强模型"

  # 文档章节生成
  doc_section_generate:
    models: ["gemini-3.1-pro-preview", "gemini-2.5-pro"]
    temperature: 0.3
    max_tokens: 4096

  # 高速对话（不要求极高精度）
  chat:
    models: ["gemini-3-flash-preview", "gemini-2.5-flash", "gpt-5-mini"]
    temperature: 0.5
    max_tokens: 2048

  # 质量评分
  critic_evaluation:
    models: ["gemini-3.1-pro-preview", "gemini-2.5-pro"]
    temperature: 0.1
    max_tokens: 2048

  # 向量嵌入
  embedding:
    models: ["gemini-embedding-001", "text-embedding-005"]
```

**使用方式**：

```python
# app/core/llm_selector.py
import yaml
from pathlib import Path

class LLMSelector:
    _registry = None

    @classmethod
    def _load(cls):
        if cls._registry is None:
            with open("llm_registry.yaml") as f:
                cls._registry = yaml.safe_load(f)["tasks"]

    @classmethod
    def get_config(cls, task_type: str) -> dict:
        cls._load()
        return cls._registry.get(task_type, cls._registry["chat"])

    @classmethod
    def get_model(cls, task_type: str) -> str:
        """获取首选模型（fallback链自动处理）"""
        config = cls.get_config(task_type)
        return config["models"][0]
```

**套用到新项目**：复制 `llm_registry.yaml`，按业务增减 `task_type`，模型名无需改动。

---

### 模块 2：Prompt 注册表（版本化 + A/B 测试）

**文件**：`prompts_registry.yaml`

**作用**：Prompt 模板统一管理、版本追踪、支持 A/B 测试。

```yaml
# prompts_registry.yaml 模板
prompts:
  doc_generation:
    v1_baseline:
      version: "1.0"
      description: "基础版，仅大纲扩写"
      template: |
        请编写【{chapter_no} {title}】章节的完整正文。
        == 业务参数 ==
        {params_text}
        == 章节大纲 ==
        {outline}
        == 知识库参考资料 ==
        {rag_context}
        直接输出正文，不要开场白。

    v2_few_shot:
      version: "2.0"
      description: "V2: 加入计算推导文本 + 范文 Few-Shot"
      template: |
        请编写【{chapter_no} {title}】章节的完整正文。
        == 业务参数 ==
        {params_text}
        == 大纲 ==
        {outline}
        {baseline_text}
        {rag_context_text}
        {calculation_text}
        {few_shot_text}
        直接输出排版优美的专业正文段落。

  critic_evaluation:
    v1_standard:
      version: "1.0"
      template: |
        你是【{业务领域}】专家审核专家。请严格审核以下章节内容：
        1. 【模糊表述扫描】找出含"按规定""根据实际"等模糊词条款
        2. 【数值标准检查】检查是否每条技术措施都有具体数值
        3. 【法规引用检查】统计法规引用，不足3条时列出应补充项
        4. 【结构完整性】检查是否按标准结构展开
        5. 【责任岗位检查】检查关键操作是否明确责任人
        == 待审核内容 ==
        {content}
        == 输出格式（严格遵循）==
        SCORE: X/10
        ISSUES_COUNT: N
        FIXES:
        - [位置]: 问题 → 修正建议
        如完全合格则输出：SCORE: X/10 \n ISSUES_COUNT: 0 \n PASS
```

**使用方式**：

```python
# app/core/prompt_manager.py
import yaml

class PromptManager:
    def __init__(self):
        with open("prompts_registry.yaml") as f:
            self._prompts = yaml.safe_load(f)["prompts"]

    def get(self, prompt_name: str, version: str = None) -> str:
        """获取最新版 Prompt 模板，version 为 None 时取最后一个版本"""
        versions = self._prompts[prompt_name]
        if version:
            return versions[version]["template"]
        latest = list(versions.values())[-1]
        return latest["template"]

prompt_manager = PromptManager()
```

**套用到新项目**：替换 `{业务领域}` 和审核维度，其余结构完全保留。

---

### 模块 3：RAG 三层融合检索引擎

**原理**：
```
L1a: pgvector 语义检索（标准库条款）
L1b: pgvector 语义检索（历史文档切片）
L2:  结构化参数表精确查询
L3:  融合排序 Re-rank → 注入 LLM 上下文
```

**核心代码模板**：

```python
# app/services/retriever.py
class HybridRetriever:
    def __init__(self, session, tenant_id: int):
        self.session = session
        self.tenant_id = tenant_id

    async def retrieve(self, query: str, context: dict = None, top_k: int = 5) -> dict:
        # L1a: 标准库语义检索
        semantic = await self._search_standards(query, top_k)
        # L1b: 历史文档知识库检索
        snippets = await self._search_knowledge(query, top_k)
        # L2: 结构化参数查表（由业务层决定是否触发）
        tables = []
        # L3: 融合排序
        merged = self._merge_and_rank(semantic, tables, snippets)
        return {"semantic": semantic, "snippets": snippets, "merged": merged}

    def _merge_and_rank(self, semantic, tables, snippets):
        merged = []
        # 结构化结果最高优先级
        for item in tables:
            merged.append({"type": "table", "relevance": 1.0, "content": item})
        # 语义结果按文档类型加权
        DOC_WEIGHT = {"核心标准": 1.5, "行业规范": 1.0, "法律法规": 1.0}
        for item in semantic:
            base = max(0, 1.0 - item.get("distance", 1.0))
            w = DOC_WEIGHT.get(item.get("doc_type", ""), 0.8)
            merged.append({"type": "semantic", "relevance": round(base * w, 4),
                          "content": item})
        for item in (snippets or []):
            base = max(0, 1.0 - item.get("distance", 1.0))
            merged.append({"type": "snippet", "relevance": round(base, 4),
                          "content": item})
        return sorted(merged, key=lambda x: x["relevance"], reverse=True)
```

**套用到标书/其他项目**：
- `_search_standards` → 检索「招标文件规范库」「政策法规库」
- `_search_knowledge` → 检索「历史中标标书片段」
- L2 查表 → 查「评分标准对照表」「资质门槛表」
- `DOC_WEIGHT` → 调整「招标文件 > 行业规范 > 通用参考」

---

### 模块 4：AI Tool Calling 智能路由引擎

**核心原理**：LLM 自主决定调用哪个工具，严禁 if-else 硬编码意图路由。

**代码模板**：

```python
# app/services/ai_router.py
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "tool_name_1",
            "description": "何时调用这个工具的自然语言描述（LLM 据此决策）",
            "parameters": {
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "参数说明"},
                },
                "required": ["param1"],
            },
        },
    },
    # 添加更多工具...
]

class AIRouter:
    def __init__(self, session, tenant_id: int):
        from app.core.config import settings
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,  # LiteLLM 网关地址
        )
        self.model = LLMSelector.get_model("tool_calling")
        self.tenant_id = tenant_id

    async def chat_stream(self, user_message: str, history: list = None):
        """SSE 流式对话 + Tool Calling"""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        # 第一轮：LLM 决定是否调用工具
        response = await self.client.chat.completions.create(
            model=self.model, messages=messages,
            tools=TOOLS, tool_choice="auto",
        )
        msg = response.choices[0].message

        if msg.tool_calls:
            # 告知前端工具调用开始
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)
                yield f"data: {json.dumps({'type': 'tool_start', 'name': fn_name})}\n\n"
                result = await self._execute_tool(fn_name, fn_args)
                messages.append({"role": "tool", "tool_call_id": tc.id,
                                 "content": json.dumps(result, ensure_ascii=False)})
                yield f"data: {json.dumps({'type': 'tool_done', 'name': fn_name})}\n\n"

            # 第二轮：LLM 解读工具结果，流式输出
            stream = await self.client.chat.completions.create(
                model=self.model, messages=messages, stream=True)
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk.choices[0].delta.content})}\n\n"
        else:
            # 无工具调用，直接流式输出
            stream = await self.client.chat.completions.create(
                model=self.model, messages=messages, stream=True)
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk.choices[0].delta.content})}\n\n"

        yield "data: [DONE]\n\n"
```

**套用到新项目**：修改 `TOOLS` 列表定义（工具名称、描述、参数），修改 `_execute_tool` 调用对应的业务引擎。

---

### 模块 5：Critic 质量闭环引擎

**原理**：生成后自动打分，低于阈值重新生成，可迭代 N 轮。

```python
# app/services/critic.py
async def critic_and_rewrite(
    chapter_content: str,
    chapter_meta: dict,
    client: AsyncOpenAI,
    max_rounds: int = 2,
) -> tuple[str, dict]:
    """Critic 自评打分 + 不合格重写"""
    critic_prompt = prompt_manager.get("critic_evaluation")

    for round_i in range(max_rounds):
        # 1. 打分
        critic_resp = await client.chat.completions.create(
            model=LLMSelector.get_model("critic_evaluation"),
            messages=[{"role": "user", "content": critic_prompt.format(
                content=chapter_content, **chapter_meta
            )}],
        )
        raw = critic_resp.choices[0].message.content or ""

        # 2. 解析评分
        score = _parse_score(raw)  # 提取 "SCORE: X/10"
        issues_count = _parse_issues(raw)

        if score >= 8 or "PASS" in raw:
            return chapter_content, {"score": score, "rounds": round_i + 1}

        # 3. 低分 → 提取问题 → 重写
        fixes = _parse_fixes(raw)
        rewrite_prompt = (
            f"请根据以下问题修正章节内容：\n{fixes}\n\n原内容：\n{chapter_content}"
        )
        rewrite_resp = await client.chat.completions.create(
            model=LLMSelector.get_model("doc_section_generate"),
            messages=[{"role": "user", "content": rewrite_prompt}],
        )
        chapter_content = rewrite_resp.choices[0].message.content or chapter_content

    return chapter_content, {"score": score, "rounds": max_rounds}
```

**套用到新项目**：修改 `critic_evaluation` Prompt 中的5个检查维度为业务相关维度（如标书评审标准）。

---

### 模块 6：多维度合规校验引擎

**设计模式**：无状态纯函数，接受输入参数，返回合规报告，可独立调用。

```python
# app/services/compliance_engine.py
from pydantic import BaseModel
from typing import Literal

class ComplianceItem(BaseModel):
    category: str
    item: str
    status: Literal["pass", "fail", "warning"]
    message: str
    suggestion: str = ""

class ComplianceEngine:
    @staticmethod
    def check(inp: dict) -> list[ComplianceItem]:
        items = []

        # ① 必填字段检查
        for field in REQUIRED_FIELDS:
            if not inp.get(field):
                items.append(ComplianceItem(
                    category="完整性", item=field,
                    status="fail",
                    message=f"【{field}】不能为空",
                    suggestion=f"请填写{field}"
                ))

        # ② 数值范围校核
        for field, (min_val, max_val) in NUMERIC_RULES.items():
            val = inp.get(field)
            if val is not None:
                if not (min_val <= float(val) <= max_val):
                    items.append(ComplianceItem(
                        category="数值校核", item=field,
                        status="fail",
                        message=f"{field}={val}，应在[{min_val},{max_val}]范围内"
                    ))

        # ③ 业务规则校核（按项目定制）
        # ... 在此添加业务特定规则

        return items
```

**套用到标书**：
- `REQUIRED_FIELDS` → 标书必填项（资质证书编号、业绩证明、报价...）
- `NUMERIC_RULES` → 数值验证（报价上下限、工期范围...）
- 业务规则 → 资质等级匹配、业绩年限要求...

---

### 模块 7：LangFuse 可观测性 + 数据飞轮

**接入方式**（三步）：

```python
# 1. .env 配置
LANGFUSE_PUBLIC_KEY=pk-xxx
LANGFUSE_SECRET_KEY=sk-xxx
LANGFUSE_HOST=https://cloud.langfuse.com

# 2. 初始化（服务启动时）
try:
    from langfuse import Langfuse
    langfuse = Langfuse(
        public_key=os.getenv("LANGFUSE_PUBLIC_KEY", ""),
        secret_key=os.getenv("LANGFUSE_SECRET_KEY", ""),
        host=os.getenv("LANGFUSE_HOST"),
    )
except ImportError:
    langfuse = None  # 未配置时静默降级

# 3. 在关键调用点埋点
if langfuse:
    trace = langfuse.trace(name="doc_generation", input=params)
    span = trace.span(name="ai_generate", input=prompt[:200])
    # ... AI 调用 ...
    span.end(output=result, metadata={"score": critic_score})
    # 高质量输出打标签，用于后续微调
    if critic_score >= 9:
        trace.update(tags=["quality:high"])
```

**数据飞轮闭环**：
```
LangFuse 收集高质量输出（quality:high 标签）
    ↓
导出为 JSONL 格式微调数据集
    ↓
本地部署模型（如 Qwen/GLM）做 SFT 微调
    ↓
更精准的领域专属模型上线
    ↓
替换 llm_registry.yaml 中的对应 task 模型配置
```

---

## 五、新项目启动清单（5步上线）

### Step 1：初始化项目结构

```bash
# 克隆脚手架（或复制现有项目）
cp -r excavation-platform new-project
cd new-project

# 后端依赖
cd backend && pip install -r requirements.txt

# 前端依赖
cd ../frontend && npm install
```

### Step 2：配置环境变量

```ini
# backend/.env
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/your_db
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-xxx                    # LiteLLM 网关 Key
OPENAI_BASE_URL=http://your-litellm:4000/v1  # LiteLLM 网关地址
AI_MODEL=gemini-3.1-pro-preview         # 默认模型（优先级低于注册表）
LANGFUSE_PUBLIC_KEY=pk-xxx              # 可观测性（可选）
LANGFUSE_SECRET_KEY=sk-xxx
CORS_ORIGINS=["http://localhost:3000"]
```

### Step 3：定制业务知识库

```python
# 1. 准备领域文档（PDF/Word/文本）
# 2. 运行文档解析入库
python scripts/ingest_standards.py \
  --source ./knowledge/招标文件规范/ \
  --doc_type "核心标准" \
  --tenant_id 1

# 3. 运行向量化
python scripts/embed_standards.py --tenant_id 1
```

### Step 4：定制业务配置

```yaml
# llm_registry.yaml — 按业务修改任务名称，模型配置基本不变
tasks:
  tool_calling:         # 保留
  doc_section_generate: # 保留（改为标书章节生成）
  critic_evaluation:    # 保留（改审核维度）
  compliance_check:     # 保留（改合规规则）
  # 新增业务特定任务
  bid_price_analysis:
    models: ["gemini-3.1-pro-preview"]
    temperature: 0.1
    max_tokens: 1024
```

```python
# 定制 TOOLS 列表（ai_router.py）
TOOLS = [
    # 保留：search_standards（改为检索招标文件库）
    # 新增：
    {
        "function": {
            "name": "check_qualification",
            "description": "资质门槛检查 — 当用户询问资质要求时调用",
            "parameters": {...}
        }
    },
    {
        "function": {
            "name": "calc_bid_price",
            "description": "报价估算 — 当用户询问报价或成本时调用",
        }
    },
]
```

```yaml
# prompts_registry.yaml — 替换领域关键词
prompts:
  doc_generation:
    v1_baseline:
      template: |
        请编写标书【{chapter_no} {title}】章节。
        == 项目参数 ==
        {params_text}
        == 招标要求 ==
        {rag_context}
        直接输出专业标书正文。
  critic_evaluation:
    v1_standard:
      template: |
        你是标书审核专家。请审核以下章节：
        1. 是否响应了招标文件所有要求
        2. 资质证书是否均已列明
        3. 业绩案例是否满足年限/金额要求
        4. 报价是否完整无遗漏
        5. 格式是否符合招标文件规范
        ...
```

### Step 5：启动服务验证

```bash
# 启动基础设施
docker compose up -d postgres redis

# 启动后端
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 启动前端
cd frontend && npm run dev

# 验证 AI 连通性
python -c "
from openai import OpenAI
client = OpenAI(api_key='sk-xxx', base_url='http://your-litellm:4000/v1')
resp = client.chat.completions.create(
    model='gemini-3.1-pro-preview',
    messages=[{'role':'user','content':'测试连通'}]
)
print(resp.choices[0].message.content)
"
```

---

## 六、开发规范

### Git 提交规范

```
feat:     新功能
fix:      缺陷修复
docs:     文档更新
refactor: 代码重构（无功能变更）
test:     测试
chore:    工具/依赖/配置
```

### 测试规范

```python
# 单元测试：计算引擎纯函数测试（无需 Mock）
def test_support_calc():
    result = SupportCalcEngine.calculate(SupportCalcInput(
        rock_class="III", section_form="矩形",
        section_width=4.5, section_height=3.2
    ))
    assert result.safety_factor >= 1.5

# AI 路由测试：Mock LLM，禁止真实调用
@patch("app.services.ai_router.AsyncOpenAI")
async def test_ai_router(mock_client):
    mock_client.return_value.chat.completions.create.return_value = ...
    # 测试工具调度逻辑
```

### .gitignore 必须忽略

```gitignore
.env
.env.*
backend/storage/outputs/    # 生成文档
*.dump                       # 数据库备份
backups/
*.bak
```

---

## 七、FAQ

**Q: 模型调用失败怎么处理？**  
A: `llm_registry.yaml` 中每个 task 配置了多个模型，SDK 层自动 fallback。无需改代码。

**Q: 如何切换到更好的模型？**  
A: 只改 `llm_registry.yaml` 对应 task 的 `models` 列表第一项，立即生效。

**Q: 如何提升 RAG 检索质量？**  
A: 补充知识库文档（高质量的参考案例越多越好），调整 `DOC_WEIGHT` 权重，降低向量检索的 `threshold`（`0.5→0.4`）。

**Q: Critic 评分总是偏低怎么办？**  
A: 检查 Prompt 中的评分标准是否过严，或调整 `threshold`（如从8分降到7分）。

**Q: 新项目是否需要重建向量数据库？**  
A: 是的，每个项目（租户）的领域知识不同，需要重新运行 `ingest` + `embed` 脚本入库。

---

> **核心原则**：换领域不换架构。所有 AI 项目共用同一套"Tool Calling + RAG + Critic + 数据飞轮"范式，差异只在领域知识和业务规则。
