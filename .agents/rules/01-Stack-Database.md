---
trigger: glob
globs: **/models/*.py, **/schemas/*.py, **/*.sql, **/alembic/**
---

# 🗄️ 数据库开发约束
1. **核心引擎**: PostgreSQL 16。高频查询与流控使用 Redis Stack。
2. **通用字段**: 所有核心表必须包含 created_at, updated_at, created_by, tenant_id。
3. **向量与图查询**: 知识库/情报表必须包含 embedding Vector(1536) 列并建立 HNSW 索引。树状/权限链路遍历必须使用原生 WITH RECURSIVE，禁止引入图数据库。