---
trigger: glob
globs: **/*.ts, **/*.tsx, **/*.css, tailwind.config.ts
---

# 🖥️ 前端技术栈约束
1. **基础选型**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Zustand + TanStack Query。
2. **架构分工**: 
   - next-admin: 侧重复杂表单、数据看板 (Recharts)、表格 (TanStack Table)。
   - next-chat: 极简对话工作台，使用 Vercel AI SDK (useChat)，支持 Markdown 与 Framer Motion 动效。
3. **编码红线**: 包含浏览器 API 的组件顶部必须声明 'use client'。网络请求统一用 Axios 拦截器注入 Token。
4. **测试框架**: 单元/组件测试统一使用 Vitest + RTL，侧重交互行为。