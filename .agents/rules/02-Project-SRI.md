---
trigger: always_on
---

# 📋 项目级约束 (Project SRI)

## 交付环境要求
1. **操作系统**: Ubuntu 22.04 LTS（生产） / macOS 14+（开发）
2. **容器运行时**: Docker Engine 24+ / Docker Desktop 4+
3. **Node.js**: ≥ 20.9.0 LTS（前端已通过 `.nvmrc` 和 `package.json engines` 约束）
4. **Python**: 3.11.x（后端已通过 Dockerfile 和 CI 约束）

## 部署模式
- **开发环境**: Docker 仅启动 PostgreSQL + Redis，前后端本地直接运行
- **生产环境**: 全容器化部署（`docker compose up -d`），Nginx 反代统一入口

## 数据安全
1. 所有客户规程文件（.doc/.docx）不得入库 Git，通过 `scripts/ingest_*.py` 按需导入
2. 数据库定期备份（`scripts/db_backup.sh`），备份文件不得入库 Git
3. 生产环境 `SECRET_KEY` 必须使用随机生成的 ≥32 字节密钥

## 交付物清单
- [ ] 源代码（GitHub 仓库）
- [ ] 部署文档（README.md）
- [ ] Docker 一键部署配置（docker-compose.yml）
- [ ] 数据库迁移脚本（migrations/）
- [ ] 种子数据脚本（scripts/seed_data.py）
- [ ] 数据库备份恢复脚本（scripts/db_backup.sh / db_restore.sh）
- [ ] CI/CD 流水线（.github/workflows/）
- [ ] 单元测试报告（pytest / vitest）
