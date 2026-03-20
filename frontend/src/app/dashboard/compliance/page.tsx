"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  BarChart3,
  FileSearch,
  Building2,
} from "lucide-react";
import api from "@/lib/api";

/* ===== 类型 ===== */
interface ComplianceItem {
  category: string;
  item: string;
  status: "pass" | "fail" | "warning";
  message: string;
  suggestion: string;
}
interface ComplianceResult {
  total_checks: number;
  passed: number;
  failed: number;
  warned: number;
  is_compliant: boolean;
  items: ComplianceItem[];
}
interface ProjectBrief {
  id: number;
  face_name: string;
  mine_name?: string;
  status: string;
}

/* ===== 状态颜色 ===== */
const STATUS_ICON = {
  pass: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  fail: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
};

/* ===== 圆形进度环 ===== */
function RingProgress({ value, size = 120, stroke = 10, color = "#22c55e" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dy="0.35em"
        className="fill-slate-800 text-xl font-bold" transform={`rotate(90, ${size / 2}, ${size / 2})`}
      >
        {value}%
      </text>
    </svg>
  );
}

export default function CompliancePage() {
  const [projects, setProjects] = useState<ProjectBrief[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [batchResults, setBatchResults] = useState<Map<number, ComplianceResult>>(new Map());
  const [batchLoading, setBatchLoading] = useState(false);

  // 加载项目列表
  useEffect(() => {
    api.get("/projects?page=1&page_size=50").then(res => {
      const items = res.data?.data?.items || res.data?.data || [];
      setProjects(items);
    }).catch(() => {});
  }, []);

  // 单项目审查
  const auditProject = async (pid: number) => {
    setSelectedId(pid);
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post(`/calc/compliance/project/${pid}`);
      const data = res.data?.data;
      setResult(data);
      setBatchResults(prev => new Map(prev).set(pid, data));
    } catch (e: any) {
      alert("审查失败: " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  // 批量审查
  const auditAll = async () => {
    setBatchLoading(true);
    const results = new Map<number, ComplianceResult>();
    for (const p of projects) {
      try {
        const res = await api.post(`/calc/compliance/project/${p.id}`);
        results.set(p.id, res.data?.data);
      } catch { /* skip */ }
    }
    setBatchResults(results);
    setBatchLoading(false);
  };

  // 统计
  const totalAudited = batchResults.size;
  const totalPass = Array.from(batchResults.values()).filter(r => r.is_compliant).length;
  const totalFail = totalAudited - totalPass;
  const passRate = totalAudited > 0 ? Math.round((totalPass / totalAudited) * 100) : 0;
  const allChecks = Array.from(batchResults.values()).reduce((s, r) => s + r.total_checks, 0);
  const allPassed = Array.from(batchResults.values()).reduce((s, r) => s + r.passed, 0);
  const allFailed = Array.from(batchResults.values()).reduce((s, r) => s + r.failed, 0);
  const allWarned = Array.from(batchResults.values()).reduce((s, r) => s + r.warned, 0);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-indigo-600" /> 合规审查看板
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            项目级四维合规校核 · 国标+集团标准双层审查 · 一键批量检测
          </p>
        </div>
        <Button className="gap-2" onClick={auditAll} disabled={batchLoading || projects.length === 0}>
          {batchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          批量审查全部项目 ({projects.length})
        </Button>
      </div>

      {/* 统计仪表盘 */}
      {totalAudited > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 通过率环形图 */}
          <Card className="lg:col-span-1 flex flex-col items-center justify-center py-4">
            <RingProgress
              value={passRate}
              color={passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#f59e0b" : "#ef4444"}
            />
            <p className="mt-2 text-sm font-medium text-slate-600">项目合规率</p>
          </Card>

          {/* 统计卡片 */}
          <Card className="flex flex-col justify-center">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-slate-800">{totalAudited}</div>
              <p className="text-sm text-slate-500">已审查项目</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col justify-center">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">{allPassed}</div>
              <p className="text-sm text-slate-500">通过项 / {allChecks} 总项</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col justify-center">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-600">{allFailed}</div>
              <p className="text-sm text-slate-500">不合规项</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col justify-center">
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-amber-600">{allWarned}</div>
              <p className="text-sm text-slate-500">预警项</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：项目列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> 项目列表
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">暂无项目</p>
            ) : (
              projects.map(p => {
                const br = batchResults.get(p.id);
                const isSelected = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => auditProject(p.id)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-3 text-left transition-all ${
                      isSelected
                        ? "bg-indigo-50 border border-indigo-200 shadow-sm"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{p.face_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.mine_name || `ID: ${p.id}`}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {br && (
                        br.is_compliant
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* 右侧：审查结果 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result ? (
                result.is_compliant
                  ? <ShieldCheck className="h-5 w-5 text-green-500" />
                  : <ShieldAlert className="h-5 w-5 text-red-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-slate-300" />
              )}
              {selectedId ? `项目 #${selectedId} 合规报告` : "选择项目开始审查"}
            </CardTitle>
            {result && (
              <div className="flex gap-4 text-sm mt-1">
                <span className="text-green-600">✅ 通过 {result.passed}</span>
                <span className="text-red-600">❌ 不合规 {result.failed}</span>
                <span className="text-amber-600">⚠️ 预警 {result.warned}</span>
                <span className="text-slate-500">共 {result.total_checks} 项</span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-sm text-slate-500">正在执行四维合规审查...</span>
              </div>
            ) : result ? (
              <div className="space-y-2 max-h-[540px] overflow-y-auto">
                {/* 按类别分组 */}
                {(() => {
                  const groups = new Map<string, ComplianceItem[]>();
                  result.items.forEach(item => {
                    const arr = groups.get(item.category) || [];
                    arr.push(item);
                    groups.set(item.category, arr);
                  });

                  return Array.from(groups.entries()).map(([category, items]) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 tracking-wider">
                        {category}
                      </h4>
                      <div className="space-y-1.5">
                        {items.map((item, i) => {
                          const style = STATUS_ICON[item.status];
                          const Icon = style.icon;
                          return (
                            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2.5 border ${style.bg} ${style.border}`}>
                              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-medium ${style.color}`}>{item.item}</div>
                                <div className="text-xs text-slate-600 mt-0.5">{item.message}</div>
                                {item.suggestion && (
                                  <div className="mt-1 text-xs text-slate-500 italic">💡 {item.suggestion}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileSearch className="h-12 w-12 mb-3" />
                <p className="text-sm">选择左侧项目开始合规审查</p>
                <p className="text-xs mt-1">或点击"批量审查"一键检测全部项目</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
