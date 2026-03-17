---
trigger: glob
globs: **/llm/**, **/rag/**, **/agents/**, **/*registry*
---

# 🧠 AI 动态路由与数据飞轮
1. **严禁硬编码**: 业务代码中绝对禁止直接写入物理模型名 (如 gemini-2.5-flash)。
2. **任务驱动路由**: LLM 调用必须通过后端动态选择器 (如 LLMSelector.get_model_for_task(task_type))。所有模型配置、权重、本地部署节点统一在 llm_registry.yaml 维护。
3. **数据飞轮 (知识蒸馏)**: 强制接入 LangFuse。高质量或被采纳的 LLM 业务输出，必须上报 quality: high 标签，为未来本地模型微调 (SFT) 积累语料。
4. **三层检索流水线**: 严禁全量数据灌入 Prompt。必须遵循：pgvector(语义提取) -> 递归CTE(关系遍历) -> SQL(事实提取) -> LLM(综合推理决策)。