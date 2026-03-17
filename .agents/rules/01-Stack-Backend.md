---
trigger: glob
globs: **/*.py, **/api/**, requirements.txt, **/*.cs
---

# ⚙️ 后端与硬件技术栈约束
1. **基础框架**: FastAPI (Python 3.11+) + Uvicorn，严格使用 async/await 异步编程。
2. **硬件遥测集成**: 涉及底层传感器或 CAN 总线数据解析，必须通过 MQTT + EMQX Broker 上报。由 Python 或 C# (.NET 6) 后端服务消费持久化后，再推送到前端看板。
3. **WebSocket 状态**: 结合 Redis 管理多实例状态同步，客户端必须实现心跳保活。
4. **接口规范**: 所有 API 必须进行 JWT 鉴权；统一使用 Pydantic V2 进行校验。
5. **测试框架**: 统一使用 pytest 和 pytest-asyncio；路由测试用 httpx.AsyncClient；数据库测试通过 dependency_overrides 替换回滚 session。