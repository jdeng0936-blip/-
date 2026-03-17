# DOC-01 文档生成引擎 — 开发契约

> **状态**：✅ 已实现  
> **模块编号**：DOC-01  
> **优先级**：P0（主链路终点，串联全部数据源）  
> **依赖**：DAT-01✅ DAT-05✅ CAL-01✅ CAL-02✅ ProjectParams✅

---

## 1. 业务目标

一键触发：读取项目参数 → 规则匹配 → 计算校核 → 模板填充 → 输出 Word 文档。

```
ProjectParams → Match Engine → 命中规则 → 收集章节片段
                                          ↓
                             CAL 引擎 → 计算结果注入
                                          ↓
                             模板引擎 → 组装 .docx 文件
```

## 2. API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/projects/{id}/generate` | 触发文档生成 |
| `GET`  | `/projects/{id}/document` | 下载生成的文档 |

## 3. 核心逻辑

DocGenerator 编排流程：
1. 加载 ProjectParams
2. 调用 RuleService.match_rules() 获取命中规则
3. 调用 SupportCalcEngine + VentCalcEngine 获取计算结果
4. 按章节顺序组装内容（封面→参数→支护→通风→安全→附录）
5. 用 python-docx 生成 .docx

## 4. 验收清单

- [ ] 端到端生成完整 Word 文档
- [ ] 封面含项目名/矿井名/编制日期
- [ ] 参数章节含 ProjectParams 全部字段
- [ ] 支护章节含 CAL-01 计算结果
- [ ] 通风章节含 CAL-02 计算结果
- [ ] 合规预警以醒目格式标注
