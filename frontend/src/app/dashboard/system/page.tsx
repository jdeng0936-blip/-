"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Shield,
  Building2,
  FileText,
  Settings,
  ChevronRight,
} from "lucide-react";

const MODULES = [
  { key: "users", label: "用户管理", desc: "系统用户的增删改查、密码重置", icon: Users, count: "—" },
  { key: "roles", label: "角色权限", desc: "角色定义与权限矩阵配置", icon: Shield, count: "—" },
  { key: "mines", label: "矿井配置", desc: "矿井基础信息、参数模板管理", icon: Building2, count: "—" },
  { key: "logs", label: "操作日志", desc: "系统操作审计日志查询", icon: FileText, count: "—" },
  { key: "config", label: "系统设置", desc: "全局参数、LLM 模型配置、存储设置", icon: Settings, count: "—" },
];

export default function SystemPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">系统管理</h2>
        <p className="mt-1 text-sm text-slate-500">用户管理 · 角色权限 · 矿井配置 · 操作日志</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Card
            key={mod.key}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selected === mod.key ? "border-blue-500 ring-2 ring-blue-200" : ""
            }`}
            onClick={() => setSelected(mod.key)}
          >
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100">
                <mod.icon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{mod.label}</h3>
                <p className="text-xs text-slate-500">{mod.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Settings className="mb-3 h-10 w-10 opacity-30" />
            <p className="font-medium">「{MODULES.find(m => m.key === selected)?.label}」模块开发中</p>
            <p className="mt-1 text-xs">后端 API 路由即将上线，敬请期待</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
