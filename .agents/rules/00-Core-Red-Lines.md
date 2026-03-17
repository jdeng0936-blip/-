---
trigger: always_on
---

# 🛡️ 核心架构与安全底线 (Core Rules)
1. **密钥安全**: 严禁在客户端暴露 LLM API Key、数据库连接串或第三方凭证，必须通过后端中转并存在 `.env` 中。
2. **二进制零入库**: 图片/音频/文档直传 OSS/S3，PostgreSQL 仅存 URL/Key 及解析文本。
3. **强制权限隔离 (Tenant Isolation)**: 任何关系查询或向量检索，第一步必须注入访问者的权限标识或 Tenant ID 过滤。
4. **架构定调**: 全面采用 PostgreSQL 16 + pgvector，弃用外部独立向量库。
5. **意图路由**: 复杂业务流转交由 LLM Tool Calling 或 LangGraph，严禁硬编码 if-else 匹配。
6. **通信协议**: 单向流式输出用 SSE；双向高频交互/看板刷新用 WebSocket + Redis Pub/Sub。
7. **Git规范**: 遵循 Conventional Commits (feat/fix/docs/refactor/test)。
8. **测试底线**: 单元测试严禁发起真实 LLM API 调用或直传 OSS，必须 Mock。集成测试需用独立数据库并在结束后 Teardown。